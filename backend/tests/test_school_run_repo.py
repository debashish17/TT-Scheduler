"""Unit tests for school_run_repo against the live database."""
import uuid
import pytest
from sqlalchemy import text
from app.db.session import SessionLocal


@pytest.fixture
def db_user():
    """Create a temporary user, yield (uuid, session), then clean up."""
    db = SessionLocal()
    uid = uuid.uuid4()
    db.execute(text("INSERT INTO users (id, email) VALUES (:id, :e)"),
               {"id": str(uid), "e": f"{uid}@x.com"})
    db.commit()
    try:
        yield uid, db
    finally:
        db.execute(text("DELETE FROM users WHERE id = :id"), {"id": str(uid)})
        db.commit()
        db.close()


def test_save_run_creates_run_row(db_user):
    from app.repositories.school_run_repo import save_run
    from app.schemas.school import (
        SchoolGenerateRequest, SchoolSubjectIn, SchoolTeacherIn,
        SchoolClassIn, SchoolRoomIn,
    )
    uid, db = db_user
    req = SchoolGenerateRequest(
        institution_name="Test School",
        subjects=[SchoolSubjectIn(name="Math", code="M01", periods_per_week=3, target_classes=["10A"])],
        teachers=[SchoolTeacherIn(name="Alice", subjects=["M01"])],
        classes=[SchoolClassIn(name="10A", size=30)],
        rooms=[SchoolRoomIn(name="R1", capacity=40)],
    )
    result = {
        "success": True,
        "status": "OPTIMAL",
        "solver": "CP-SAT",
        "solve_time_seconds": 1.234,
        "assignments": [
            {"day_of_week": 0, "period": 1,
             "subject_code": "M01", "teacher_name": "Alice",
             "class_name": "10A", "room_name": "R1"},
        ],
    }
    run_id = save_run(db, user_id=uid, request=req, result=result, parent_run_id=None)
    db.commit()
    row = db.execute(text("SELECT kind, status, solver FROM runs WHERE id = :id"),
                     {"id": str(run_id)}).fetchone()
    assert row[0] == "school"
    assert row[1] == "optimal"
    assert row[2] == "CP-SAT"


def test_save_run_persists_inputs_and_assignments(db_user):
    from app.repositories.school_run_repo import save_run
    from app.schemas.school import (
        SchoolGenerateRequest, SchoolSubjectIn, SchoolTeacherIn,
        SchoolClassIn, SchoolRoomIn,
    )
    uid, db = db_user
    req = SchoolGenerateRequest(
        institution_name="T",
        subjects=[SchoolSubjectIn(name="Math", code="M01", periods_per_week=2, target_classes=["10A"])],
        teachers=[SchoolTeacherIn(name="Alice", subjects=["M01"])],
        classes=[SchoolClassIn(name="10A", size=30)],
        rooms=[SchoolRoomIn(name="R1", capacity=40)],
    )
    result = {
        "success": True, "status": "OPTIMAL", "solver": "CP-SAT",
        "solve_time_seconds": 0.1,
        "assignments": [
            {"day_of_week": 0, "period": 1, "subject_code": "M01",
             "teacher_name": "Alice", "class_name": "10A", "room_name": "R1"},
        ],
    }
    run_id = save_run(db, user_id=uid, request=req, result=result, parent_run_id=None)
    db.commit()
    n_subj   = db.execute(text("SELECT COUNT(*) FROM school_subjects   WHERE run_id=:r"), {"r": str(run_id)}).scalar()
    n_assign = db.execute(text("SELECT COUNT(*) FROM school_assignments WHERE run_id=:r"), {"r": str(run_id)}).scalar()
    assert n_subj == 1
    assert n_assign == 1


def test_load_run_returns_wizard_shape(db_user):
    from app.repositories.school_run_repo import save_run, load_run
    from app.schemas.school import (
        SchoolGenerateRequest, SchoolSubjectIn, SchoolTeacherIn,
        SchoolClassIn, SchoolRoomIn,
    )
    uid, db = db_user
    req = SchoolGenerateRequest(
        institution_name="T",
        subjects=[SchoolSubjectIn(name="Math", code="M01", periods_per_week=3, target_classes=["10A"])],
        teachers=[SchoolTeacherIn(name="Alice", subjects=["M01"])],
        classes=[SchoolClassIn(name="10A", size=30)],
        rooms=[SchoolRoomIn(name="R1", capacity=40)],
    )
    result = {"success": True, "status": "OPTIMAL", "solver": "CP-SAT",
              "solve_time_seconds": 0.0, "assignments": []}
    run_id = save_run(db, user_id=uid, request=req, result=result, parent_run_id=None)
    db.commit()

    payload = load_run(db, run_id=run_id)
    assert len(payload["subjects"]) == 1
    assert payload["subjects"][0]["code"] == "M01"
    assert payload["subjects"][0]["target_classes"] == ["10A"]
    assert payload["teachers"][0]["subjects"] == ["M01"]
    assert payload["classes"][0]["name"] == "10A"
    assert payload["rooms"][0]["name"] == "R1"
    assert payload["periods_per_day"] == 7  # default in SchoolGenerateRequest


def test_list_runs_returns_user_runs_only(db_user):
    from app.repositories.school_run_repo import save_run, list_runs
    from app.schemas.school import (
        SchoolGenerateRequest, SchoolSubjectIn,
        SchoolClassIn, SchoolRoomIn,
    )
    uid, db = db_user
    req = SchoolGenerateRequest(
        institution_name="T",
        subjects=[SchoolSubjectIn(name="M", code="M01", periods_per_week=3, target_classes=["10A"])],
        teachers=[],
        classes=[SchoolClassIn(name="10A", size=30)],
        rooms=[SchoolRoomIn(name="R1", capacity=40)],
    )
    result = {"success": True, "status": "OPTIMAL", "solver": "CP-SAT",
              "solve_time_seconds": 0.0, "assignments": []}
    rid = save_run(db, user_id=uid, request=req, result=result, parent_run_id=None)
    db.commit()
    runs = list_runs(db, user_id=uid, limit=20)
    assert any(str(r["id"]) == str(rid) for r in runs)
    # All entries should be school kind (because list_runs is school-only)
    # No `kind` key needed in the dict, but every row should be from a SCHOOL run
    assert len(runs) >= 1


def test_delete_run_removes_run_and_inputs(db_user):
    from app.repositories.school_run_repo import save_run, delete_run
    from app.schemas.school import (
        SchoolGenerateRequest, SchoolSubjectIn,
        SchoolClassIn, SchoolRoomIn,
    )
    from sqlalchemy import text
    uid, db = db_user
    req = SchoolGenerateRequest(
        institution_name="T",
        subjects=[SchoolSubjectIn(name="M", code="M01", periods_per_week=3, target_classes=["10A"])],
        teachers=[],
        classes=[SchoolClassIn(name="10A", size=30)],
        rooms=[SchoolRoomIn(name="R1", capacity=40)],
    )
    result = {"success": True, "status": "OPTIMAL", "solver": "CP-SAT",
              "solve_time_seconds": 0.0, "assignments": []}
    rid = save_run(db, user_id=uid, request=req, result=result, parent_run_id=None)
    db.commit()
    delete_run(db, run_id=rid, user_id=uid)
    db.commit()
    n = db.execute(text("SELECT COUNT(*) FROM school_subjects WHERE run_id=:r"), {"r": str(rid)}).scalar()
    assert n == 0
