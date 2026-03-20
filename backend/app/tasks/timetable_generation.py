"""
Celery tasks for timetable generation.
Handles asynchronous timetable optimization with progress tracking.
"""
import logging
from typing import Dict, Any, Optional
from uuid import UUID, uuid4
from datetime import datetime
from sqlalchemy.orm import Session

from app.celery_app import celery_app, ProgressTracker, handle_task_error, RETRY_CONFIG
from app.db.session import SessionLocal
from app.core.optimization import create_timetable_engine
from app.core.constraints import TimetableConstraintConfig
from app.schemas.timetable import TimetableGenerationRequest, OptimizationMode, TimetableStatus
from app.models import (
    Timetable, TimetableStatus as DBTimetableStatus,
    TimetableEntry as DBTimetableAssignment
)
from app.services.timetable_service import timetable_service

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, **RETRY_CONFIG)
def generate_timetable_async(
    self,
    request_data: Dict[str, Any],
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Asynchronously generate an optimized timetable.
    """
    if not job_id:
        job_id = str(uuid4())

    try:
        request = TimetableGenerationRequest(**request_data)
    except Exception as e:
        handle_task_error(self, e, "Request parsing")
        raise

    progress = ProgressTracker(self, 8)

    db = SessionLocal()
    try:
        logger.info(f"Starting timetable generation job {job_id} for institution {request.institution_id}")

        # Step 1: Create timetable record
        progress.update("Creating timetable record")
        timetable = _create_timetable_record(db, request, job_id)

        # Step 2: Load and validate data
        progress.update("Loading institutional data")
        validation_result = _validate_generation_data(db, request)
        if not validation_result["valid"]:
            raise ValueError(f"Data validation failed: {validation_result['errors']}")

        # Step 3: Configure optimization engine
        progress.update("Configuring optimization engine")
        config = _build_optimization_config(request)
        engine = create_timetable_engine(config)

        # Step 4: Load problem data
        progress.update("Loading problem data", {
            "courses_count": validation_result["counts"]["courses"],
            "faculty_count": validation_result["counts"]["faculty"],
            "rooms_count": validation_result["counts"]["rooms"]
        })

        # Step 5: Generate optimization solution
        progress.update("Running CP-SAT optimization")
        start_time = datetime.now()
        optimization_result = engine.generate_timetable(db, request)
        generation_time = (datetime.now() - start_time).total_seconds()

        if not optimization_result.success:
            timetable.status = DBTimetableStatus.ARCHIVED
            timetable.metrics = {
                "error_message": optimization_result.error_message,
                "generation_time": generation_time
            }
            db.commit()
            raise ValueError(f"Optimization failed: {optimization_result.error_message}")

        # Step 6: Save assignments
        progress.update("Saving timetable assignments", {
            "assignments_count": len(optimization_result.timetable_data.get("assignments", []))
        })
        assignments = _save_assignments(db, timetable, optimization_result.timetable_data)

        # Step 7: Calculate quality metrics
        progress.update("Calculating quality metrics")
        quality_metrics = _calculate_quality_metrics(db, timetable, assignments, optimization_result)

        # Step 8: Finalize timetable
        progress.update("Finalizing timetable")
        timetable.status = DBTimetableStatus.ACTIVE
        timetable.metrics = {
            "generation_time": generation_time,
            "penalty_score": optimization_result.penalty_score,
            "solver_statistics": optimization_result.solver_statistics,
            "assignment_count": len(assignments),
            "quality_metrics": quality_metrics,
            "job_id": job_id
        }
        db.commit()

        result = {
            "job_id": job_id,
            "timetable_id": str(timetable.id),
            "status": "completed",
            "generation_time": generation_time,
            "assignment_count": len(assignments),
            "assignment_rate": quality_metrics.get("assignment_rate", 0),
            "penalty_score": optimization_result.penalty_score,
            "quality_metrics": quality_metrics,
            "solver_statistics": optimization_result.solver_statistics
        }

        progress.complete(result)
        logger.info(f"Timetable generation completed for job {job_id}")
        return result

    except Exception as e:
        logger.error(f"Timetable generation failed for job {job_id}: {str(e)}")

        if 'timetable' in locals():
            timetable.status = DBTimetableStatus.ARCHIVED
            timetable.metrics = {"error_message": str(e)}
            db.commit()

        handle_task_error(self, e, "Timetable generation")
        raise

    finally:
        db.close()


@celery_app.task(bind=True, **RETRY_CONFIG)
def optimize_existing_timetable_async(
    self,
    timetable_id: str,
    optimization_params: Dict[str, Any],
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Asynchronously re-optimize an existing timetable with new parameters.
    """
    if not job_id:
        job_id = str(uuid4())

    progress = ProgressTracker(self, 6)
    db = SessionLocal()

    try:
        logger.info(f"Starting timetable re-optimization job {job_id} for timetable {timetable_id}")

        # Step 1: Load existing timetable
        progress.update("Loading existing timetable")
        timetable = timetable_service.get_by_id(db, UUID(timetable_id))
        if not timetable:
            raise ValueError("Timetable not found")

        # Step 2: Create new optimization request
        progress.update("Preparing optimization parameters")
        request = TimetableGenerationRequest(
            institution_id=timetable.institution_id,
            semester=timetable.semester,
            optimization_mode=optimization_params.get("optimization_mode", OptimizationMode.BALANCED),
            time_limit_minutes=optimization_params.get("time_limit_minutes", 10),
            enable_soft_constraints=optimization_params.get("enable_soft_constraints", True),
            soft_constraint_weights=optimization_params.get("soft_constraint_weights")
        )

        # Step 3: Configure new optimization engine
        progress.update("Configuring optimization engine")
        config = _build_optimization_config(request)
        engine = create_timetable_engine(config)

        # Step 4: Run optimization
        progress.update("Running re-optimization")
        start_time = datetime.now()
        optimization_result = engine.generate_timetable(db, request)
        generation_time = (datetime.now() - start_time).total_seconds()

        if not optimization_result.success:
            raise ValueError(f"Re-optimization failed: {optimization_result.error_message}")

        # Step 5: Create new timetable version
        progress.update("Creating optimized version")
        old_metrics = timetable.metrics or {}
        old_assignment_count = old_metrics.get("assignment_count", 0)
        old_penalty = old_metrics.get("penalty_score", 0)

        new_timetable = Timetable(
            institution_id=timetable.institution_id,
            semester=timetable.semester,
            name=f"{timetable.name} (Re-optimized)",
            status=DBTimetableStatus.ACTIVE,
            generation_params={
                "optimization_mode": request.optimization_mode,
                "parent_job_id": job_id,
                "optimization_type": "re-optimization",
                "parent_timetable_id": str(timetable.id)
            }
        )

        db.add(new_timetable)
        db.commit()
        db.refresh(new_timetable)

        # Step 6: Save new assignments
        progress.update("Saving optimized assignments")
        assignments = _save_assignments(db, new_timetable, optimization_result.timetable_data)
        new_timetable.metrics = {
            "generation_time": generation_time,
            "penalty_score": optimization_result.penalty_score,
            "assignment_count": len(assignments),
            "job_id": job_id
        }
        db.commit()

        result = {
            "job_id": job_id,
            "original_timetable_id": timetable_id,
            "optimized_timetable_id": str(new_timetable.id),
            "status": "completed",
            "generation_time": generation_time,
            "improvement": {
                "penalty_score_change": old_penalty - (optimization_result.penalty_score or 0),
                "assignment_count_change": len(assignments) - old_assignment_count
            }
        }

        progress.complete(result)
        return result

    except Exception as e:
        handle_task_error(self, e, "Timetable re-optimization")
        raise
    finally:
        db.close()


@celery_app.task(bind=True)
def cleanup_old_timetables(self, days_old: int = 30) -> Dict[str, Any]:
    """
    Clean up old timetables and their assignments.
    """
    from datetime import timedelta

    progress = ProgressTracker(self, 3)
    db = SessionLocal()

    try:
        # Step 1: Find old archived timetables
        progress.update("Finding old timetables")
        cutoff_date = datetime.now() - timedelta(days=days_old)

        old_timetables = db.query(Timetable).filter(
            Timetable.created_at < cutoff_date,
            Timetable.status == DBTimetableStatus.ARCHIVED
        ).all()

        # Step 2: Delete assignments
        progress.update(f"Cleaning up {len(old_timetables)} old timetables")
        deleted_assignments = 0
        deleted_timetables = 0

        for timetable in old_timetables:
            assignment_count = db.query(DBTimetableAssignment).filter(
                DBTimetableAssignment.timetable_id == timetable.id
            ).count()

            db.query(DBTimetableAssignment).filter(
                DBTimetableAssignment.timetable_id == timetable.id
            ).delete()

            db.delete(timetable)
            deleted_assignments += assignment_count
            deleted_timetables += 1

        # Step 3: Commit changes
        progress.update("Committing cleanup")
        db.commit()

        result = {
            "deleted_timetables": deleted_timetables,
            "deleted_assignments": deleted_assignments,
            "cutoff_date": cutoff_date.isoformat()
        }

        progress.complete(result)
        return result

    except Exception as e:
        handle_task_error(self, e, "Cleanup")
        raise
    finally:
        db.close()


# Helper functions
def _create_timetable_record(db: Session, request: TimetableGenerationRequest, job_id: str) -> Timetable:
    """Create initial timetable record with job tracking."""
    from app.models import Course

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
            "job_id": job_id,
            "generation_type": "async",
            "total_courses": total_courses
        }
    )

    db.add(timetable)
    db.commit()
    db.refresh(timetable)
    return timetable


