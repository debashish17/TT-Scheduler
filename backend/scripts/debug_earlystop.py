import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
logging.basicConfig(level=logging.INFO)

from app.core.simple_solver import solve_timetable

with open("tests/fixtures/solved_school_run.json") as f:
    run = json.load(f)

problem = {
    "institution_name": run.get("institution_name", "Test"),
    "subjects": run["subjects"],
    "teachers": run["teachers"],
    "classes": run["classes"],
    "rooms": run["rooms"],
    "working_days": run["working_days"],
    "periods_per_day": run["periods_per_day"],
    "period_duration_minutes": run["period_duration_minutes"],
    "lunch_duration_minutes": run.get("lunch_duration_minutes", 0),
    "start_time": run.get("start_time", "08:00"),
    "constraints": run.get("constraints", {}),
    "soft_constraints": run.get("soft_constraints", []),
    "solve_time_limit_seconds": 30.0,
}

t0 = time.time()
r = solve_timetable(problem)
print(f"\nwall={time.time()-t0:.2f}s")
print(f"stats: {r.get('stats')}")
