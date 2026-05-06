"""Tests for cross-product run_repo against the live database."""
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


def test_list_all_runs_includes_both_kinds(db_user):
    from app.repositories import school_run_repo, college_run_repo, run_repo
    from app.schemas.school import (
        SchoolGenerateRequest, SchoolSubjectIn, SchoolClassIn, SchoolRoomIn,
    )
    from app.schemas.college import (
        CollegeGenerateRequest, CollegeCourseIn, CollegeFacultyIn,
        CollegeRoomIn, CollegeDepartmentIn,
    )

    uid, db = db_user

    school_req = SchoolGenerateRequest(
        institution_name="S",
        subjects=[SchoolSubjectIn(name="Math", code="M01", periods_per_week=3, target_classes=["10A"])],
        classes=[SchoolClassIn(name="10A", size=30)],
        rooms=[SchoolRoomIn(name="R1", capacity=40)],
    )
    college_req = CollegeGenerateRequest(
        institution_name="C", semester=1,
        departments=[CollegeDepartmentIn(code="CS", name="Computer Science")],
        course_offerings=[CollegeCourseIn(code="CS101", name="Intro", department="CS",
                                          lectures_per_week=3, enrolled_students=30)],
        faculty=[CollegeFacultyIn(code="F1", name="Bob", courses_can_teach=["CS101"])],
        rooms=[CollegeRoomIn(name="LH1", capacity=60)],
    )
    result = {"success": True, "status": "OPTIMAL", "solver": "CP-SAT",
              "solve_time_seconds": 0.0, "assignments": []}

    s_id = school_run_repo.save_run(db, user_id=uid, request=school_req,
                                    result=result, parent_run_id=None)
    c_id = college_run_repo.save_run(db, user_id=uid, request=college_req,
                                     result=result, parent_run_id=None)
    db.commit()

    rows = run_repo.list_all_runs(db, user_id=uid, limit=20)
    kinds = {r["kind"] for r in rows if r["id"] in {str(s_id), str(c_id)}}
    assert kinds == {"school", "college"}
