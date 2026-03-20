"""
CP-SAT Optimization Engine for Timetable Generation.
Uses Google OR-Tools constraint programming solver to generate optimal timetables.
"""
import logging
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from uuid import UUID
from datetime import datetime, time
import json

from ortools.sat.python import cp_model
from sqlalchemy.orm import Session

from app.core.constraints import (
    HardConstraints, SoftConstraints, TimetableConstraintConfig,
    ConstraintValidator, ConstraintViolation
)
from app.models import Course, Faculty, Classroom, PredefinedSlot, StudentBatch, Department
from app.schemas.timetable import TimetableGenerationRequest, OptimizationResult

logger = logging.getLogger(__name__)


@dataclass
class TimetableVariable:
    """Represents a CP-SAT variable for timetable assignment."""
    course_id: UUID
    faculty_id: UUID
    batch_id: UUID
    room_id: UUID
    slot_id: UUID
    cp_var: cp_model.IntVar
    day: int        # 0=Monday, 1=Tuesday, etc.
    period: int     # Period number in the day (derived from slot timings index)


@dataclass
class OptimizationProblem:
    """Complete problem definition for timetable optimization."""
    courses: List[Course]
    faculty: List[Faculty]
    rooms: List[Classroom]
    batches: List[StudentBatch]
    time_slots: List[PredefinedSlot]

    # Constraint matrices
    faculty_availability: Dict[UUID, Set[UUID]] = field(default_factory=dict)  # faculty_id -> available_slot_ids
    room_features_matrix: Dict[UUID, Set[str]] = field(default_factory=dict)   # room_id -> available_features
    course_requirements: Dict[UUID, Set[str]] = field(default_factory=dict)    # course_id -> required_features
    faculty_subjects: Dict[UUID, Set[str]] = field(default_factory=dict)       # faculty_id -> teachable_subjects

    # Preferences (for soft constraints)
    faculty_preferred_slots: Dict[UUID, List[Tuple[UUID, int]]] = field(default_factory=dict)  # faculty_id -> [(slot_id, weight)]
    batch_preferred_slots: Dict[UUID, List[Tuple[UUID, int]]] = field(default_factory=dict)    # batch_id -> [(slot_id, weight)]

    def validate(self) -> List[str]:
        """Validate problem definition and return any issues."""
        issues = []

        if not self.courses:
            issues.append("No courses defined")
        if not self.faculty:
            issues.append("No faculty defined")
        if not self.rooms:
            issues.append("No rooms defined")
        if not self.time_slots:
            issues.append("No time slots defined")

        return issues


