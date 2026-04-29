"""
Run this script once to capture a school-solver baseline fixture.

    cd backend
    python -m tests.fixtures.capture_baseline

The output is written to backend/tests/fixtures/school_baseline.json.
Re-run after any refactor that touches simple_solver.py or solver_shared.py
and diff the two files — assignment arrays must be identical.
"""
import json
import os
import sys

# Ensure project root is on sys.path when run as a module from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.core.simple_solver import solve_timetable

PROBLEM = {
    "institution_name": "Baseline School",
    "subjects": [
        {"name": "Mathematics", "code": "MATH", "periods_per_week": 4, "target_classes": []},
        {"name": "English",     "code": "ENG",  "periods_per_week": 3, "target_classes": []},
        {"name": "Science",     "code": "SCI",  "periods_per_week": 3, "target_classes": []},
    ],
    "teachers": [
        {"name": "Alice",   "subjects": ["MATH"], "max_periods_per_week": 20},
        {"name": "Bob",     "subjects": ["ENG"],  "max_periods_per_week": 20},
        {"name": "Charlie", "subjects": ["SCI"],  "max_periods_per_week": 20},
    ],
    "classes": [
        {"name": "Class 10A", "size": 30},
        {"name": "Class 10B", "size": 30},
    ],
    "rooms": [
        {"name": "Room 101", "capacity": 35},
        {"name": "Room 102", "capacity": 35},
    ],
    "working_days":            ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "periods_per_day":         6,
    "period_duration_minutes": 45,
    "start_time":              "08:00",
    "constraints": {
        "max_consecutive_periods":        3,
        "lunch_after_period":             0,
        "max_periods_per_day_per_teacher": 6,
    },
}

OUTPUT = os.path.join(os.path.dirname(__file__), "school_baseline.json")


def main() -> None:
    print("Running school solver baseline capture...")
    result = solve_timetable(PROBLEM)

    # Strip solve_time — it varies between runs and would cause false diffs.
    result.pop("solve_time", None)
    if "stats" in result:
        result["stats"].pop("solve_time_seconds", None)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, sort_keys=True)

    total = result["stats"]["total_assignments"]
    unplaced = result["stats"]["unplaced_sessions"]
    print(f"Done. {total} assignments, {unplaced} unplaced -> {OUTPUT}")


if __name__ == "__main__":
    main()