def _validate_generation_data(db: Session, request: TimetableGenerationRequest) -> Dict[str, Any]:
    """Validate that sufficient data exists for timetable generation."""
    from app.models import Course, Faculty, Classroom, PredefinedSlot, StudentBatch

    courses = db.query(Course).filter(
        Course.institution_id == request.institution_id,
        Course.deleted_at.is_(None)
    ).count()

    faculty = db.query(Faculty).filter(
        Faculty.institution_id == request.institution_id,
        Faculty.deleted_at.is_(None)
    ).count()

    rooms = db.query(Classroom).filter(
        Classroom.institution_id == request.institution_id,
        Classroom.deleted_at.is_(None)
    ).count()

    # PredefinedSlot has no deleted_at
    time_slots = db.query(PredefinedSlot).filter(
        PredefinedSlot.institution_id == request.institution_id
    ).count()

    batches = db.query(StudentBatch).filter(
        StudentBatch.institution_id == request.institution_id,
        StudentBatch.deleted_at.is_(None)
    ).count()

    errors = []
    if courses == 0:
        errors.append("No courses found for the specified semester")
    if faculty == 0:
        errors.append("No faculty members found")
    if rooms == 0:
        errors.append("No classrooms found")
    if time_slots < 5:
        errors.append("Insufficient time slots (minimum 5 required)")
    if batches == 0:
        errors.append("No student batches found")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "counts": {
            "courses": courses,
            "faculty": faculty,
            "rooms": rooms,
            "time_slots": time_slots,
            "batches": batches
        }
    }


