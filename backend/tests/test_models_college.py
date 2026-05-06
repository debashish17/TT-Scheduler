"""Tests for the college branch models."""
from sqlalchemy import inspect


def test_college_courses_columns():
    from app.models.college.course import CollegeCourse
    cols = {c.name for c in inspect(CollegeCourse).columns}
    assert cols == {
        "id", "run_id", "department_id", "code", "name", "year", "credits",
        "lectures_per_week", "has_lab", "required_lecture_room_type",
        "required_lab_room_type", "enrolled_students", "is_elective",
    }


def test_college_assignments_has_slot_kind():
    from app.models.college.assignment import CollegeAssignment
    cols = {c.name for c in inspect(CollegeAssignment).columns}
    assert "slot_kind" in cols


def test_college_faculty_courses_join():
    from app.models.college.faculty_course import CollegeFacultyCourse
    cols = {c.name for c in inspect(CollegeFacultyCourse).columns}
    assert cols == {"faculty_id", "course_id"}


def test_college_rooms_has_room_type():
    from app.models.college.room import CollegeRoom
    cols = {c.name for c in inspect(CollegeRoom).columns}
    assert "room_type" in cols


def test_college_time_config_has_semester():
    from app.models.college.time_config import CollegeTimeConfig
    cols = {c.name for c in inspect(CollegeTimeConfig).columns}
    assert "semester" in cols
