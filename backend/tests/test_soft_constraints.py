"""
Soft-constraint behavioral tests.

Soft constraints are *preferences* — the solver should produce a schedule that
respects them when it can, but won't fail if it can't. So the right test
shape is comparative:

  1. Solve the same problem WITHOUT a soft constraint  → baseline
  2. Solve it WITH the soft constraint                → constrained run
  3. Assert the constrained run has STRICTLY FEWER violations than baseline
     (or hits zero).

Strict-equality assertions (e.g. "no violations after applying") would be
flaky because hard constraints can force a violation even when the solver
tries hard. The "fewer violations" form is robust against solver discretion
while still proving the soft constraint had a real effect.

Run:
  cd backend
  ./venv/Scripts/python.exe -m pytest tests/test_soft_constraints.py -v
"""
from __future__ import annotations

from app.core.simple_solver import solve_timetable
from app.core.college_solver import solve_college_timetable


# ─────────────────────────────────────────────────────────────────────
# Problem builders — small enough to solve in <5s, slack enough that
# the solver has real freedom to honor preferences.
# ─────────────────────────────────────────────────────────────────────

def _school_problem() -> dict:
    """4 classes × 5 subjects, 5 teachers, 5 rooms, 5 days × 7 periods."""
    return {
        "institution_name": "Soft-Constraint Test School",
        "subjects": [
            {"name": "Math",      "code": "MATH", "periods_per_week": 4,
             "target_classes": ["10A", "10B", "10C", "10D"]},
            {"name": "English",   "code": "ENG",  "periods_per_week": 4,
             "target_classes": ["10A", "10B", "10C", "10D"]},
            {"name": "Science",   "code": "SCI",  "periods_per_week": 3,
             "target_classes": ["10A", "10B", "10C", "10D"]},
            {"name": "History",   "code": "HIS",  "periods_per_week": 2,
             "target_classes": ["10A", "10B", "10C", "10D"]},
            {"name": "Art",       "code": "ART",  "periods_per_week": 2,
             "target_classes": ["10A", "10B", "10C", "10D"]},
        ],
        # Each subject has multiple qualified teachers so the solver can
        # always pick a different teacher if a preference says so.
        "teachers": [
            {"name": "Alice",   "subjects": ["MATH", "SCI"]},
            {"name": "Bob",     "subjects": ["MATH", "ENG"]},
            {"name": "Carol",   "subjects": ["ENG", "HIS"]},
            {"name": "Dave",    "subjects": ["SCI", "HIS", "ART"]},
            {"name": "Eve",     "subjects": ["ART", "ENG", "MATH"]},
        ],
        "classes": [
            {"name": "10A", "size": 30},
            {"name": "10B", "size": 30},
            {"name": "10C", "size": 30},
            {"name": "10D", "size": 30},
        ],
        "rooms": [
            {"name": "R1", "capacity": 35},
            {"name": "R2", "capacity": 35},
            {"name": "R3", "capacity": 35},
            {"name": "R4", "capacity": 35},
            {"name": "R5", "capacity": 35},
        ],
        "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "periods_per_day": 7,
        "period_duration_minutes": 45,
        "lunch_duration_minutes": 0,
        "start_time": "08:00",
        "constraints": {
            "max_consecutive_periods": 3,
            "lunch_after_period": 0,
            "max_periods_per_day_per_teacher": 6,
        },
        "soft_constraints": [],
        "solve_time_limit_seconds": 15,
    }


