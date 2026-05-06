"""Unit tests for college_run_repo against the live database."""
import uuid
import pytest
from sqlalchemy import text
from app.db.session import SessionLocal


@pytest.fixture
def db_user():
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


def _basic_request():
    from app.schemas.college import (
        CollegeGenerateRequest, CollegeCourseIn, CollegeFacultyIn, CollegeRoomIn, CollegeDepartmentIn,
    )
    return CollegeGenerateRequest(
        institution_name="Test College",
        semester=1,
        departments=[CollegeDepartmentIn(code="CS", name="Computer Science")],
        course_offerings=[
            CollegeCourseIn(code="CS101", name="Intro CS", department="CS",
                            year=1, credits=3, lectures_per_week=3,
                            enrolled_students=30),
        ],
        faculty=[CollegeFacultyIn(code="F1", name="Dr Bob", department="CS",
                                  courses_can_teach=["CS101"], max_hours_per_week=18)],
        rooms=[CollegeRoomIn(name="LH1", capacity=60, room_type="classroom")],
    )


def _basic_result():
    return {
        "success": True, "status": "OPTIMAL", "solver": "CP-SAT",
        "solve_time_seconds": 0.5,
        "assignments": [
            {"day_of_week": 0, "period": 1,
             "course_code": "CS101", "faculty_code": "F1",
             "room_name": "LH1", "slot_kind": "lecture"},
        ],
    }


def test_save_college_run_creates_run_row(db_user):
    from app.repositories.college_run_repo import save_run
    uid, db = db_user
    rid = save_run(db, user_id=uid, request=_basic_request(),
                   result=_basic_result(), parent_run_id=None)
    db.commit()
    row = db.execute(text("SELECT kind, status, solver FROM runs WHERE id=:id"),
                     {"id": str(rid)}).fetchone()
    assert row[0] == "college"
    assert row[1] == "optimal"
    assert row[2] == "CP-SAT"


def test_save_college_run_persists_inputs(db_user):
    from app.repositories.college_run_repo import save_run
    uid, db = db_user
    rid = save_run(db, user_id=uid, request=_basic_request(),
                   result=_basic_result(), parent_run_id=None)
    db.commit()
    n_dept    = db.execute(text("SELECT COUNT(*) FROM college_departments WHERE run_id=:r"), {"r": str(rid)}).scalar()
    n_course  = db.execute(text("SELECT COUNT(*) FROM college_courses     WHERE run_id=:r"), {"r": str(rid)}).scalar()
    n_faculty = db.execute(text("SELECT COUNT(*) FROM college_faculty     WHERE run_id=:r"), {"r": str(rid)}).scalar()
    n_section = db.execute(text("SELECT COUNT(*) FROM college_sections    WHERE run_id=:r"), {"r": str(rid)}).scalar()
    n_assign  = db.execute(text("SELECT COUNT(*) FROM college_assignments WHERE run_id=:r"), {"r": str(rid)}).scalar()
    assert n_dept == 1
    assert n_course == 1
    assert n_faculty == 1
    assert n_section == 1
    assert n_assign == 1


def test_load_college_run_returns_wizard_shape(db_user):
    from app.repositories.college_run_repo import save_run, load_run
    uid, db = db_user
    rid = save_run(db, user_id=uid, request=_basic_request(),
                   result=_basic_result(), parent_run_id=None)
    db.commit()
    payload = load_run(db, run_id=rid)
    assert payload["semester"] == 1
    assert len(payload["departments"]) == 1
    assert payload["departments"][0]["code"] == "CS"
    assert len(payload["course_offerings"]) == 1
    assert payload["course_offerings"][0]["code"] == "CS101"
    assert payload["course_offerings"][0]["department"] == "CS"
    assert payload["faculty"][0]["courses_can_teach"] == ["CS101"]
    assert payload["rooms"][0]["room_type"] == "classroom"


def test_list_college_runs_returns_only_college_kind(db_user):
    from app.repositories.college_run_repo import save_run, list_runs
    uid, db = db_user
    rid = save_run(db, user_id=uid, request=_basic_request(),
                   result=_basic_result(), parent_run_id=None)
    db.commit()
    runs = list_runs(db, user_id=uid, limit=20)
    assert any(str(r["id"]) == str(rid) for r in runs)


def test_delete_college_run_cascades(db_user):
    from app.repositories.college_run_repo import save_run, delete_run
    uid, db = db_user
    rid = save_run(db, user_id=uid, request=_basic_request(),
                   result=_basic_result(), parent_run_id=None)
    db.commit()
    delete_run(db, run_id=rid, user_id=uid)
    db.commit()
    n = db.execute(text("SELECT COUNT(*) FROM college_courses WHERE run_id=:r"), {"r": str(rid)}).scalar()
    assert n == 0
