"""
Smoke test: compare solver behavior under the unified R=100_000 reward weight.

Runs three school problems (small / medium / soft-constraint-heavy) and one
college problem, printing solve time, placement count, unplaced sessions,
and how many soft-spread violations remain. Use this to eyeball whether the
new reward weight produces sensible results vs. your expectations.

Run:  venv/Scripts/python scripts/smoke_reward_weight.py
"""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.simple_solver import solve_timetable as solve_school
from app.core.college_solver import solve_college_timetable as solve_college


def count_same_day_repeats(assignments):
    """How many (class, subject) pairs share a day — proxy for soft-spread violations."""
    by_class_subj_day = defaultdict(int)
    for a in assignments:
        key = (a["class_name"], a["subject_code"], a["day"])
        by_class_subj_day[key] += 1
    return sum(c - 1 for c in by_class_subj_day.values() if c > 1)


def report(label, result):
    stats = result.get("stats", {})
    asn = result.get("assignments", [])
    repeats = count_same_day_repeats(asn)
    print(f"\n[{label}]")
    print(f"  status            = {stats.get('solver_status')}")
    print(f"  solve_time        = {stats.get('solve_time_seconds')}s")
    print(f"  total_assignments = {stats.get('total_assignments')}")
    print(f"  unplaced_sessions = {stats.get('unplaced_sessions')}")
    print(f"  same-day repeats  = {repeats}  (soft-spread violations)")


# ─── School: small problem (should be trivial) ───────────────────────────────
school_small = {
    "institution_name": "Smoke Small",
    "subjects": [
        {"name": "Math",    "code": "MATH", "periods_per_week": 5},
        {"name": "Science", "code": "SCI",  "periods_per_week": 4},
        {"name": "English", "code": "ENG",  "periods_per_week": 4},
    ],
    "teachers": [
        {"name": "Alice", "subjects": ["MATH"]},
        {"name": "Bob",   "subjects": ["SCI"]},
        {"name": "Carol", "subjects": ["ENG"]},
    ],
    "classes": [
        {"name": "Class 1", "size": 25},
        {"name": "Class 2", "size": 25},
    ],
    "rooms": [
        {"name": "R1", "capacity": 30},
        {"name": "R2", "capacity": 30},
    ],
    "working_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "periods_per_day": 6,
    "period_duration_minutes": 45,
    "start_time": "08:00",
    "constraints": {"lunch_after_period": 3, "max_periods_per_day_per_teacher": 6},
    "lunch_duration_minutes": 30,
}
report("school: small", solve_school(school_small))


# ─── School: medium problem with stacked soft constraints ────────────────────
school_soft = {
    "institution_name": "Smoke Soft",
    "subjects": [
        {"name": "Math",    "code": "MATH", "periods_per_week": 5},
        {"name": "Science", "code": "SCI",  "periods_per_week": 4},
        {"name": "English", "code": "ENG",  "periods_per_week": 4},
        {"name": "History", "code": "HIST", "periods_per_week": 3},
        {"name": "Art",     "code": "ART",  "periods_per_week": 2},
    ],
    "teachers": [
        {"name": "Alice", "subjects": ["MATH"]},
        {"name": "Bob",   "subjects": ["SCI"]},
        {"name": "Carol", "subjects": ["ENG"]},
        {"name": "Dave",  "subjects": ["HIST"]},
        {"name": "Eve",   "subjects": ["ART"]},
    ],
    "classes": [
        {"name": f"Class {i}", "size": 30} for i in range(1, 5)
    ],
    "rooms": [
        {"name": f"R{i}", "capacity": 35} for i in range(1, 5)
    ],
    "working_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "periods_per_day": 7,
    "period_duration_minutes": 45,
    "start_time": "08:00",
    "constraints": {"lunch_after_period": 4, "max_periods_per_day_per_teacher": 6},
    "lunch_duration_minutes": 30,
    "soft_constraints": [
        {"type": "prefer_morning_subject", "subject_code": "MATH", "weight": 5},
        {"type": "avoid_consecutive_subject", "subject_code": "ART", "weight": 3},
    ],
}
report("school: medium + soft constraints", solve_school(school_soft))


# ─── College: small problem ──────────────────────────────────────────────────
college_small = {
    "institution_name":   "Smoke College",
    "courses": [
        {"code": "CS101", "name": "Intro CS",    "lectures_per_week": 3,
         "enrolled_students": 50, "required_lecture_room_type": "lecture_hall"},
        {"code": "MA101", "name": "Calculus",    "lectures_per_week": 4,
         "enrolled_students": 50, "required_lecture_room_type": "lecture_hall"},
        {"code": "PH101", "name": "Physics",     "lectures_per_week": 3,
         "enrolled_students": 50, "required_lecture_room_type": "lecture_hall"},
    ],
    "faculty": [
        {"code": "F1", "name": "Prof A", "department": "CS",
         "courses_can_teach": ["CS101"], "max_hours_per_week": 18},
        {"code": "F2", "name": "Prof B", "department": "MA",
         "courses_can_teach": ["MA101"], "max_hours_per_week": 18},
        {"code": "F3", "name": "Prof C", "department": "PH",
         "courses_can_teach": ["PH101"], "max_hours_per_week": 18},
    ],
    "rooms": [
        {"name": "LH1", "capacity": 60, "room_type": "lecture_hall"},
        {"name": "LH2", "capacity": 60, "room_type": "lecture_hall"},
    ],
    "working_days":           ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "periods_per_day":        6,
    "period_duration_minutes": 50,
    "start_time":             "09:00",
    "constraints":            {"lunch_after_period": 3,
                               "max_periods_per_day_per_faculty": 5},
    "lunch_duration_minutes": 60,
}
report("college: small", solve_college(college_small))

print("\n--- done ---")
