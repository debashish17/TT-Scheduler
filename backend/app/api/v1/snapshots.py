"""
User Timetable Snapshots API
Saves and restores full per-user state: all onboarding inputs + solver result.
Each snapshot is scoped to the authenticated Supabase user.
"""
import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models import User

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Request / Response schemas ──────────────────────────────────

class SaveSnapshotRequest(BaseModel):
    institution_name: str = "My School"
    institution_data: Dict[str, Any] = {}
    classes_data: List[Any] = []
    subjects_data: List[Any] = []
    teachers_data: List[Any] = []
    time_data: Dict[str, Any] = {}
    rooms_data: List[Any] = []
    constraints_data: Dict[str, Any] = {}
    generated_timetable: Dict[str, Any] = {}


def _row_to_snapshot(row) -> Dict[str, Any]:
    """Convert a DB row tuple to a snapshot dict."""
    return {
        "id":                   str(row[0]),
        "institution_name":     row[1],
        "created_at":           row[2].isoformat() if row[2] else None,
        "institution_data":     row[3] or {},
        "classes_data":         row[4] or [],
        "subjects_data":        row[5] or [],
        "teachers_data":        row[6] or [],
        "time_data":            row[7] or {},
        "rooms_data":           row[8] or [],
        "constraints_data":     row[9] or {},
        "generated_timetable":  row[10] or {},
    }


# ─── Endpoints ───────────────────────────────────────────────────

