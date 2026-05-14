"""
Diagnose the stress fixture without modifying any solver code.

Loads tests/fixtures/stress_school_run.json, runs solve_timetable() once,
and prints a structured analysis: capacity ratios, per-subject bottlenecks,
expected vs actual placements, and which constraints likely dominated.
"""
import json
import logging
import os
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

from app.core.simple_solver import solve_timetable


FIXTURE = Path(__file__).parent.parent / "tests" / "fixtures" / "stress_school_run.json"


def _to_problem(run: dict) -> dict:
    return {
        "institution_name":         run.get("institution_name", "Test"),
        "subjects":                 run["subjects"],
        "teachers":                 run["teachers"],
        "classes":                  run["classes"],
        "rooms":                    run["rooms"],
        "working_days":             run["working_days"],
        "periods_per_day":          run["periods_per_day"],
        "period_duration_minutes":  run["period_duration_minutes"],
        "lunch_duration_minutes":   run.get("lunch_duration_minutes", 0),
        "start_time":               run.get("start_time", "08:00"),
        "constraints":              run.get("constraints", {}),
        "soft_constraints":         run.get("soft_constraints", []),
    }


def main() -> None:
    if not FIXTURE.exists():
        print(f"Fixture not found: {FIXTURE}")
        return
    with FIXTURE.open() as f:
        run = json.load(f)

    problem = _to_problem(run)
    subjects = problem["subjects"]
    teachers = problem["teachers"]
    classes  = problem["classes"]
    rooms    = problem["rooms"]
    days     = problem["working_days"]
    ppd      = problem["periods_per_day"]
    cons     = problem.get("constraints", {}) or {}

    n_classes  = len(classes)
    n_teachers = len(teachers)
    n_rooms    = len(rooms)
    n_subjects = len(subjects)
    n_days     = len(days)
    slots_per_class_per_week = n_days * ppd

    print()
    print("=" * 72)
    print("INPUT SHAPE")
    print("=" * 72)
    print(f"  classes={n_classes}  teachers={n_teachers}  rooms={n_rooms}  "
          f"subjects={n_subjects}  days={n_days}  ppd={ppd}")
    print(f"  slots/class/week = {slots_per_class_per_week}")
    print(f"  max_periods_per_day_per_teacher = "
          f"{cons.get('max_periods_per_day_per_teacher', 'unset')}")

    # ─── 1. Per-subject demand vs supply ────────────────────────────────────
    print()
    print("=" * 72)
    print("PER-SUBJECT BOTTLENECK ANALYSIS")
    print("=" * 72)
    max_per_day = int(cons.get("max_periods_per_day_per_teacher", 8))
    teacher_week_cap = min(slots_per_class_per_week, max_per_day * n_days)
    print(f"  Per-teacher weekly cap = {teacher_week_cap} (= min({slots_per_class_per_week}, "
          f"{max_per_day} x {n_days}))")
    print()
    print(f"  {'subj':<8} {'ppw':<4} {'tgt':<4} {'sess':<5} {'qual_t':<7} "
          f"{'cap_real':<9} {'demand/cap':<11} {'verdict'}")
    bottleneck_subjects = []
    for s in subjects:
        ppw = int(s.get("periods_per_week", 3))
        tc  = s.get("target_classes", []) or []
        n_targeted = len(tc) if tc else n_classes
        sessions = ppw * n_targeted
        qualified = [t for t in teachers if s["code"] in t.get("subjects", [])]
        # Realistic capacity: each qualified teacher can fully serve
        # floor(teacher_week_cap / ppw) classes (same-teacher-per-class rule).
        classes_per_teacher = max(1, teacher_week_cap // max(1, ppw))
        cap = len(qualified) * classes_per_teacher * ppw
        ratio = sessions / cap if cap else float("inf")
        verdict = (
            "BOTTLENECK" if ratio > 0.95
            else "tight"  if ratio > 0.75
            else "ok"
        )
        if ratio > 0.95:
            bottleneck_subjects.append(s["code"])
        print(f"  {s['code']:<8} {ppw:<4} {n_targeted:<4} {sessions:<5} "
              f"{len(qualified):<7} {cap:<9} {ratio*100:>9.0f}%  {verdict}")

    # ─── 2. Class-side capacity ─────────────────────────────────────────────
    print()
    print("=" * 72)
    print("CLASS-SIDE LOAD")
    print("=" * 72)
    sessions_per_class = defaultdict(int)
    for s in subjects:
        tc = s.get("target_classes") or [c["name"] for c in classes]
        ppw = int(s.get("periods_per_week", 3))
        for cn in tc:
            sessions_per_class[cn] += ppw
    if sessions_per_class:
        loads = sorted(sessions_per_class.items(), key=lambda kv: -kv[1])
        max_load = loads[0][1]
        min_load = loads[-1][1]
        print(f"  per-class load: min={min_load} max={max_load} "
              f"avg={sum(sessions_per_class.values())/len(sessions_per_class):.1f} "
              f"(slots/class/week={slots_per_class_per_week})")
        if max_load > slots_per_class_per_week:
            print(f"  >>> over-loaded classes (load > {slots_per_class_per_week}):")
            for cn, ld in loads:
                if ld > slots_per_class_per_week:
                    print(f"      {cn}: {ld} sessions vs {slots_per_class_per_week} slots")

    # ─── 3. Room-side capacity (room-pinning aware) ─────────────────────────
    # Each (class, subject) pair pins to one room across all its sessions.
    print()
    print("=" * 72)
    print("ROOM-PINNING LOAD")
    print("=" * 72)
    cs_pairs = 0
    total_sessions = 0
    for s in subjects:
        tc = s.get("target_classes") or [c["name"] for c in classes]
        cs_pairs += len(tc)
        total_sessions += len(tc) * int(s.get("periods_per_week", 3))
    rooms_total_slots = n_rooms * slots_per_class_per_week
    print(f"  total (class, subject) pairs needing room-pinning: {cs_pairs}")
    print(f"  total sessions: {total_sessions}")
    print(f"  total room-slot capacity: {rooms_total_slots}  "
          f"(={n_rooms} rooms x {slots_per_class_per_week} slots/week)")
    print(f"  room utilization if all placed: "
          f"{total_sessions/rooms_total_slots*100:.1f}%")
    print(f"  avg pairs per room: {cs_pairs/n_rooms:.1f}")

    # ─── 4. Teacher-side aggregate ──────────────────────────────────────────
    print()
    print("=" * 72)
    print("TEACHER-SIDE AGGREGATE")
    print("=" * 72)
    total_teacher_capacity = n_teachers * teacher_week_cap
    print(f"  total teacher capacity: {total_teacher_capacity}  "
          f"(={n_teachers} teachers x {teacher_week_cap} periods/week)")
    print(f"  total sessions demand: {total_sessions}")
    print(f"  teacher utilization: {total_sessions/total_teacher_capacity*100:.1f}%")
    # Subject coverage: how many teachers can teach each subject
    print(f"\n  Per-subject teacher coverage:")
    coverage = Counter()
    for t in teachers:
        for c in t.get("subjects", []):
            coverage[c] += 1
    for s in subjects:
        n = coverage.get(s["code"], 0)
        flag = " <- only 1!" if n <= 1 else ""
        print(f"    {s['code']:<8} {s['name']:<20} {n} qualified teacher(s){flag}")

    # ─── 5. Run the actual solver and report ────────────────────────────────
    print()
    print("=" * 72)
    print("ACTUAL SOLVE")
    print("=" * 72)
    t0 = time.time()
    result = solve_timetable(problem)
    elapsed = time.time() - t0
    stats = result.get("stats") or {}
    print()
    print(f"  wall time:        {elapsed:.1f}s")
    print(f"  cpsat status:     {stats.get('solver_status')}")
    print(f"  solver:           {stats.get('solver')}")
    print(f"  placed:           {stats.get('total_assignments')}")
    print(f"  unplaced:         {stats.get('unplaced_sessions')}")
    print(f"  warnings:         {len(result.get('warnings', []))}")

    # Group warnings by code and print top
    by_code = Counter(w.get("code", "?") for w in result.get("warnings", []))
    print(f"\n  Warning breakdown:")
    for code, n in by_code.most_common(10):
        print(f"    {code}: {n}")

    # Per-subject placement: how many sessions of each subject got placed
    print(f"\n  Per-subject placement:")
    placed_by_subj = Counter()
    for a in result.get("assignments", []):
        placed_by_subj[a.get("subject_code", "?")] += 1
    for s in subjects:
        ppw = int(s.get("periods_per_week", 3))
        tc = s.get("target_classes") or [c["name"] for c in classes]
        expected = ppw * len(tc)
        got = placed_by_subj.get(s["code"], 0)
        flag = " <- BOTTLENECK" if s["code"] in bottleneck_subjects else ""
        print(f"    {s['code']:<8} {got:>4}/{expected:<4}  "
              f"({got/expected*100 if expected else 0:.0f}%){flag}")

    print()
    print("=" * 72)
    print("DIAGNOSIS HINTS")
    print("=" * 72)
    if bottleneck_subjects:
        print(f"  - Capacity-bottlenecked subjects: {', '.join(bottleneck_subjects)}")
        print(f"    These will leave sessions unplaced regardless of solver time.")
    else:
        print(f"  - No subject has demand > 95% of qualified-teacher capacity.")
    if stats.get("solver_status") == "UNKNOWN":
        print(f"  - CP-SAT returned UNKNOWN: search space too large to find ANY")
        print(f"    feasible solution within the budget. Greedy fallback engaged.")
    elif stats.get("solver_status") == "FEASIBLE":
        print(f"  - CP-SAT found at least one solution but didn't prove optimality.")


if __name__ == "__main__":
    main()
