#!/usr/bin/env python3
"""
CP-SAT Engine Test Script
Tests the core timetable optimization engine to ensure it's working correctly.
"""

import sys
import os
import logging
from typing import Dict, Any
from datetime import datetime
from uuid import uuid4

# Add the backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.core.optimization import CPSATTimetableEngine, OptimizationProblem
from app.core.constraints import TimetableConstraintConfig, HardConstraints
from app.schemas.timetable import TimetableGenerationRequest, OptimizationMode

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MockCourse:
    """Mock course for testing."""
    def __init__(self, id, code, subject_area, expected_students=30, required_features=None):
        self.id = uuid4()
        self.code = code
        self.subject_area = subject_area
        self.expected_students = expected_students
        self.required_features = required_features or []
        self.semester = "Fall 2026"
        self.department_id = uuid4()


class MockFaculty:
    """Mock faculty for testing."""
    def __init__(self, id, name, subjects_can_teach, availability_pattern=None):
        self.id = uuid4()
        self.name = name
        self.subjects_can_teach = subjects_can_teach
        self.availability_pattern = availability_pattern
        self.department_id = uuid4()


class MockClassroom:
    """Mock classroom for testing."""
    def __init__(self, id, room_number, capacity, features=None):
        self.id = uuid4()
        self.room_number = room_number
        self.capacity = capacity
        self.features = features or []


class MockTimeSlot:
    """Mock time slot for testing."""
    def __init__(self, id, day_of_week, period_number):
        self.id = uuid4()
        self.day_of_week = day_of_week  # 0=Monday, 1=Tuesday, etc.
        self.period_number = period_number


class MockStudentBatch:
    """Mock student batch for testing."""
    def __init__(self, id, batch_name, student_count=30):
        self.id = uuid4()
        self.batch_name = batch_name
        self.student_count = student_count


def create_test_problem() -> OptimizationProblem:
    """Create a small test problem for CP-SAT validation."""

    print("🔧 Creating test problem...")

    # Create test courses
    courses = [
        MockCourse(1, "CS101", "Computer Science", 30, ["projector"]),
        MockCourse(2, "CS201", "Computer Science", 25, ["projector", "computers"]),
        MockCourse(3, "MATH101", "Mathematics", 40, ["projector"]),
        MockCourse(4, "ENG101", "English", 35, [])
    ]

    # Create test faculty
    faculty = [
        MockFaculty(1, "Dr. Smith", ["Computer Science"]),
        MockFaculty(2, "Dr. Johnson", ["Computer Science", "Mathematics"]),
        MockFaculty(3, "Dr. Brown", ["Mathematics"]),
        MockFaculty(4, "Dr. Davis", ["English"])
    ]

    # Create test rooms
    rooms = [
        MockClassroom(1, "101", 50, ["projector"]),
        MockClassroom(2, "102", 40, ["projector", "computers"]),
        MockClassroom(3, "103", 60, ["projector"]),
        MockClassroom(4, "104", 30, [])
    ]

    # Create test time slots (2 days, 3 periods each = 6 slots)
    time_slots = []
    for day in range(2):  # Monday, Tuesday
        for period in range(1, 4):  # Periods 1, 2, 3
            time_slots.append(MockTimeSlot(day*3 + period, day, period))

    # Create test student batches
    batches = [
        MockStudentBatch(1, "CS-2023-A", 30),
        MockStudentBatch(2, "CS-2023-B", 25),
        MockStudentBatch(3, "MATH-2023", 40),
        MockStudentBatch(4, "ENG-2023", 35)
    ]

    # Create optimization problem
    problem = OptimizationProblem(
        courses=courses,
        faculty=faculty,
        rooms=rooms,
        batches=batches,
        time_slots=time_slots
    )

    # Build constraint matrices
    # Faculty availability (all faculty available for all slots)
    for fac in faculty:
        problem.faculty_availability[fac.id] = {slot.id for slot in time_slots}

    # Room features
    for room in rooms:
        problem.room_features_matrix[room.id] = set(room.features)

    # Course requirements
    for course in courses:
        problem.course_requirements[course.id] = set(course.required_features)

    # Faculty subjects
    for fac in faculty:
        problem.faculty_subjects[fac.id] = set(fac.subjects_can_teach)

    print(f"✅ Created problem with:")
    print(f"   - {len(courses)} courses")
    print(f"   - {len(faculty)} faculty")
    print(f"   - {len(rooms)} rooms")
    print(f"   - {len(time_slots)} time slots")
    print(f"   - {len(batches)} student batches")

    return problem