@router.post("/save")
async def save_snapshot(
    body: SaveSnapshotRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Persist a full snapshot (all onboarding inputs + solver result) for the
    authenticated user. Each call creates a new historical row — the user's
    full history is preserved and the latest is always the most-recent row.
    """
    try:
        from app.db.session import SessionLocal
        from sqlalchemy import text

        db = SessionLocal()
        try:
            snap_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()

            db.execute(
                text("""
                    INSERT INTO user_timetable_snapshots (
                        id, user_id, institution_name, created_at, updated_at,
                        institution_data, classes_data, subjects_data,
                        teachers_data, time_data, rooms_data,
                        constraints_data, generated_timetable
                    ) VALUES (
                        :id, :user_id, :institution_name, :created_at, :updated_at,
                        CAST(:institution_data  AS jsonb),
                        CAST(:classes_data      AS jsonb),
                        CAST(:subjects_data     AS jsonb),
                        CAST(:teachers_data     AS jsonb),
                        CAST(:time_data         AS jsonb),
                        CAST(:rooms_data        AS jsonb),
                        CAST(:constraints_data  AS jsonb),
                        CAST(:generated_timetable AS jsonb)
                    )
                """),
                {
                    "id":                   snap_id,
                    "user_id":              str(current_user.id),
                    "institution_name":     body.institution_name,
                    "created_at":           now,
                    "updated_at":           now,
                    "institution_data":     json.dumps(body.institution_data),
                    "classes_data":         json.dumps(body.classes_data),
                    "subjects_data":        json.dumps(body.subjects_data),
                    "teachers_data":        json.dumps(body.teachers_data),
                    "time_data":            json.dumps(body.time_data),
                    "rooms_data":           json.dumps(body.rooms_data),
                    "constraints_data":     json.dumps(body.constraints_data),
                    "generated_timetable":  json.dumps(body.generated_timetable),
                },
            )
            db.commit()
            logger.info(f"Snapshot saved: id={snap_id} user={current_user.id}")
            return {"success": True, "snapshot_id": snap_id}

        except Exception as e:
            db.rollback()
            logger.error(f"Snapshot save error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Snapshot save failed: {e}")
        finally:
            db.close()

    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"DB not available: {e}")


@router.get("/latest")
async def get_latest_snapshot(
    current_user: User = Depends(get_current_user),
):
    """
    Return the most recent snapshot for the authenticated user.
    Used on app load to restore the full previous session.
    """
    try:
        from app.db.session import SessionLocal
        from sqlalchemy import text

        db = SessionLocal()
        try:
            row = db.execute(
                text("""
                    SELECT id, institution_name, created_at,
                           institution_data, classes_data, subjects_data,
                           teachers_data, time_data, rooms_data,
                           constraints_data, generated_timetable
                    FROM user_timetable_snapshots
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    LIMIT 1
                """),
                {"user_id": str(current_user.id)},
            ).fetchone()

            if not row:
                return {"found": False, "snapshot": None}

            return {"found": True, "snapshot": _row_to_snapshot(row)}

        finally:
            db.close()

    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"DB not available: {e}")


@router.get("/history")
async def get_snapshot_history(
    current_user: User = Depends(get_current_user),
):
    """
    Return the last 20 timetable snapshots for the authenticated user.
    Only summary fields are returned (not full timetable data) for performance.
    """
    try:
        from app.db.session import SessionLocal
        from sqlalchemy import text

        db = SessionLocal()
        try:
            rows = db.execute(
                text("""
                    SELECT
                        id,
                        institution_name,
                        created_at,
                        generated_timetable->>'solver'                                      AS solver,
                        COALESCE((generated_timetable->'stats'->>'total_assignments')::int, 0)   AS total_assignments,
                        COALESCE(generated_timetable->'stats'->>'solve_time_seconds', '0') AS solve_time,
                        COALESCE(jsonb_array_length(subjects_data),  0) AS subjects_count,
                        COALESCE(jsonb_array_length(teachers_data),  0) AS teachers_count,
                        COALESCE(jsonb_array_length(rooms_data),     0) AS rooms_count,
                        COALESCE(jsonb_array_length(classes_data),   0) AS classes_count
                    FROM user_timetable_snapshots
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    LIMIT 20
                """),
                {"user_id": str(current_user.id)},
            ).fetchall()

            return {
                "snapshots": [
                    {
                        "id":                str(r[0]),
                        "institution_name":  r[1] or "My School",
                        "created_at":        r[2].isoformat() if r[2] else None,
                        "solver":            r[3] or "CP-SAT",
                        "total_assignments": int(r[4] or 0),
                        "solve_time":        str(r[5] or "0"),
                        "subjects_count":    int(r[6] or 0),
                        "teachers_count":    int(r[7] or 0),
                        "rooms_count":       int(r[8] or 0),
                        "classes_count":     int(r[9] or 0),
                    }
                    for r in rows
                ]
            }

        finally:
            db.close()

    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"DB not available: {e}")


@router.get("/{snapshot_id}")
async def get_snapshot_by_id(
    snapshot_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Return a specific snapshot by ID (must belong to the authenticated user).
    Used when loading a historical timetable from the History page.
    """
    try:
        from app.db.session import SessionLocal
        from sqlalchemy import text

        db = SessionLocal()
        try:
            row = db.execute(
                text("""
                    SELECT id, institution_name, created_at,
                           institution_data, classes_data, subjects_data,
                           teachers_data, time_data, rooms_data,
                           constraints_data, generated_timetable
                    FROM user_timetable_snapshots
                    WHERE id = :snap_id AND user_id = :user_id
                """),
                {"snap_id": snapshot_id, "user_id": str(current_user.id)},
            ).fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Snapshot not found")

            return {"found": True, "snapshot": _row_to_snapshot(row)}

        finally:
            db.close()

    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"DB not available: {e}")

@router.delete("/{snapshot_id}")
async def delete_snapshot(
    snapshot_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Delete a specific snapshot from the database for the authenticated user.
    """
    try:
        from app.db.session import SessionLocal
        from sqlalchemy import text

        db = SessionLocal()
        try:
            result = db.execute(
                text("""
                    DELETE FROM user_timetable_snapshots
                    WHERE id = :snap_id AND user_id = :user_id
                """),
                {"snap_id": snapshot_id, "user_id": str(current_user.id)},
            )
            db.commit()

            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Snapshot not found")

            # Also clear any current reference if we'd like, but deleting row is enough
            return {"success": True, "deleted_id": snapshot_id}

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Snapshot delete error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Snapshot deletion failed: {e}")
        finally:
            db.close()

    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"DB not available: {e}")
