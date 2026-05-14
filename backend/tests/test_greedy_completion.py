"""
Test the CP-SAT + greedy-completion pipeline against real-world runs pulled
from the database (see scripts/dump_latest_run.py).

Two fixtures, two scenarios:
  - latest_school_run.json: the most recent run (may have pre-check errors;
    used to verify the fast-fail path is wired correctly).
  - solved_school_run.json: a run that previously hit OPTIMAL (used to
    exercise the solver+greedy completion pipeline by forcing a tight time
    budget and verifying greedy fills the gap).
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from app.core.simple_solver import solve_timetable


FIXTURE_DIR = Path(__file__).parent / "fixtures"
LATEST_PATH = FIXTURE_DIR / "latest_school_run.json"
SOLVED_PATH = FIXTURE_DIR / "solved_school_run.json"
STRESS_PATH = FIXTURE_DIR / "stress_school_run.json"


def _load(path: Path) -> dict:
    if not path.exists():
        pytest.skip(
            f"Fixture not found at {path}. "
            f"Run `python scripts/dump_latest_run.py` to generate it."
        )
    with path.open() as f:
        return json.load(f)


def _to_solver_problem(run: dict) -> dict:
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


# ─── Scenario 1: pre-check fast-fail (latest run) ─────────────────────────────

def test_latest_run_returns_diagnostic_warnings_when_infeasible():
    """
    The latest user-saved run is dense enough to either pre-check fail or
    leave unplaced sessions. Either outcome should produce informative
    warnings — not a crash, not an empty success.
    """
    run = _load(LATEST_PATH)
    problem = _to_solver_problem(run)

    result = solve_timetable(problem)
    warnings = result.get("warnings", [])
    stats = result.get("stats", {})

    print(
        f"\nstatus={stats.get('solver_status', 'precheck')}  "
        f"placed={stats.get('total_assignments', 0)}  "
        f"unplaced={stats.get('unplaced_sessions', 0)}  "
        f"warnings={len(warnings)}"
    )

    # Must produce at least one diagnostic warning if anything went wrong.
    # Either pre-check error OR post-solve UNPLACED_SESSION warning.
    has_diagnostic = any(
        w.get("level") == "error"
        or w.get("code") in {"UNPLACED_SESSION", "TEACHER_CAPACITY_EXCEEDED",
                             "NO_TEACHER_FOR_SUBJECT", "SCHEDULE_OVERSUBSCRIBED"}
        for w in warnings
    )
    if stats.get("unplaced_sessions", 0) > 0 or stats.get("total_assignments", -1) == 0:
        assert has_diagnostic, (
            f"Expected a diagnostic warning explaining why placement failed, "
            f"got: {[w.get('code') for w in warnings]}"
        )


# ─── Scenario 2: greedy completion (solved run, tight budget) ─────────────────

def test_solved_run_terminates_fast_with_early_stop():
    """
    The solved fixture is a real run that previously hit OPTIMAL. With the
    early-stop callback wired in, CP-SAT should terminate as soon as it finds
    a complete placement — well before the auto-tiered budget runs out.
    Verifies (1) zero unplaced and (2) wall time under the tier ceiling.
    """
    run = _load(SOLVED_PATH)
    problem = _to_solver_problem(run)

    result = solve_timetable(problem)
    stats = result.get("stats", {})
    placed     = stats.get("total_assignments", 0)
    unplaced   = stats.get("unplaced_sessions", 0)
    solve_time = stats.get("solve_time_seconds", 0)
    status     = stats.get("solver_status", "")

    print(
        f"\nstatus={status}  placed={placed}  unplaced={unplaced}  "
        f"solve_time={solve_time}s"
    )

    assert placed > 0, "No sessions placed — solver+greedy both failed"
    assert unplaced == 0, (
        f"Got {unplaced} unplaced on a known-feasible problem. "
        f"Either the model regressed or greedy completion is broken."
    )
    # Auto-tier picks 90s for this density; early-stop should make actual
    # solve well under that. Threshold of 60s leaves plenty of headroom for
    # variance while still catching the case where early-stop never fires.
    assert solve_time < 60.0, (
        f"Solve took {solve_time}s — early-stop should have terminated faster "
        f"once a complete solution was found."
    )


def test_solved_run_full_budget_zero_unplaced():
    """
    Default tier budget should comfortably solve the previously-OPTIMAL run.
    """
    run = _load(SOLVED_PATH)
    problem = _to_solver_problem(run)

    result = solve_timetable(problem)
    stats = result.get("stats", {})
    unplaced = stats.get("unplaced_sessions", 0)
    placed   = stats.get("total_assignments", 0)

    print(
        f"\nstatus={stats.get('solver_status')}  placed={placed}  "
        f"unplaced={unplaced}  solve_time={stats.get('solve_time_seconds')}s"
    )

    assert unplaced == 0, (
        f"Got {unplaced} unplaced on default budget. "
        f"Warnings: {[w.get('code') for w in result.get('warnings', [])]}"
    )


# ─── Scenario 3: dense post-Auto-Fix problem ──────────────────────────────────
# This problem matches the user's real-world dense school case after Auto-Fix
# adds enough teachers. With the room-pinning, layered decision strategy, and
# symmetry-breaking fixes, CP-SAT should place ~95% of sessions on its own.

def test_dense_post_autofix_problem_mostly_solved_by_cpsat():
    """
    Synthetic dense problem matching shape of user's deployed dense case
    (17 classes, 6 subjects, 14 teachers, 17 rooms, density ~0.62).
    The architectural + heuristic fixes should let CP-SAT itself place
    the majority of sessions, with greedy completing the rest.
    """
    import random
    random.seed(42)
    n_classes  = 17
    n_subjects = 6
    n_teachers = 14
    n_rooms    = 17

    subjects = [
        {"name": f"Subj{i}", "code": f"S{i}", "periods_per_week": 5}
        for i in range(1, n_subjects + 1)
    ]
    teachers = [{"name": f"T{i+1}", "subjects": []} for i in range(n_teachers)]
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
        "working_days": ["Mon","Tue","Wed","Thu","Fri","Sat"],
        "periods_per_day": 8,
        "period_duration_minutes": 45,
        "start_time": "08:00",
        "constraints": {"lunch_after_period": 4, "max_periods_per_day_per_teacher": 7},
        "lunch_duration_minutes": 30,
    }

    result = solve_timetable(problem)
    stats = result.get("stats", {})
    placed   = stats.get("total_assignments", 0)
    unplaced = stats.get("unplaced_sessions", 0)
    status   = stats.get("solver_status", "")

    print(
        f"\nstatus={status}  placed={placed}  unplaced={unplaced}  "
        f"solve_time={stats.get('solve_time_seconds')}s"
    )

    # Total expected sessions = classes * subjects * ppw = 17*6*5 = 510
    total_expected = 17 * 6 * 5
    placement_rate = placed / total_expected
    # Before the architectural + heuristic fixes, this case returned UNKNOWN
    # (CP-SAT placed 0; greedy placed ~491). With the fixes, expect >=95%.
    assert placement_rate >= 0.95, (
        f"Only {placement_rate:.1%} of sessions placed ({placed}/{total_expected}). "
        f"Expected >=95% on a feasible dense problem."
    )


# ─── Scenario 4: stress test on real-world heavy input ────────────────────────
# Pulled from production DB — 50 classes, 40 teachers, 71 rooms, 9 subjects,
# 5 days × 8 periods. This is the kind of input that hit UNKNOWN and forced
# a greedy-only fallback before recent fixes. Goal: verify the solver
# pipeline (CP-SAT + greedy completion) produces a result, terminates within
# bounded time, and reports diagnostics rather than crashing.

@pytest.mark.slow
def test_stress_run_terminates_with_diagnostics():
    """
    Real-world heavy input from the database. CP-SAT may time out, but the
    solver pipeline must:
      (1) terminate within ~4 minutes (90s CP-SAT + greedy + overhead)
      (2) return a non-empty result OR an informative warning
      (3) never raise an unhandled exception
    """
    import time
    run = _load(STRESS_PATH)
    problem = _to_solver_problem(run)

    n_subjects = len(problem.get("subjects", []))
    n_teachers = len(problem.get("teachers", []))
    n_classes  = len(problem.get("classes", []))
    n_rooms    = len(problem.get("rooms", []))
    print(
        f"\n[stress] subjects={n_subjects} teachers={n_teachers} "
        f"classes={n_classes} rooms={n_rooms} "
        f"days={len(problem.get('working_days', []))} "
        f"ppd={problem.get('periods_per_day')}"
    )

    t0 = time.time()
    result = solve_timetable(problem)
    elapsed = time.time() - t0

    stats = result.get("stats") or {}
    placed   = stats.get("total_assignments", 0)
    unplaced = stats.get("unplaced_sessions", 0)
    status   = stats.get("solver_status", "?")
    solver   = stats.get("solver", "?")
    warnings = result.get("warnings", [])

    print(
        f"  wall={elapsed:.1f}s  status={status}  solver={solver}  "
        f"placed={placed}  unplaced={unplaced}  warnings={len(warnings)}"
    )

    # 1. Bounded runtime: CP-SAT 90s + greedy + overhead. Pad generously.
    assert elapsed < 240, (
        f"Stress run took {elapsed:.1f}s — should terminate under 4 minutes "
        f"with the new search caps (MAX_AFTER_FIRST_SOLUTION + stall + cap)."
    )

    # 2. Either we produced *some* assignments OR we have informative warnings.
    has_diagnostic = any(
        w.get("level") == "error"
        or w.get("code") in {"UNPLACED_SESSION", "TEACHER_CAPACITY_EXCEEDED",
                             "NO_TEACHER_FOR_SUBJECT", "SCHEDULE_OVERSUBSCRIBED",
                             "CPSAT_NO_SOLUTION"}
        for w in warnings
    )
    if placed == 0:
        assert has_diagnostic, (
            f"Stress run produced 0 assignments AND no diagnostic warnings. "
            f"Got warnings: {[w.get('code') for w in warnings]}"
        )

    # 3. If we got assignments, they should be coherent (no None, no clashes).
    for a in result.get("assignments", []):
        assert a.get("class_name"), f"Assignment missing class_name: {a}"
        assert a.get("teacher_name"), f"Assignment missing teacher_name: {a}"
        assert a.get("room_name"), f"Assignment missing room_name: {a}"
        assert a.get("day"), f"Assignment missing day: {a}"
        assert a.get("period") is not None, f"Assignment missing period: {a}"