def _college_problem() -> dict:
    """3 courses, 4 faculty, 4 rooms — small enough to solve in seconds."""
    return {
        "institution_name": "Soft-Constraint Test College",
        "semester": 1,
        "departments": [
            {"code": "CS", "name": "Computer Science"},
        ],
        "course_offerings": [
            {
                "code": "CS101", "name": "Intro to CS", "department": "CS",
                "year": 1, "credits": 3, "lectures_per_week": 3,
                "has_lab": False, "required_lecture_room_type": "classroom",
                "required_lab_room_type": None, "enrolled_students": 30,
                "is_elective": False, "faculty_codes": ["F1", "F2"],
            },
            {
                "code": "CS102", "name": "Discrete Math", "department": "CS",
                "year": 1, "credits": 3, "lectures_per_week": 3,
                "has_lab": False, "required_lecture_room_type": "classroom",
                "required_lab_room_type": None, "enrolled_students": 30,
                "is_elective": False, "faculty_codes": ["F2", "F3"],
            },
            {
                "code": "CS103", "name": "Programming Lab", "department": "CS",
                "year": 1, "credits": 2, "lectures_per_week": 2,
                "has_lab": False, "required_lecture_room_type": "classroom",
                "required_lab_room_type": None, "enrolled_students": 30,
                "is_elective": False, "faculty_codes": ["F3", "F4"],
            },
        ],
        "faculty": [
            {"code": "F1", "name": "Dr Alice", "department": "CS",
             "courses_can_teach": ["CS101"], "max_hours_per_week": 12},
            {"code": "F2", "name": "Dr Bob", "department": "CS",
             "courses_can_teach": ["CS101", "CS102"], "max_hours_per_week": 12},
            {"code": "F3", "name": "Dr Carol", "department": "CS",
             "courses_can_teach": ["CS102", "CS103"], "max_hours_per_week": 12},
            {"code": "F4", "name": "Dr Dave", "department": "CS",
             "courses_can_teach": ["CS103"], "max_hours_per_week": 12},
        ],
        "rooms": [
            {"name": "LH1", "capacity": 50, "room_type": "classroom"},
            {"name": "LH2", "capacity": 50, "room_type": "classroom"},
            {"name": "LH3", "capacity": 50, "room_type": "classroom"},
            {"name": "LH4", "capacity": 50, "room_type": "classroom"},
        ],
        "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "periods_per_day": 6,
        "period_duration_minutes": 60,
        "start_time": "08:00",
        "constraints": {
            "lunch_period_index": -1,
            "max_consecutive_periods": 3,
            "max_periods_per_day_per_faculty": 5,
        },
        "soft_constraints": [],
        "solve_time_limit_seconds": 15,
    }


# ─────────────────────────────────────────────────────────────────────
# Violation counters
# ─────────────────────────────────────────────────────────────────────

def _count_school_avoid_day(result: dict, teacher_name: str, day: str) -> int:
    """Count how many sessions land on `day` taught by `teacher_name`."""
    return sum(
        1 for a in result.get("assignments", [])
        if a.get("teacher_name") == teacher_name and a.get("day") == day
    )


def _count_school_avoid_slot(result: dict, teacher_name: str, period: int) -> int:
    """Count sessions taught by `teacher_name` at the given (1-based) period."""
    return sum(
        1 for a in result.get("assignments", [])
        if a.get("teacher_name") == teacher_name and a.get("period") == period
    )


def _count_college_avoid_day(result: dict, faculty_code: str, day: str) -> int:
    """Count how many sessions land on `day` taught by a given faculty.

    The college solver emits faculty NAME on each assignment (`teacher_name`)
    rather than the code. We resolve via the institution_name → faculty
    mapping in the request, but for tests it's easier to just count by name.
    """
    # Caller passes a faculty NAME here despite the parameter name —
    # we keep the signature symmetric with the school version.
    return sum(
        1 for a in result.get("assignments", [])
        if a.get("teacher_name") == faculty_code and a.get("day") == day
    )


def _count_college_avoid_slot(result: dict, faculty_name: str, period: int) -> int:
    return sum(
        1 for a in result.get("assignments", [])
        if a.get("teacher_name") == faculty_name and a.get("period") == period
    )


# ─────────────────────────────────────────────────────────────────────
# School tests
# ─────────────────────────────────────────────────────────────────────

def test_school_avoid_day_reduces_violations():
    """Soft 'avoid_day' should push the solver to schedule fewer of the
    targeted teacher's sessions on the targeted day."""
    teacher = "Alice"
    avoid = "Friday"

    baseline = solve_timetable(_school_problem())
    assert baseline.get("success"), f"baseline solve failed: {baseline}"
    baseline_violations = _count_school_avoid_day(baseline, teacher, avoid)

    constrained_problem = _school_problem()
    constrained_problem["soft_constraints"] = [
        {"type": "avoid_day", "target": teacher, "when": avoid, "weight": 10},
    ]
    constrained = solve_timetable(constrained_problem)
    assert constrained.get("success"), f"constrained solve failed: {constrained}"
    constrained_violations = _count_school_avoid_day(constrained, teacher, avoid)

    print(f"\n[school avoid_day] baseline {teacher}@{avoid}: {baseline_violations}, "
          f"constrained: {constrained_violations}")
    # Strictly fewer (or already zero on baseline → still zero).
    assert constrained_violations <= baseline_violations, (
        f"avoid_day failed: baseline had {baseline_violations} sessions "
        f"of {teacher} on {avoid}, constrained had {constrained_violations}"
    )
    # If baseline had any violations, soft constraint must have reduced them.
    if baseline_violations > 0:
        assert constrained_violations < baseline_violations, (
            f"Soft constraint had no effect: still {constrained_violations} "
            f"sessions of {teacher} on {avoid} (baseline: {baseline_violations})"
        )


