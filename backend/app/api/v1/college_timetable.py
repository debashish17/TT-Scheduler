"""College timetable endpoints — generate (auto-saves), list, get, delete."""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.v1._timetable_helpers import (
    AnalyticsRequest, ExportRequest, build_excel_response, compute_analytics,
)
from app.core.college_solver import solve_college_timetable
from app.db.session import get_db
from app.models.shared.user import User
from app.repositories import college_run_repo
from app.schemas.college import CollegeGenerateRequest

logger = logging.getLogger(__name__)
router = APIRouter()


def _request_to_solver_problem(request: CollegeGenerateRequest) -> dict:
    return {
        "institution_name": request.institution_name,
        "semester": request.semester,
        "departments": [d.model_dump() for d in request.departments],
        "course_offerings": [c.model_dump() for c in request.course_offerings],
        "faculty": [f.model_dump() for f in request.faculty],
        "rooms":   [r.model_dump() for r in request.rooms],
        "working_days": request.working_days,
        "periods_per_day": request.periods_per_day,
        "period_duration_minutes": request.period_duration_minutes,
        "start_time": request.start_time,
        "constraints": request.constraints.model_dump(),
        "soft_constraints": [sc.model_dump() for sc in request.soft_constraints],
    }


@router.post("/generate")
def generate_college(
    request: CollegeGenerateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not request.course_offerings:
        raise HTTPException(400, "At least one course is required")
    if not request.faculty:
        raise HTTPException(400, "At least one faculty member is required")
    if not request.rooms:
        raise HTTPException(400, "At least one room is required")

    try:
        result = solve_college_timetable(_request_to_solver_problem(request))
    except Exception as e:
        logger.error("College solver error: %s", e, exc_info=True)
        raise HTTPException(500, f"Solver error: {e}")

    if not result.get("success"):
        raise HTTPException(500, result.get("error", "Generation failed"))

    # See school_timetable.generate_school for the rationale: pre-check
    # fail-fasts and empty solver outputs should not pollute history.
    is_precheck_fail = result.get("solver") in ("Precheck", "CP-SAT-College-Precheck")
    n_assignments = len(result.get("assignments") or [])
    if is_precheck_fail or n_assignments == 0:
        logger.info(
            "Skipping auto-save: solver=%s, assignments=%d (likely a pre-check fail-fast).",
            result.get("solver"), n_assignments,
        )
        return result

    try:
        run_id = college_run_repo.save_run(
            db, user_id=user.id, request=request,
            result=result, parent_run_id=request.parent_run_id,
        )
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("College auto-save failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Auto-save failed: {e}")

    from app.models.college.assignment import CollegeAssignment
    saved = db.query(CollegeAssignment).filter_by(run_id=run_id).count()
    if saved != n_assignments:
        logger.warning(
            "College auto-save count mismatch: solver returned %d assignments, "
            "persisted %d. run_id=%s. Some rows were silently dropped during "
            "FK lookup in save_run.",
            n_assignments, saved, run_id,
        )

    return {"run_id": str(run_id), **result}


@router.get("/runs")
def list_college_runs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"runs": college_run_repo.list_runs(db, user_id=user.id)}


@router.get("/runs/{run_id}")
def get_college_run(
    run_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return college_run_repo.load_run(db, run_id=run_id)
    except ValueError:
        raise HTTPException(404, "College run not found")


@router.get("/runs/{run_id}/result")
def get_college_run_result(
    run_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reconstruct the solver-result shape for a saved run, ready for /timetable view."""
    try:
        return college_run_repo.load_run_result(db, run_id=run_id)
    except ValueError:
        raise HTTPException(404, "College run not found")


@router.delete("/runs/{run_id}")
def delete_college_run(
    run_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        college_run_repo.delete_run(db, run_id=run_id, user_id=user.id)
        db.commit()
    except ValueError:
        raise HTTPException(404, "College run not found")
    return {"deleted": str(run_id)}


@router.post("/analytics")
def college_analytics(body: AnalyticsRequest):
    """Compute analytics from a generated college timetable result. No DB."""
    return compute_analytics(body)


@router.post("/export/excel")
def college_export_excel(body: ExportRequest):
    """Stream a multi-sheet .xlsx workbook for a college timetable."""
    return build_excel_response(body)
