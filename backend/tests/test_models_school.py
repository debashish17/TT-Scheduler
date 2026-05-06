"""Tests for the school branch models."""
from sqlalchemy import inspect


def test_school_time_config_columns():
    from app.models.school.time_config import SchoolTimeConfig
    cols = {c.name for c in inspect(SchoolTimeConfig).columns}
    assert cols == {
        "run_id", "working_days", "periods_per_day",
        "period_duration_minutes", "start_time",
        "lunch_after_period", "lunch_duration_minutes",
    }


def test_school_subjects_unique_run_code():
    from app.models.school.subject import SchoolSubject
    table = SchoolSubject.__table__
    uqs = {tuple(sorted(c.name for c in u.columns))
           for u in table.constraints
           if u.__class__.__name__ == "UniqueConstraint"}
    assert ("code", "run_id") in uqs


def test_school_assignment_columns():
    from app.models.school.assignment import SchoolAssignment
    cols = {c.name for c in inspect(SchoolAssignment).columns}
    assert cols == {
        "id", "run_id", "day_of_week", "period",
        "subject_id", "teacher_id", "class_id", "room_id",
    }


def test_school_teacher_subject_join():
    from app.models.school.teacher_subject import SchoolTeacherSubject
    cols = {c.name for c in inspect(SchoolTeacherSubject).columns}
    assert cols == {"teacher_id", "subject_id"}


def test_school_subject_class_join():
    from app.models.school.subject_class import SchoolSubjectClass
    cols = {c.name for c in inspect(SchoolSubjectClass).columns}
    assert cols == {"subject_id", "class_id"}
