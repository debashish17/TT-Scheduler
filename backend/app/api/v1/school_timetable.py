"""School timetable endpoints — generate (auto-saves), list, get, delete."""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.v1._timetable_helpers import (
    AnalyticsRequest, ExportRequest, build_excel_response, compute_analytics,
)
from app.core.simple_solver import solve_timetable
from app.db.session import get_db
from app.models.shared.user import User
from app.repositories import school_run_repo
from app.schemas.school import SchoolGenerateRequest

logger = logging.getLogger(__name__)
router = APIRouter()


def _request_to_solver_problem(request: SchoolGenerateRequest) -> dict:
    return {
        "institution_name": request.institution_name,
        "subjects": [s.model_dump() for s in request.subjects],
        "teachers": [t.model_dump() for t in request.teachers],
        "classes":  [c.model_dump() for c in request.classes],
        "rooms":    [r.model_dump() for r in request.rooms],
        "working_days": request.working_days,
        "periods_per_day": request.periods_per_day,
        "period_duration_minutes": request.period_duration_minutes,
        "lunch_duration_minutes": request.lunch_duration_minutes,
        "start_time": request.start_time,
        "constraints": request.constraints.model_dump(),
        "soft_constraints": [sc.model_dump() for sc in request.soft_constraints],
        **(
            {"solve_time_limit_seconds": request.solve_time_limit_seconds}
            if request.solve_time_limit_seconds is not None else {}
        ),
    }


@router.post("/generate")
def generate_school(
    request: SchoolGenerateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not request.subjects:
        raise HTTPException(400, "At least one subject is required")
    if not request.classes:
        raise HTTPException(400, "At least one class is required")
    if not request.rooms:
        raise HTTPException(400, "At least one room is required")

    try:
        result = solve_timetable(_request_to_solver_problem(request))
    except Exception as e:
        logger.error("School solver error: %s", e, exc_info=True)
        raise HTTPException(500, f"Solver error: {e}")

    if not result.get("success"):
        raise HTTPException(500, result.get("error", "Generation failed"))

    # Don't auto-save pre-check failures or empty solver outputs. The solver
    # returns success=True with solver="Precheck" (or zero assignments) when
    # diagnostics fail before the CP-SAT search starts — the frontend uses
    # this to drive its Auto-Fix UX, but persisting the empty shell pollutes
    # history.
    is_precheck_fail = result.get("solver") == "Precheck"
    n_assignments = len(result.get("assignments") or [])
    if is_precheck_fail or n_assignments == 0:
        logger.info(
            "Skipping auto-save: solver=%s, assignments=%d (likely a pre-check fail-fast).",
            result.get("solver"), n_assignments,
        )
        return result

    try:
        run_id = school_run_repo.save_run(
            db, user_id=user.id, request=request,
            result=result, parent_run_id=request.parent_run_id,
        )
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("School auto-save failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Auto-save failed: {e}")

    # Sanity-check: warn if the persisted assignment count diverges from the
    # solver's output. A divergence means save_run is silently skipping rows
    # (most likely an FK lookup miss — solver emits a name we never inserted).
    from app.models.school.assignment import SchoolAssignment
    saved = db.query(SchoolAssignment).filter_by(run_id=run_id).count()
    if saved != n_assignments:
        logger.warning(
            "School auto-save count mismatch: solver returned %d assignments, "
            "persisted %d. run_id=%s. Some rows were silently dropped during "
            "FK lookup in save_run — check for whitespace, casing, or duplicate "
            "names in the wizard inputs.",
            n_assignments, saved, run_id,
        )

    return {"run_id": str(run_id), **result}


@router.get("/runs")
def list_school_runs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"runs": school_run_repo.list_runs(db, user_id=user.id)}


@router.get("/runs/{run_id}")
def get_school_run(
    run_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return school_run_repo.load_run(db, run_id=run_id)
    except ValueError:
        raise HTTPException(404, "School run not found")


@router.get("/runs/{run_id}/result")
def get_school_run_result(
    run_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reconstruct the solver-result shape for a saved run, ready for /timetable view."""
    try:
        return school_run_repo.load_run_result(db, run_id=run_id)
    except ValueError:
        raise HTTPException(404, "School run not found")


@router.delete("/runs/{run_id}")
def delete_school_run(
    run_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        school_run_repo.delete_run(db, run_id=run_id, user_id=user.id)
        db.commit()
    except ValueError:
        raise HTTPException(404, "School run not found")
    return {"deleted": str(run_id)}


@router.post("/analytics")
def school_analytics(body: AnalyticsRequest):
    """Compute analytics from a generated school timetable result. No DB."""
    return compute_analytics(body)


@router.post("/export/excel")
def school_export_excel(body: ExportRequest):
    """Stream a multi-sheet .xlsx workbook for a school timetable."""
    return build_excel_response(body)
