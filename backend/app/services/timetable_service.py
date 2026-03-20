"""
Timetable generation service layer.
Business logic for timetable generation, optimization, and management.
"""
import logging
from typing import Dict, List, Any, Optional, Tuple
from uuid import UUID, uuid4
from datetime import datetime, timedelta
import json
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.optimization import CPSATTimetableEngine, create_timetable_engine
from app.core.constraints import TimetableConstraintConfig, ConstraintValidator
from app.models import (
    Timetable, TimetableStatus as DBTimetableStatus,
    Course, Faculty, Classroom, PredefinedSlot, StudentBatch,
    TimetableEntry as DBTimetableAssignment
)
from app.schemas.timetable import (
    TimetableGenerationRequest, TimetableResponse, TimetableAssignment,
    TimetableGrid, OptimizationResult, TimetableStatus, OptimizationMode
)
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


class TimetableGenerationService(BaseService[Timetable, None, None]):
    """Service for handling timetable generation and management."""

    def __init__(self):
        super().__init__(Timetable)
        self.validator = ConstraintValidator(TimetableConstraintConfig())

    def generate_timetable(
        self,
        db: Session,
        request: TimetableGenerationRequest
    ) -> TimetableResponse:
        """
        Generate a complete timetable for an institution and semester.

        Args:
            db: Database session
            request: Timetable generation parameters

        Returns:
            Complete timetable response with assignments and metadata
        """
        logger.info(f"Starting timetable generation for institution {request.institution_id}, semester {request.semester}")

        try:
            # Step 1: Create timetable record
            timetable = self._create_timetable_record(db, request)

            # Step 2: Configure optimization engine
            config = self._build_optimization_config(request)
            engine = create_timetable_engine(config)

            # Step 3: Generate optimized timetable
            start_time = datetime.now()
            optimization_result = engine.generate_timetable(db, request)

            if not optimization_result.success:
                # Update timetable status to archived (closest to failed in our model)
                timetable.status = DBTimetableStatus.ARCHIVED
                timetable.metrics = {
                    "error_message": optimization_result.error_message,
                    "generation_time": optimization_result.generation_time
                }
                db.commit()

                return TimetableResponse(
                    id=timetable.id,
                    created_at=timetable.created_at,
                    updated_at=timetable.updated_at,
                    institution_id=timetable.institution_id,
                    semester=timetable.semester,
                    status=TimetableStatus.FAILED,
                    generated_at=start_time,
                    generation_time=optimization_result.generation_time,
                    optimization_mode=request.optimization_mode,
                    assignments=[],
                    total_courses=0,
                    assigned_courses=0,
                    assignment_rate=0.0,
                    constraint_violations=optimization_result.constraint_violations or []
                )

            # Step 4: Save assignments to database
            assignments = self._save_assignments(db, timetable, optimization_result.timetable_data)

            # Step 5: Update timetable record
            generation_time = (datetime.now() - start_time).total_seconds()
            timetable.status = DBTimetableStatus.ACTIVE
            timetable.metrics = {
                "generation_time": generation_time,
                "penalty_score": optimization_result.penalty_score,
                "assignment_count": len(assignments),
                "solver_statistics": optimization_result.solver_statistics
            }
            db.commit()

            # Step 6: Build response
            response = self._build_timetable_response(
                timetable, assignments, optimization_result, request
            )

            logger.info(f"Timetable generation completed in {generation_time:.2f} seconds")
            return response

        except Exception as e:
            logger.error(f"Timetable generation failed: {str(e)}")
            db.rollback()
            raise

    def get_timetable(
        self,
        db: Session,
        timetable_id: UUID,
        include_assignments: bool = True,
        format_as_grid: bool = False
    ) -> Optional[TimetableResponse]:
        """
        Retrieve a timetable with optional formatting.
        """
        timetable = self.get_by_id(db, timetable_id)
        if not timetable:
            return None

        assignments = []
        if include_assignments:
            db_assignments = db.query(DBTimetableAssignment).filter(
                DBTimetableAssignment.timetable_id == timetable_id
            ).all()
            assignments = [self._convert_assignment(assignment) for assignment in db_assignments]

        metrics = timetable.metrics or {}
        generation_time = metrics.get("generation_time", 0.0)
        assignment_count = metrics.get("assignment_count", len(assignments))

        response = TimetableResponse(
            id=timetable.id,
            created_at=timetable.created_at,
            updated_at=timetable.updated_at,
            institution_id=timetable.institution_id,
            semester=timetable.semester,
            status=TimetableStatus.COMPLETED if timetable.status == DBTimetableStatus.ACTIVE else TimetableStatus.PENDING,
            generated_at=timetable.created_at,
            generation_time=generation_time,
            optimization_mode=OptimizationMode.BALANCED,
            assignments=assignments,
            total_courses=assignment_count,
            assigned_courses=len(assignments),
            assignment_rate=0.0,
            penalty_score=metrics.get("penalty_score"),
            solver_statistics=metrics.get("solver_statistics")
        )

        if format_as_grid and assignments:
            response.grid_view = self._create_grid_view(assignments, db, timetable.institution_id)

        return response

    def get_batch_timetable(
        self,
        db: Session,
        timetable_id: UUID,
        batch_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get timetable view specific to a student batch."""
        assignments = db.query(DBTimetableAssignment).filter(
            DBTimetableAssignment.timetable_id == timetable_id,
            DBTimetableAssignment.batch_id == batch_id
        ).all()

        if not assignments:
            return None

        api_assignments = [self._convert_assignment(assignment) for assignment in assignments]

        total_hours = len(assignments)  # Approximate
        unique_faculty = len(set(str(a.faculty_id) for a in assignments))
        days_with_classes = len(set(a.day_of_week for a in api_assignments))

        batch = db.query(StudentBatch).filter(StudentBatch.id == batch_id).first()

        return {
            "batch_id": batch_id,
            "batch_name": batch.batch_name if batch else "Unknown",
            "assignments": api_assignments,
            "total_hours_per_week": total_hours,
            "average_gap_time": 0.0,
            "longest_day_hours": 0,
            "days_with_classes": days_with_classes,
            "faculty_diversity": unique_faculty,
            "course_distribution": self._calculate_course_distribution(api_assignments)
        }

    def _create_timetable_record(
        self,
        db: Session,
        request: TimetableGenerationRequest
    ) -> Timetable:
        """Create initial timetable record in database."""

        total_courses = db.query(Course).filter(
            Course.institution_id == request.institution_id,
            Course.deleted_at.is_(None)
        ).count()

        timetable = Timetable(
            institution_id=request.institution_id,
            semester=request.semester,
            name=f"Timetable {request.semester}",
            status=DBTimetableStatus.DRAFT,
            generation_params={
                "optimization_mode": request.optimization_mode,
                "time_limit_minutes": request.time_limit_minutes,
                "enable_soft_constraints": request.enable_soft_constraints,
                "max_solutions": request.max_solutions,
                "total_courses": total_courses
            }
        )

        db.add(timetable)
        db.commit()
        db.refresh(timetable)
        return timetable

    def _build_optimization_config(
        self,
        request: TimetableGenerationRequest
    ) -> TimetableConstraintConfig:
        """Build optimization configuration from request."""

        config = TimetableConstraintConfig(
            time_limit_seconds=request.time_limit_minutes * 60,
            enable_soft_constraints=request.enable_soft_constraints,
            solution_limit=request.max_solutions
        )

        if request.soft_constraint_weights:
            config.soft_constraint_weights.update(request.soft_constraint_weights)

        if request.optimization_mode == OptimizationMode.FAST:
            config.time_limit_seconds = min(config.time_limit_seconds, 120)
            config.optimize_for_quality = False
        elif request.optimization_mode == OptimizationMode.QUALITY:
            config.time_limit_seconds = max(config.time_limit_seconds, 300)
            config.optimize_for_quality = True

        return config

    def _save_assignments(
        self,
        db: Session,
        timetable: Timetable,
        solution_data: Dict[str, Any]
    ) -> List[DBTimetableAssignment]:
        """Save optimization solution as database assignments."""

        assignments = []

        for assignment_data in solution_data.get("assignments", []):
            db_assignment = DBTimetableAssignment(
                timetable_id=timetable.id,
                course_id=UUID(assignment_data["course_id"]),
                faculty_id=UUID(assignment_data["faculty_id"]),
                batch_id=UUID(assignment_data["batch_id"]),
                classroom_id=UUID(assignment_data["room_id"]),   # TimetableEntry uses classroom_id
                slot_id=UUID(assignment_data["slot_id"]),
                day_of_week=assignment_data.get("day", 0),
                time_slot=f"period-{assignment_data.get('period', 0)}"
            )

            db.add(db_assignment)
            assignments.append(db_assignment)

        db.commit()
        return assignments

    def _build_timetable_response(
        self,
        timetable: Timetable,
        assignments: List[DBTimetableAssignment],
        optimization_result: OptimizationResult,
        request: TimetableGenerationRequest
    ) -> TimetableResponse:
        """Build complete timetable response."""

        api_assignments = [self._convert_assignment(assignment) for assignment in assignments]
        faculty_utilization = self._calculate_faculty_utilization(assignments)
        room_utilization = self._calculate_room_utilization(assignments)

        metrics = timetable.metrics or {}
        generation_time = metrics.get("generation_time", optimization_result.generation_time)

        total_courses = (timetable.generation_params or {}).get("total_courses", 0)

        response = TimetableResponse(
            id=timetable.id,
            created_at=timetable.created_at,
            updated_at=timetable.updated_at,
            institution_id=timetable.institution_id,
            semester=timetable.semester,
            status=TimetableStatus.COMPLETED,
            generated_at=timetable.created_at,
            generation_time=generation_time,
            optimization_mode=request.optimization_mode,
            assignments=api_assignments,
            total_courses=total_courses,
            assigned_courses=len(assignments),
            assignment_rate=0.0,
            penalty_score=optimization_result.penalty_score,
            constraint_violations=optimization_result.constraint_violations or [],
            faculty_utilization=faculty_utilization,
            room_utilization=room_utilization,
            solver_statistics=optimization_result.solver_statistics
        )

        if request.solution_format == "grid":
            response.grid_view = self._create_grid_view(api_assignments, None, timetable.institution_id)

        return response

    def _convert_assignment(self, db_assignment: DBTimetableAssignment) -> TimetableAssignment:
        """Convert database assignment to API format."""
        return TimetableAssignment(
            course_id=db_assignment.course_id,
            course_code="N/A",
            course_name="N/A",
            faculty_id=db_assignment.faculty_id,
            faculty_name="N/A",
            faculty_employee_id="N/A",
            batch_id=db_assignment.batch_id,
            batch_name="N/A",
            expected_students=0,
            room_id=db_assignment.classroom_id,   # classroom_id -> room_id in schema
            room_number="N/A",
            room_building=None,
            slot_id=db_assignment.slot_id,
            day_of_week=db_assignment.day_of_week or 0,
            period_number=0,
            start_time="00:00",
            end_time="00:00",
            duration_minutes=60,
            course_type=None,
            required_features=[]
        )

    def _create_grid_view(
        self,
        assignments: List[TimetableAssignment],
        db: Optional[Session],
        institution_id: UUID
    ) -> TimetableGrid:
        """Create grid-based view of timetable."""

        grid = {}
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

        for day in days:
            grid[day] = {}

        for assignment in assignments:
            day_name = days[assignment.day_of_week] if assignment.day_of_week < len(days) else "Unknown"
            period_key = str(assignment.period_number)
            if day_name in grid:
                grid[day_name][period_key] = assignment

        total_assignments = len(assignments)
        total_slots = len(days) * 8
        empty_slots = total_slots - total_assignments
        utilization = (total_assignments / total_slots) * 100 if total_slots > 0 else 0

        return TimetableGrid(
            days=days,
            periods=[{"number": i, "start_time": f"{8+i}:00", "end_time": f"{9+i}:00"} for i in range(1, 9)],
            grid=grid,
            total_assignments=total_assignments,
            empty_slots=empty_slots,
            utilization_percentage=round(utilization, 2)
        )

    def _calculate_assignment_rate(self, timetable: Timetable) -> float:
        """Calculate percentage of courses successfully assigned."""
        params = timetable.generation_params or {}
        total = params.get("total_courses", 0)
        metrics = timetable.metrics or {}
        assigned = metrics.get("assignment_count", 0)
        if not total:
            return 0.0
        return round((assigned / total) * 100, 2)

    def _calculate_faculty_utilization(self, assignments: List[DBTimetableAssignment]) -> Dict[str, float]:
        """Calculate utilization percentage for each faculty."""
        faculty_hours = {}
        for assignment in assignments:
            faculty_id = str(assignment.faculty_id)
            faculty_hours[faculty_id] = faculty_hours.get(faculty_id, 0) + 1

        utilization = {}
        for faculty_id, hours in faculty_hours.items():
            utilization[faculty_id] = min((hours / 20) * 100, 100)
        return utilization

    def _calculate_room_utilization(self, assignments: List[DBTimetableAssignment]) -> Dict[str, float]:
        """Calculate utilization percentage for each room."""
        room_hours = {}
        for assignment in assignments:
            room_id = str(assignment.classroom_id)
            room_hours[room_id] = room_hours.get(room_id, 0) + 1

        utilization = {}
        for room_id, hours in room_hours.items():
            utilization[room_id] = min((hours / 40) * 100, 100)
        return utilization

    def _calculate_course_distribution(self, assignments: List[TimetableAssignment]) -> Dict[str, int]:
        """Calculate distribution of course types."""
        distribution = {}
        for assignment in assignments:
            course_type = assignment.course_type or "unknown"
            distribution[course_type] = distribution.get(course_type, 0) + 1
        return distribution


# Create singleton instance
timetable_service = TimetableGenerationService()