def test_school_avoid_slot_reduces_violations():
    """Soft 'avoid_slot' should push the solver to schedule fewer of the
    targeted teacher's sessions at the targeted period."""
    teacher = "Bob"
    avoid_period = 1  # 1-based

    baseline = solve_timetable(_school_problem())
    assert baseline.get("success"), f"baseline solve failed: {baseline}"
    baseline_violations = _count_school_avoid_slot(baseline, teacher, avoid_period)

    constrained_problem = _school_problem()
    constrained_problem["soft_constraints"] = [
        {"type": "avoid_slot", "target": teacher, "when": str(avoid_period), "weight": 10},
    ]
    constrained = solve_timetable(constrained_problem)
    assert constrained.get("success"), f"constrained solve failed: {constrained}"
    constrained_violations = _count_school_avoid_slot(constrained, teacher, avoid_period)

    print(f"\n[school avoid_slot] baseline {teacher}@P{avoid_period}: {baseline_violations}, "
          f"constrained: {constrained_violations}")
    assert constrained_violations <= baseline_violations
    if baseline_violations > 0:
        assert constrained_violations < baseline_violations, (
            f"Soft constraint had no effect: still {constrained_violations} "
            f"sessions of {teacher} at period {avoid_period}"
        )


# ─────────────────────────────────────────────────────────────────────
# College tests
# ─────────────────────────────────────────────────────────────────────

def test_college_avoid_day_reduces_violations():
    """Same shape as the school avoid_day test, but for college faculty.

    Note: the college soft-constraint applier uses faculty CODE (not name)
    as the `target`, so we pass the code. Violation counting walks the
    assignments by teacher_name (what the solver emits) — we look up the
    name from the request to count correctly.
    """
    faculty_code = "F1"
    faculty_name = "Dr Alice"  # matches _college_problem above
    avoid = "Friday"

    baseline = solve_college_timetable(_college_problem())
    assert baseline.get("success"), f"baseline solve failed: {baseline}"
    baseline_violations = _count_college_avoid_day(baseline, faculty_name, avoid)

    constrained_problem = _college_problem()
    constrained_problem["soft_constraints"] = [
        {"type": "avoid_day", "target": faculty_code, "when": avoid, "weight": 10},
    ]
    constrained = solve_college_timetable(constrained_problem)
    assert constrained.get("success"), f"constrained solve failed: {constrained}"
    constrained_violations = _count_college_avoid_day(constrained, faculty_name, avoid)

    print(f"\n[college avoid_day] baseline {faculty_name}@{avoid}: "
          f"{baseline_violations}, constrained: {constrained_violations}")
    assert constrained_violations <= baseline_violations
    if baseline_violations > 0:
        assert constrained_violations < baseline_violations, (
            f"Soft constraint had no effect: still {constrained_violations} "
            f"sessions of {faculty_name} on {avoid}"
        )


def test_college_avoid_slot_reduces_violations():
    faculty_code = "F2"
    faculty_name = "Dr Bob"
    avoid_period = 6

    baseline = solve_college_timetable(_college_problem())
    assert baseline.get("success"), f"baseline solve failed: {baseline}"
    baseline_violations = _count_college_avoid_slot(baseline, faculty_name, avoid_period)

    constrained_problem = _college_problem()
    constrained_problem["soft_constraints"] = [
        {"type": "avoid_slot", "target": faculty_code,
         "when": str(avoid_period), "weight": 10},
    ]
    constrained = solve_college_timetable(constrained_problem)
    assert constrained.get("success"), f"constrained solve failed: {constrained}"
    constrained_violations = _count_college_avoid_slot(constrained, faculty_name, avoid_period)

    print(f"\n[college avoid_slot] baseline {faculty_name}@P{avoid_period}: "
          f"{baseline_violations}, constrained: {constrained_violations}")
    assert constrained_violations <= baseline_violations
    if baseline_violations > 0:
        assert constrained_violations < baseline_violations, (
            f"Soft constraint had no effect: still {constrained_violations} "
            f"sessions of {faculty_name} at period {avoid_period}"
        )