class CPSATTimetableEngine:
    """CP-SAT based timetable optimization engine."""

    def __init__(self, config: TimetableConstraintConfig):
        self.config = config
        self.validator = ConstraintValidator(config)
        self.model = None
        self.solver = None
        self.variables: List[TimetableVariable] = []
        self.problem: Optional[OptimizationProblem] = None

    def generate_timetable(
        self,
        db: Session,
        request: TimetableGenerationRequest
    ) -> OptimizationResult:
        """
        Main entry point for timetable generation.

        Args:
            db: Database session
            request: Timetable generation parameters

        Returns:
            Optimization result with solution or error details
        """
        try:
            logger.info(f"Starting timetable generation for institution {request.institution_id}")

            # Step 1: Load and prepare problem data
            self.problem = self._load_problem_data(db, request)
            validation_issues = self.problem.validate()
            if validation_issues:
                return OptimizationResult(
                    success=False,
                    error_message="Problem validation failed: " + "; ".join(validation_issues),
                    generation_time=0
                )

            # Step 2: Create CP-SAT model
            start_time = datetime.now()
            self._create_model()

            # Step 3: Add variables
            self._create_variables()

            # Step 4: Add hard constraints
            self._add_hard_constraints()

            # Step 5: Add soft constraints
            if self.config.enable_soft_constraints:
                self._add_soft_constraints()

            # Step 6: Solve the problem
            solution = self._solve()

            generation_time = (datetime.now() - start_time).total_seconds()

            if solution:
                # Step 7: Validate solution
                violations = self.validator.validate_hard_constraints(solution)
                if violations and self.config.max_constraint_violations == 0:
                    return OptimizationResult(
                        success=False,
                        error_message=f"Solution has {len(violations)} constraint violations",
                        constraint_violations=violations,
                        generation_time=generation_time
                    )

                # Step 8: Calculate quality metrics
                penalty_score = self.validator.calculate_soft_constraint_penalty(solution)

                return OptimizationResult(
                    success=True,
                    timetable_data=solution,
                    penalty_score=penalty_score,
                    constraint_violations=violations,
                    generation_time=generation_time,
                    solver_statistics=self._get_solver_statistics()
                )
            else:
                return OptimizationResult(
                    success=False,
                    error_message="No feasible solution found within time limit",
                    generation_time=generation_time,
                    solver_statistics=self._get_solver_statistics()
                )

        except Exception as e:
            logger.error(f"Timetable generation failed: {str(e)}")
            return OptimizationResult(
                success=False,
                error_message=f"Optimization failed: {str(e)}",
                generation_time=0
            )

    def _load_problem_data(
        self,
        db: Session,
        request: TimetableGenerationRequest
    ) -> OptimizationProblem:
        """Load all necessary data for the optimization problem."""

        # Load courses for the institution (filter by batch semester if provided)
        courses_query = db.query(Course).filter(
            Course.institution_id == request.institution_id,
            Course.deleted_at.is_(None)
        )
        courses = courses_query.all()

        # Load faculty
        faculty = db.query(Faculty).filter(
            Faculty.institution_id == request.institution_id,
            Faculty.deleted_at.is_(None)
        ).all()

        # Load rooms (Classroom has deleted_at)
        rooms = db.query(Classroom).filter(
            Classroom.institution_id == request.institution_id,
            Classroom.deleted_at.is_(None)
        ).all()

        # Load batches
        batches = db.query(StudentBatch).filter(
            StudentBatch.institution_id == request.institution_id,
            StudentBatch.deleted_at.is_(None)
        ).all()

        # Load time slots — PredefinedSlot has no deleted_at column
        time_slots = db.query(PredefinedSlot).filter(
            PredefinedSlot.institution_id == request.institution_id
        ).all()

        # Build constraint matrices
        problem = OptimizationProblem(
            courses=courses,
            faculty=faculty,
            rooms=rooms,
            batches=batches,
            time_slots=time_slots
        )

        # Build faculty availability matrix (Faculty has no availability_pattern — default all available)
        for fac in faculty:
            problem.faculty_availability[fac.id] = {slot.id for slot in time_slots}

        # Build room features matrix
        for room in rooms:
            problem.room_features_matrix[room.id] = set(room.features or [])

        # Build course requirements matrix
        for course in courses:
            problem.course_requirements[course.id] = set(course.required_features or [])

        # Build faculty subjects matrix
        for fac in faculty:
            problem.faculty_subjects[fac.id] = set(fac.subjects_can_teach or [])

        return problem

    def _create_model(self):
        """Initialize the CP-SAT model."""
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()

        # Set solver parameters
        self.solver.parameters.max_time_in_seconds = self.config.time_limit_seconds
        self.solver.parameters.num_search_workers = 4  # Use multiple threads
        self.solver.parameters.log_search_progress = True

    def _create_variables(self):
        """Create CP-SAT variables for the timetable problem."""
        self.variables = []

        # PredefinedSlot.timings is JSONB: array of {day, start, end}
        # We expand each slot into per-timing entries for scheduling
        for course in self.problem.courses:
            for faculty in self.problem.faculty:
                for batch in self.problem.batches:
                    for room in self.problem.rooms:
                        for slot in self.problem.time_slots:
                            # Only create variables for feasible assignments
                            if self._is_feasible_assignment(course, faculty, batch, room, slot):
                                # Use first timing entry for day/period info
                                timings = slot.timings if isinstance(slot.timings, list) else []
                                day = timings[0].get("day", 0) if timings else 0
                                period = 0  # index within day, approximated

                                var_name = f"assign_{course.id}_{faculty.id}_{batch.id}_{room.id}_{slot.id}"
                                cp_var = self.model.NewBoolVar(var_name)

                                timetable_var = TimetableVariable(
                                    course_id=course.id,
                                    faculty_id=faculty.id,
                                    batch_id=batch.id,
                                    room_id=room.id,
                                    slot_id=slot.id,
                                    cp_var=cp_var,
                                    day=day,
                                    period=period
                                )
                                self.variables.append(timetable_var)

        logger.info(f"Created {len(self.variables)} decision variables")

    def _is_feasible_assignment(
        self,
        course: Course,
        faculty: Faculty,
        batch: StudentBatch,
        room: Classroom,
        slot: PredefinedSlot
    ) -> bool:
        """Check if an assignment is potentially feasible (pre-filtering)."""

        # Check faculty availability
        if slot.id not in self.problem.faculty_availability.get(faculty.id, set()):
            return False

        # Check room capacity
        if room.capacity < (course.expected_students or 0):
            return False

        # Check room features
        required_features = self.problem.course_requirements.get(course.id, set())
        available_features = self.problem.room_features_matrix.get(room.id, set())
        if not required_features.issubset(available_features):
            return False

        return True

    def _add_hard_constraints(self):
        """Add all hard constraints to the model."""

        # HC001: Faculty No Overlap - Each faculty can teach at most one course per time slot
        faculty_slot_vars = {}
        for var in self.variables:
            key = (var.faculty_id, var.slot_id)
            if key not in faculty_slot_vars:
                faculty_slot_vars[key] = []
            faculty_slot_vars[key].append(var.cp_var)

        for (faculty_id, slot_id), vars_list in faculty_slot_vars.items():
            self.model.Add(sum(vars_list) <= 1)

        # HC002: Batch No Overlap - Each batch can attend at most one course per time slot
        batch_slot_vars = {}
        for var in self.variables:
            key = (var.batch_id, var.slot_id)
            if key not in batch_slot_vars:
                batch_slot_vars[key] = []
            batch_slot_vars[key].append(var.cp_var)

        for (batch_id, slot_id), vars_list in batch_slot_vars.items():
            self.model.Add(sum(vars_list) <= 1)

        # HC003: Room No Overlap - Each room can host at most one course per time slot
        room_slot_vars = {}
        for var in self.variables:
            key = (var.room_id, var.slot_id)
            if key not in room_slot_vars:
                room_slot_vars[key] = []
            room_slot_vars[key].append(var.cp_var)

        for (room_id, slot_id), vars_list in room_slot_vars.items():
            self.model.Add(sum(vars_list) <= 1)

        # HC007: Course Assignment - Each course must be assigned exactly once
        for course in self.problem.courses:
            course_vars = [var.cp_var for var in self.variables if var.course_id == course.id]
            if course_vars:
                self.model.Add(sum(course_vars) == 1)

        logger.info("Added all hard constraints")

    def _add_soft_constraints(self):
        """Add soft constraints as optimization objectives."""

        # Create penalty variables for soft constraint violations
        penalty_vars = []

        # Workload balance penalty
        faculty_workloads = {}
        for faculty in self.problem.faculty:
            faculty_vars = [var.cp_var for var in self.variables if var.faculty_id == faculty.id]
            if faculty_vars:
                workload_var = self.model.NewIntVar(0, len(faculty_vars), f"workload_{faculty.id}")
                self.model.Add(workload_var == sum(faculty_vars))
                faculty_workloads[faculty.id] = workload_var

        # Add workload balance constraint
        if len(faculty_workloads) > 1:
            workload_values = list(faculty_workloads.values())
            for i in range(len(workload_values)):
                for j in range(i + 1, len(workload_values)):
                    diff_var = self.model.NewIntVar(-100, 100, f"workload_diff_{i}_{j}")
                    self.model.Add(diff_var == workload_values[i] - workload_values[j])
                    abs_diff_var = self.model.NewIntVar(0, 100, f"abs_workload_diff_{i}_{j}")
                    self.model.AddAbsEquality(abs_diff_var, diff_var)
                    penalty_vars.append(abs_diff_var * self.config.soft_constraint_weights.get(SoftConstraints.WORKLOAD_BALANCE, 0))

        # Minimize total penalty
        if penalty_vars:
            total_penalty = self.model.NewIntVar(0, sum([100000] * len(penalty_vars)), "total_penalty")
            self.model.Add(total_penalty == sum(penalty_vars))
            self.model.Minimize(total_penalty)

        logger.info(f"Added {len(penalty_vars)} soft constraint penalties")

    def _solve(self) -> Optional[Dict[str, Any]]:
        """Solve the CP-SAT model and return solution."""

        logger.info("Starting CP-SAT solver...")
        status = self.solver.Solve(self.model)

        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            logger.info(f"Solution found with status: {self.solver.StatusName(status)}")
            return self._extract_solution()
        else:
            logger.warning(f"No solution found. Status: {self.solver.StatusName(status)}")
            return None

    def _extract_solution(self) -> Dict[str, Any]:
        """Extract the solution from the solved model."""

        assignments = []
        for var in self.variables:
            if self.solver.Value(var.cp_var) == 1:
                assignments.append({
                    "course_id": str(var.course_id),
                    "faculty_id": str(var.faculty_id),
                    "batch_id": str(var.batch_id),
                    "room_id": str(var.room_id),
                    "slot_id": str(var.slot_id),
                    "day": var.day,
                    "period": var.period
                })

        return {
            "assignments": assignments,
            "total_courses": len(self.problem.courses),
            "assigned_courses": len(assignments),
            "solver_status": self.solver.StatusName(self.solver.status),
            "objective_value": self.solver.ObjectiveValue() if self.solver.ObjectiveValue() else 0
        }

    def _get_solver_statistics(self) -> Dict[str, Any]:
        """Get solver performance statistics."""
        return {
            "wall_time": self.solver.WallTime(),
            "branches": self.solver.NumBranches(),
            "conflicts": self.solver.NumConflicts(),
            "binary_propagations": self.solver.NumBinaryPropagations(),
            "integer_propagations": self.solver.NumIntegerPropagations()
        }

    def _parse_availability_pattern(
        self,
        pattern: Dict[str, Any],
        time_slots: List[PredefinedSlot]
    ) -> Set[UUID]:
        """Parse faculty availability pattern into time slot IDs."""
        available_slots = set()

        for day_name, periods in pattern.items():
            day_num = self._day_name_to_number(day_name)
            for period in periods:
                for slot in time_slots:
                    timings = slot.timings if isinstance(slot.timings, list) else []
                    for timing in timings:
                        if timing.get("day") == day_num:
                            available_slots.add(slot.id)

        return available_slots

    def _day_name_to_number(self, day_name: str) -> int:
        """Convert day name to number (0=Monday, 1=Tuesday, etc.)."""
        day_mapping = {
            "monday": 0, "tuesday": 1, "wednesday": 2,
            "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6
        }
        return day_mapping.get(day_name.lower(), 0)


# Factory function for creating the optimization engine
def create_timetable_engine(config: TimetableConstraintConfig = None) -> CPSATTimetableEngine:
    """Create a new timetable optimization engine instance."""
    if config is None:
        config = TimetableConstraintConfig()

    return CPSATTimetableEngine(config)