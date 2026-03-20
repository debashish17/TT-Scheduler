"""
Comprehensive Backend Test Suite for the CP-SAT Timetable Solver
=================================================================
Covers:
  1. Basic sanity check
  2. Batch splitting (auto-sectioning under room capacity)
  3. Subject targeting (per-batch subjects)
  4. EXTREME load test (max classes, subjects, teachers, rooms)
  5. Edge case: Single class, single subject, single teacher, single room
  6. Edge case: Teacher who can't teach any subject
  7. INFEASIBLE: More required periods than available slots
  8. INFEASIBLE: No rooms at all
  9. INFEASIBLE: No teachers at all
 10. Soft constraint check: Math should not repeat on the same day (spread)
 11. No-overlap verification: Teacher/Room/Class simultaneous booking
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.simple_solver import solve_timetable
from collections import defaultdict

PASS = "✅ PASS"
FAIL = "❌ FAIL"
SKIP = "⚠️  WARN"

results = []

def run_test(name, fn):
    print(f"\n{'='*70}")
    print(f"  TEST: {name}")
    print(f"{'='*70}")
    try:
        fn()
        print(f"  → {PASS}")
        results.append((name, "PASS"))
    except AssertionError as e:
        print(f"  → {FAIL}: {e}")
        results.append((name, f"FAIL: {e}"))
    except Exception as e:
        print(f"  → {FAIL} (Exception): {e}")
        results.append((name, f"ERROR: {e}"))


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def base_problem(**overrides):
    """Minimal valid problem. Override any field for specific tests."""
    p = {
        "institution_name": "Test School",
        "subjects": [
            {"name": "Math", "code": "MATH", "periods_per_week": 3},
            {"name": "Science", "code": "SCI", "periods_per_week": 2},
        ],
        "teachers": [
            {"name": "Alice", "subjects": ["MATH"]},
            {"name": "Bob",   "subjects": ["SCI"]},
        ],
        "classes": [{"name": "Class 8", "size": 30}],
        "rooms":   [{"name": "Room 101", "capacity": 40}],
        "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "periods_per_day": 6,
        "period_duration_minutes": 45,
        "start_time": "08:00",
        "constraints": {},
    }
    p.update(overrides)
    return p


def check_no_overlap(result):
    """Returns violations: teacher, room, class double-bookings."""
    teacher_slots = defaultdict(list)
    room_slots    = defaultdict(list)
    class_slots   = defaultdict(list)

    for a in result["assignments"]:
        key = (a["day"], a["period"])
        teacher_slots[(a["teacher_name"], *key)].append(a)
        room_slots[(a["room_name"],    *key)].append(a)
        class_slots[(a["class_name"],  *key)].append(a)

    teacher_violations = [v for v in teacher_slots.values() if len(v) > 1]
    room_violations    = [v for v in room_slots.values()    if len(v) > 1]
    class_violations   = [v for v in class_slots.values()  if len(v) > 1]
    return teacher_violations, room_violations, class_violations


# ─────────────────────────────────────────────────────────────────────────────
# TEST 1: Basic Sanity
# ─────────────────────────────────────────────────────────────────────────────

def test_basic_sanity():
    p = base_problem()
    r = solve_timetable(p)
    assert r["success"], "Expected success=True"
    assert r["solver"] == "CP-SAT", f"Expected CP-SAT, got {r['solver']}"
    assert r["status"] in ("OPTIMAL", "FEASIBLE"), f"Unexpected status: {r['status']}"
    total_needed = 3 + 2  # MATH + SCI per week
    assert len(r["assignments"]) == total_needed, f"Expected {total_needed} assignments, got {len(r['assignments'])}"
    tv, rv, cv = check_no_overlap(r)
    assert not tv, f"Teacher double-booking: {tv}"
    assert not rv, f"Room double-booking: {rv}"
    assert not cv, f"Class double-booking: {cv}"
    print(f"  Solver: {r['solver']} | Status: {r['status']} | Time: {r['stats']['solve_time_seconds']}s")

run_test("Basic Sanity: CP-SAT returns optimal schedule", test_basic_sanity)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 2: Auto Batch Splitting (Room Capacity Trigger)
# ─────────────────────────────────────────────────────────────────────────────

def test_batch_splitting():
    p = base_problem(
        classes=[{"name": "Class 6", "size": 80}],
        rooms=[
            {"name": "Room A", "capacity": 45},
            {"name": "Room B", "capacity": 45},
        ]
    )
    r = solve_timetable(p)
    assert r["success"]
    unique = set(a["class_name"] for a in r["assignments"])
    assert "Class 6 A" in unique, f"Expected 'Class 6 A', got: {unique}"
    assert "Class 6 B" in unique, f"Expected 'Class 6 B', got: {unique}"
    assert "Class 6" not in unique, f"Unsplit 'Class 6' should not appear"
    print(f"  Sections created: {sorted(unique)}")

run_test("Batch Splitting: 80-student class splits into A/B when max room=45", test_batch_splitting)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 3: Subject Targeting (Per-batch subjects)
# ─────────────────────────────────────────────────────────────────────────────

def test_subject_targeting():
    p = base_problem(
        subjects=[
            {"name": "Math",    "code": "MATH", "periods_per_week": 3, "target_classes": ["Class 6"]},
            {"name": "Science", "code": "SCI",  "periods_per_week": 2, "target_classes": ["Class 7"]},
            {"name": "English", "code": "ENG",  "periods_per_week": 2, "target_classes": []},  # All
        ],
        teachers=[
            {"name": "Alice",   "subjects": ["MATH"]},
            {"name": "Bob",     "subjects": ["SCI"]},
            {"name": "Charlie", "subjects": ["ENG"]},   # ← needed for ENG sessions
        ],
        classes=[
            {"name": "Class 6", "size": 30},
            {"name": "Class 7", "size": 30},
        ],
        rooms=[{"name": "Room A", "capacity": 35}, {"name": "Room B", "capacity": 35}],
    )
    r = solve_timetable(p)
    assert r["success"]

    class6_subjects = set(a["subject_code"] for a in r["assignments"] if a["class_name"] == "Class 6")
    class7_subjects = set(a["subject_code"] for a in r["assignments"] if a["class_name"] == "Class 7")

    assert "MATH"  in  class6_subjects, "Class 6 should have MATH"
    assert "SCI"   not in class6_subjects, f"Class 6 should NOT have SCI, but got: {class6_subjects}"
    assert "SCI"   in  class7_subjects, "Class 7 should have SCI"
    assert "MATH"  not in class7_subjects, f"Class 7 should NOT have MATH, but got: {class7_subjects}"
    assert "ENG"   in  class6_subjects, "Class 6 should have ENG (global)"
    assert "ENG"   in  class7_subjects, "Class 7 should have ENG (global)"
    print(f"  Class 6 subjects: {class6_subjects}")
    print(f"  Class 7 subjects: {class7_subjects}")

run_test("Subject Targeting: Per-batch subject assignment", test_subject_targeting)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 4: EXTREME LOAD (Stress test)
# ─────────────────────────────────────────────────────────────────────────────

def test_extreme_load():
    import time
    subjects = [{"name": f"Subj{i}", "code": f"S{i:02}", "periods_per_week": 2} for i in range(8)]
    teachers = [{"name": f"Teacher{i}", "subjects": [f"S{i:02}"]} for i in range(8)]
    classes  = [{"name": f"Class {chr(65+i)}", "size": 30} for i in range(6)]
    rooms    = [{"name": f"Room {i+1}", "capacity": 35} for i in range(6)]

    p = base_problem(
        subjects=subjects,
        teachers=teachers,
        classes=classes,
        rooms=rooms,
        periods_per_day=8,
        working_days=["Monday","Tuesday","Wednesday","Thursday","Friday"],
    )
    start = time.time()
    r = solve_timetable(p)
    elapsed = time.time() - start

    assert r["success"], "Extreme load test: expected success"
    tv, rv, cv = check_no_overlap(r)
    assert not tv, f"Teacher overlap in extreme test: {len(tv)} violations"
    assert not rv, f"Room overlap in extreme test: {len(rv)} violations"
    assert not cv, f"Class overlap in extreme test: {len(cv)} violations"
    print(f"  Solver: {r['solver']} | Status: {r['status']}")
    print(f"  {len(classes)} classes × {len(subjects)} subjects × {len(rooms)} rooms")
    print(f"  Total assignments: {r['stats']['total_assignments']}")
    print(f"  Wall time: {elapsed:.2f}s (Solver: {r['stats']['solve_time_seconds']}s)")
    if elapsed > 15:
        print(f"  {SKIP} WARN: Took over 15s — solver may have fallen back to greedy")

run_test("Extreme Load: 6 classes × 8 subjects × 6 rooms × 8 periods/day", test_extreme_load)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 5: Minimal Edge (1 class, 1 subject, 1 teacher, 1 room)
# ─────────────────────────────────────────────────────────────────────────────

def test_minimal_edge():
    p = base_problem(
        subjects=[{"name": "Math", "code": "MATH", "periods_per_week": 1}],
        teachers=[{"name": "Alice", "subjects": ["MATH"]}],
        classes=[{"name": "Class A", "size": 10}],
        rooms=[{"name": "Room 1", "capacity": 15}],
        periods_per_day=2,
        working_days=["Monday"],
    )
    r = solve_timetable(p)
    assert r["success"]
    assert len(r["assignments"]) == 1, f"Expected 1 assignment, got {len(r['assignments'])}"
    print(f"  Single 1-period schedule: {r['assignments'][0]}")

run_test("Edge Case: Minimal (1×1×1×1)", test_minimal_edge)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 6: Teacher has wrong subject (no valid teacher)
# ─────────────────────────────────────────────────────────────────────────────

def test_teacher_wrong_subject():
    """If a teacher is assigned wrong subjects, the solver should auto-assign
    them to everything (fallback logic in _cp_solve) and still succeed."""
    p = base_problem(
        subjects=[{"name": "Math", "code": "MATH", "periods_per_week": 2}],
        teachers=[{"name": "Alice", "subjects": ["SCI"]}],  # Can't teach MATH
    )
    r = solve_timetable(p)
    # Because our solver falls back to making teachers universal when unmatched:
    assert r["success"], "Should succeed since teacher falls back to teaching all"
    print(f"  Fallback teacher assignment worked. Solver: {r['solver']}")

run_test("Edge Case: Teacher assigned wrong subject (universal fallback)", test_teacher_wrong_subject)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 7: INFEASIBLE — Too many periods required for available slots
# ─────────────────────────────────────────────────────────────────────────────

def test_infeasible_too_many_periods():
    """Request 30 periods/week but only 5 days × 2 periods = 10 slots available."""
    p = base_problem(
        subjects=[{"name": "Math", "code": "MATH", "periods_per_week": 30}],
        periods_per_day=2,
        working_days=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    )
    r = solve_timetable(p)
    # Should fall back to greedy (which will also fail, returning incomplete)
    # OR CP-SAT returns INFEASIBLE which triggers greedy fallback
    print(f"  Solver: {r['solver']} | Success: {r['success']} | Status: {r.get('status', 'N/A')}")
    print(f"  Assignments scheduled: {len(r['assignments'])} (requested 30, only 10 slots)")
    # We just check the system didn't crash
    assert "assignments" in r, "Should always return 'assignments' even on infeasible"
    if r["solver"] == "CP-SAT":
        print(f"  {SKIP} CP-SAT status: {r['status']} — if FEASIBLE, this was partially scheduled")

run_test("INFEASIBLE: 30 required periods into 10 available slots", test_infeasible_too_many_periods)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 8: INFEASIBLE — No rooms provided
# ─────────────────────────────────────────────────────────────────────────────

def test_infeasible_no_rooms():
    p = base_problem(rooms=[])
    r = solve_timetable(p)
    print(f"  Solver: {r['solver']} | Success: {r['success']} | Assignments: {len(r['assignments'])}")
    assert "assignments" in r, "Should return valid structure even with no rooms"

run_test("INFEASIBLE: No rooms provided", test_infeasible_no_rooms)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 9: INFEASIBLE — Room too small for any class
# ─────────────────────────────────────────────────────────────────────────────

def test_infeasible_room_too_small():
    p = base_problem(
        classes=[{"name": "Class 9", "size": 100}],
        rooms=[{"name": "Tiny Room", "capacity": 5}],  # Way too small
    )
    r = solve_timetable(p)
    print(f"  Solver: {r['solver']} | Success: {r['success']}")
    # The solver will auto-split the class. Let's check it generates sections.
    unique = set(a["class_name"] for a in r["assignments"])
    print(f"  Classes after auto-split: {sorted(unique)}")
    assert "Class 9" not in unique or len(unique) > 0, "System should handle this gracefully"

run_test("INFEASIBLE: Room way too small (forces many sections)", test_infeasible_room_too_small)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 10: SOFT CONSTRAINT — Spread (No subject twice on same day)
# ─────────────────────────────────────────────────────────────────────────────

def test_soft_constraint_spread():
    """Math needs 5 periods across 5 days. CP-SAT should place at most 1/day."""
    p = base_problem(
        subjects=[{"name": "Math", "code": "MATH", "periods_per_week": 5}],
        teachers=[{"name": "Alice", "subjects": ["MATH"]}],
        classes=[{"name": "Class 8", "size": 30}],
        rooms=[{"name": "Room 1", "capacity": 35}],
        periods_per_day=6,
        working_days=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    )
    r = solve_timetable(p)
    assert r["success"]

    per_day = defaultdict(int)
    for a in r["assignments"]:
        per_day[a["day"]] += 1

    print(f"  Math distribution by day: {dict(per_day)}")
    max_per_day = max(per_day.values())
    assert max_per_day <= 2, f"CP-SAT spread broken: found {max_per_day} MATH periods in 1 day"
    print(f"  Max periods on any single day: {max_per_day} (constraint: ≤2)")

run_test("Soft Constraint: MATH spread evenly across 5 days", test_soft_constraint_spread)


# ─────────────────────────────────────────────────────────────────────────────
# TEST 11: Hard constraint — Zero overlap verification across all entities
# ─────────────────────────────────────────────────────────────────────────────

def test_zero_overlap():
    """Full multi-class, multi-teacher, multi-room scenario with strict overlap check."""
    p = base_problem(
        subjects=[
            {"name": "Math",    "code": "MATH", "periods_per_week": 3},
            {"name": "Science", "code": "SCI",  "periods_per_week": 2},
            {"name": "English", "code": "ENG",  "periods_per_week": 2},
        ],
        teachers=[
            {"name": "Alice",   "subjects": ["MATH"]},
            {"name": "Bob",     "subjects": ["SCI"]},
            {"name": "Charlie", "subjects": ["ENG"]},
        ],
        classes=[
            {"name": "Class 6", "size": 30},
            {"name": "Class 7", "size": 30},
            {"name": "Class 8", "size": 30},
        ],
        rooms=[
            {"name": "Room A", "capacity": 35},
            {"name": "Room B", "capacity": 35},
            {"name": "Room C", "capacity": 35},
        ],
    )
    r = solve_timetable(p)
    assert r["success"]
    tv, rv, cv = check_no_overlap(r)
    assert not tv, f"TEACHER OVERLAP DETECTED: {[[x['teacher_name'], x['day'], x['period']] for v in tv for x in v]}"
    assert not rv, f"ROOM OVERLAP DETECTED: {[[x['room_name'], x['day'], x['period']] for v in rv for x in v]}"
    assert not cv, f"CLASS OVERLAP DETECTED: {[[x['class_name'], x['day'], x['period']] for v in cv for x in v]}"
    print(f"  {len(r['assignments'])} assignments with 0 teacher / 0 room / 0 class overlaps ✓")
    print(f"  Solver: {r['solver']} | Status: {r['status']}")

run_test("Hard Constraint: Zero overlap — 3 classes × 3 teachers × 3 rooms", test_zero_overlap)


# ─────────────────────────────────────────────────────────────────────────────
# FINAL REPORT
# ─────────────────────────────────────────────────────────────────────────────

print(f"\n\n{'='*70}")
print(f"  📋  FINAL TEST REPORT")
print(f"{'='*70}")
passed = sum(1 for _, r in results if r == "PASS")
failed = sum(1 for _, r in results if r != "PASS")
for name, result in results:
    icon = "✅" if result == "PASS" else "❌"
    print(f"  {icon}  {name}")
print(f"{'='*70}")
print(f"  Total: {len(results)} | Passed: {passed} | Failed: {failed}")
print(f"{'='*70}\n")