def test_cp_sat_engine():
    """Test the CP-SAT optimization engine."""

    print("🚀 Testing CP-SAT Optimization Engine")
    print("=" * 50)

    try:
        # 1. Test constraint definitions
        print("1️⃣ Testing constraint definitions...")
        constraints = HardConstraints.get_all_constraints()
        print(f"   ✅ Found {len(constraints)} hard constraints:")
        for constraint in constraints:
            print(f"      - {constraint}: {HardConstraints.get_constraint_description(constraint)}")

        # 2. Create optimization configuration
        print("\\n2️⃣ Creating optimization configuration...")
        config = TimetableConstraintConfig(
            time_limit_seconds=30,  # Short test
            enable_soft_constraints=True,
            max_constraint_violations=0
        )
        print(f"   ✅ Configuration created (time limit: {config.time_limit_seconds}s)")

        # 3. Initialize engine
        print("\\n3️⃣ Initializing CP-SAT engine...")
        engine = CPSATTimetableEngine(config)
        print("   ✅ Engine initialized successfully")

        # 4. Create test problem
        print("\\n4️⃣ Setting up test problem...")
        problem = create_test_problem()
        engine.problem = problem

        # Validate problem
        validation_issues = problem.validate()
        if validation_issues:
            print(f"   ❌ Problem validation failed: {validation_issues}")
            return False
        print("   ✅ Problem validation passed")

        # 5. Create CP-SAT model
        print("\\n5️⃣ Creating CP-SAT model...")
        engine._create_model()
        print("   ✅ CP-SAT model created")

        # 6. Create variables
        print("\\n6️⃣ Creating decision variables...")
        engine._create_variables()
        print(f"   ✅ Created {len(engine.variables)} decision variables")

        # 7. Add hard constraints
        print("\\n7️⃣ Adding hard constraints...")
        engine._add_hard_constraints()
        print("   ✅ Hard constraints added")

        # 8. Add soft constraints
        print("\\n8️⃣ Adding soft constraints...")
        engine._add_soft_constraints()
        print("   ✅ Soft constraints added")

        # 9. Test solver
        print("\\n9️⃣ Running CP-SAT solver...")
        start_time = datetime.now()
        solution = engine._solve()
        solve_time = (datetime.now() - start_time).total_seconds()

        if solution:
            print(f"   ✅ Solution found in {solve_time:.2f} seconds!")
            print(f"   📊 Solution details:")
            print(f"      - Total courses: {solution.get('total_courses', 0)}")
            print(f"      - Assigned courses: {solution.get('assigned_courses', 0)}")
            print(f"      - Solver status: {solution.get('solver_status', 'Unknown')}")
            print(f"      - Objective value: {solution.get('objective_value', 0)}")
            print(f"      - Assignment rate: {(solution.get('assigned_courses', 0) / solution.get('total_courses', 1)) * 100:.1f}%")

            # Show some assignments
            assignments = solution.get('assignments', [])
            print(f"\\n   📅 Sample assignments:")
            for i, assignment in enumerate(assignments[:3]):  # Show first 3
                print(f"      {i+1}. Course {assignment['course_id'][:8]}... → "
                      f"Faculty {assignment['faculty_id'][:8]}... → "
                      f"Room {assignment['room_id'][:8]}... → "
                      f"Day {assignment['day']}, Period {assignment['period']}")

            if len(assignments) > 3:
                print(f"      ... and {len(assignments) - 3} more assignments")

        else:
            print("   ❌ No solution found")
            return False

        # 10. Test solver statistics
        print("\\n🔟 Getting solver statistics...")
        stats = engine._get_solver_statistics()
        print(f"   📈 Solver performance:")
        print(f"      - Wall time: {stats.get('wall_time', 0):.3f}s")
        print(f"      - Branches: {stats.get('branches', 0):,}")
        print(f"      - Conflicts: {stats.get('conflicts', 0):,}")
        print(f"      - Propagations: {stats.get('binary_propagations', 0):,}")

        print("\\n🏆 CP-SAT Engine Test PASSED!")
        print("=" * 50)
        return True

    except Exception as e:
        print(f"\\n❌ CP-SAT Engine Test FAILED!")
        print(f"   Error: {str(e)}")
        import traceback
        print(f"   Traceback: {traceback.format_exc()}")
        return False


def test_constraint_system():
    """Test the constraint validation system."""

    print("\\n🔍 Testing Constraint System")
    print("=" * 30)

    try:
        from app.core.constraints import ConstraintValidator, ConstraintViolation, ConstraintType, ConstraintPriority

        # Test constraint configuration
        config = TimetableConstraintConfig()
        validator = ConstraintValidator(config)

        print("✅ Constraint system initialized successfully")

        # Test constraint violation creation
        violation = ConstraintViolation(
            constraint_id="HC001",
            constraint_type=ConstraintType.HARD,
            priority=ConstraintPriority.CRITICAL,
            description="Test violation",
            affected_entities=[{"type": "faculty", "id": "test"}],
            penalty_score=100
        )

        print(f"✅ Constraint violation created: {violation.constraint_id}")
        print("✅ Constraint system test passed")

        return True

    except Exception as e:
        print(f"❌ Constraint system test failed: {str(e)}")
        return False


if __name__ == "__main__":
    print("🧪 CP-SAT Timetable Engine Test Suite")
    print("=" * 60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Test constraint system first
    constraint_test_passed = test_constraint_system()

    # Test CP-SAT engine
    if constraint_test_passed:
        engine_test_passed = test_cp_sat_engine()
    else:
        print("⏭️  Skipping CP-SAT engine test due to constraint system failure")
        engine_test_passed = False

    # Final results
    print("\\n" + "=" * 60)
    if constraint_test_passed and engine_test_passed:
        print("🎉 ALL TESTS PASSED! CP-SAT Engine is working correctly.")
        print("\\n✅ Your timetable optimization system is ready to use!")
        print("\\n🚀 Next steps:")
        print("   1. Start the backend: cd backend && uvicorn app.main:app --reload")
        print("   2. Start Celery worker: cd backend && celery -A app.celery_app worker --loglevel=info")
        print("   3. Start Redis: redis-server (for Celery)")
        print("   4. Test the frontend: cd frontend && npm run dev")
        exit_code = 0
    else:
        print("❌ TESTS FAILED! CP-SAT Engine needs debugging.")
        print("\\nCheck the error messages above and fix any issues.")
        exit_code = 1

    print(f"\\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    sys.exit(exit_code)