def _build_optimization_config(request: TimetableGenerationRequest) -> TimetableConstraintConfig:
    """Build optimization configuration from async request."""
    config = TimetableConstraintConfig(
        time_limit_seconds=request.time_limit_minutes * 60,
        enable_soft_constraints=request.enable_soft_constraints,
        solution_limit=request.max_solutions
    )

    if request.soft_constraint_weights:
        config.soft_constraint_weights.update(request.soft_constraint_weights)

    if request.optimization_mode == OptimizationMode.FAST:
        config.time_limit_seconds = max(config.time_limit_seconds, 300)
    elif request.optimization_mode == OptimizationMode.QUALITY:
        config.time_limit_seconds = max(config.time_limit_seconds, 1800)

    config.optimize_for_quality = (request.optimization_mode == OptimizationMode.QUALITY)
    return config


def _save_assignments(
    db: Session,
    timetable: Timetable,
    solution_data: Dict[str, Any]
) -> list[DBTimetableAssignment]:
    """Save optimization solution as database assignments."""
    assignments = []

    for assignment_data in solution_data.get("assignments", []):
        db_assignment = DBTimetableAssignment(
            timetable_id=timetable.id,
            course_id=UUID(assignment_data["course_id"]),
            faculty_id=UUID(assignment_data["faculty_id"]),
            batch_id=UUID(assignment_data["batch_id"]),
            classroom_id=UUID(assignment_data["room_id"]),   # use classroom_id
            slot_id=UUID(assignment_data["slot_id"]),
            day_of_week=assignment_data.get("day", 0),
            time_slot=f"period-{assignment_data.get('period', 0)}"
        )

        db.add(db_assignment)
        assignments.append(db_assignment)

    db.commit()
    return assignments


def _calculate_quality_metrics(
    db: Session,
    timetable: Timetable,
    assignments: list[DBTimetableAssignment],
    optimization_result: Any
) -> Dict[str, Any]:
    """Calculate comprehensive quality metrics for the generated timetable."""

    params = timetable.generation_params or {}
    total_courses = params.get("total_courses", 1) or 1
    assignment_rate = (len(assignments) / total_courses) * 100

    faculty_assignments: Dict[str, int] = {}
    room_assignments: Dict[str, int] = {}

    for assignment in assignments:
        faculty_id = str(assignment.faculty_id)
        room_id = str(assignment.classroom_id)

        faculty_assignments[faculty_id] = faculty_assignments.get(faculty_id, 0) + 1
        room_assignments[room_id] = room_assignments.get(room_id, 0) + 1

    faculty_utilization = {fid: min((h / 20) * 100, 100) for fid, h in faculty_assignments.items()}
    room_utilization = {rid: min((h / 40) * 100, 100) for rid, h in room_assignments.items()}

    avg_faculty = sum(faculty_utilization.values()) / len(faculty_utilization) if faculty_utilization else 0
    avg_room = sum(room_utilization.values()) / len(room_utilization) if room_utilization else 0

    return {
        "assignment_rate": round(assignment_rate, 2),
        "average_faculty_utilization": round(avg_faculty, 2),
        "average_room_utilization": round(avg_room, 2),
        "constraint_violations": len(optimization_result.constraint_violations or []),
        "penalty_score": optimization_result.penalty_score or 0,
        "faculty_count": len(faculty_utilization),
        "room_count": len(room_utilization),
        "generation_mode": "async"
    }