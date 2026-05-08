"""
Pull recent school runs from the database and dump them as JSON fixtures
for tests. Generates three files in tests/fixtures/:

  - latest_school_run.json — the most recent run (whatever its status)
  - solved_school_run.json — the most recent run with status=OPTIMAL,
    so tests can exercise the solver+greedy path without hitting
    pre-check failures.
  - stress_school_run.json — the largest recent run by class count,
    used to test solver scalability on real-world heavy inputs.

Run:  venv/Scripts/python scripts/dump_latest_run.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.shared.run import Run, RunKind
from app.models.school.class_ import SchoolClass
from app.repositories import school_run_repo


def main() -> None:
    db = SessionLocal()
    try:
        runs = (
            db.query(Run)
            .filter(Run.kind == RunKind.SCHOOL)
            .order_by(Run.created_at.desc())
            .limit(15)
            .all()
        )
        if not runs:
            print("No school runs found in database.")
            return

        out_dir = os.path.join(
            os.path.dirname(__file__), "..", "tests", "fixtures",
        )
        os.makedirs(out_dir, exist_ok=True)

        latest_path = os.path.join(out_dir, "latest_school_run.json")
        solved_path = os.path.join(out_dir, "solved_school_run.json")
        stress_path = os.path.join(out_dir, "stress_school_run.json")

        latest_run = runs[0]
        solved_run = next((r for r in runs if str(r.status).endswith("OPTIMAL")), None)
        # Stress = run with the highest class count among recent runs (proxy
        # for real-world scale). Tie-break by newest first.
        def _class_count(r: Run) -> int:
            return db.query(SchoolClass).filter_by(run_id=r.id).count()
        stress_run = max(runs, key=_class_count)

        for run, path, label in [
            (latest_run, latest_path, "latest"),
            (solved_run, solved_path, "solved"),
            (stress_run, stress_path, "stress"),
        ]:
            if run is None:
                print(f"No {label} run available, skipping.")
                continue
            payload = school_run_repo.load_run(db, run_id=run.id)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, default=str)
            print(f"[{label}] {run.id} '{run.name}' {run.created_at} status={run.status}")
            print(f"  saved to {path}")
            print(
                f"  subjects={len(payload.get('subjects', []))} "
                f"teachers={len(payload.get('teachers', []))} "
                f"classes={len(payload.get('classes', []))} "
                f"rooms={len(payload.get('rooms', []))} "
                f"days={len(payload.get('working_days', []))} "
                f"ppd={payload.get('periods_per_day')}"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
