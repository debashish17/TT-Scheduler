"""
Smoke test for the room-pinning architectural fix.

Reproduces a dense school problem matching the user's log line:
  CP-SAT: 401 sessions, 6 days, 8 periods, 14 teachers, 17 rooms

Times the full pipeline: model build + CP-SAT + greedy completion. Before
the fix, CP-SAT model build alone took 4+ minutes on this size. After the
fix, expectation is sub-30s wall clock with 0 unplaced.

Run:  venv/Scripts/python scripts/smoke_dense_fix.py
"""
import logging
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

from app.core.simple_solver import solve_timetable


def main() -> None:
    random.seed(42)
    n_classes  = 17
    n_subjects = 6
    n_teachers = 14
    n_rooms    = 17
    ppd        = 8

    subjects = [
        {"name": f"Subj{i}", "code": f"S{i}", "periods_per_week": 5}
        for i in range(1, n_subjects + 1)
    ]
    # Round-robin assign each subject to multiple teachers so each subject has
    # enough capacity. Mirrors what Auto-Fix does after it runs.
    teachers = [{"name": f"T{i+1}", "subjects": []} for i in range(n_teachers)]
    # Each subject needs enough teachers to cover n_classes * ppw sessions.
    # With max_per_day=7 and 6 days, teacher cap = 42; ppw=5 means each teacher
    # can serve 8 classes max. So 17 classes / 8 = ~3 teachers per subject.
    teachers_per_subject = 3
    ti = 0
    for s in subjects:
        for _ in range(teachers_per_subject):
            if s["code"] not in teachers[ti % n_teachers]["subjects"]:
                teachers[ti % n_teachers]["subjects"].append(s["code"])
            ti += 1

    problem = {
        "institution_name": "DenseFix",
        "subjects": subjects,
        "teachers": teachers,
        "classes": [{"name": f"C{i}", "size": 30} for i in range(1, n_classes + 1)],
        "rooms":   [{"name": f"R{i}", "capacity": 35} for i in range(1, n_rooms + 1)],
        "working_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        "periods_per_day": ppd,
        "period_duration_minutes": 45,
        "start_time": "08:00",
        "constraints": {"lunch_after_period": 4, "max_periods_per_day_per_teacher": 7},
        "lunch_duration_minutes": 30,
        # Use auto-tiered budget (90s for this density)
    }

    t0 = time.time()
    result = solve_timetable(problem)
    wall = time.time() - t0
    stats = result.get("stats", {})
    status_value = stats.get("solver_status")
    solve_time = stats.get("solve_time_seconds")
    placed = stats.get("total_assignments")
    unplaced = stats.get("unplaced_sessions")
    n_warn = len(result.get("warnings", []))

    print()
    print(f"  total wall time:  {wall:.2f}s (build + solve + greedy)")
    print(f"  cp-sat status:    {status_value}")
    print(f"  cp-sat solve:     {solve_time}s")
    print(f"  placed:           {placed}")
    print(f"  unplaced:         {unplaced}")
    print(f"  warnings:         {n_warn}")


if __name__ == "__main__":
    main()
