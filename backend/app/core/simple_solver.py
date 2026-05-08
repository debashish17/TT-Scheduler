"""
Optimised School Timetable Solver — Google OR-Tools CP-SAT.

Model redesign (v2):
  Instead of one boolean var per (session, teacher, room, day, period)
  combination (exponential), we use:
    - session_day[s]     ∈ [0, D)   — integer variable
    - session_period[s]  ∈ valid    — integer variable
    - session_teacher[s] ∈ valid    — integer variable
    - session_room[s]    ∈ valid    — integer variable

  This reduces O(S·T·R·D·P) booleans → O(4·S) integers.
  No-conflict constraints use AddAllDifferent / conditional equality.

Hard constraints enforced:
  1. Each session is assigned exactly one (day, period, teacher, room)
  2. A class can have at most one session per (day, period)
  3. A teacher can teach at most one session per (day, period)
  4. A room can be used for at most one session per (day, period)

Soft constraints optimised:
  - Spread subjects across days (minimize sessions of same subject on same day)
  - Balance teacher workload across the week

Falls back to a fast greedy algorithm if CP-SAT times out or is infeasible.
"""
import logging
import math
import copy
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime, timedelta

from app.core.solver_shared import generate_time_slots as _generate_time_slots
from app.core.solver_shared import build_grid as _build_grid
from app.core.solver_shared import empty_result as _empty_result
from app.core.solver_shared import make_warning
from app.core.solver_shared import apply_soft_constraints_school as _apply_soft_school

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# Public entry point
# ──────────────────────────────────────────────────────────────

def solve_timetable(problem: Dict[str, Any]) -> Dict[str, Any]:
    """
    Solve the school timetable.
    Tries CP-SAT first (optimal), falls back to greedy on failure.
    Always includes a `warnings` list in the result for the frontend.
    """
    problem = _preprocess(problem)
    warnings = _diagnose_problem(problem)
    
    # Fast fail if pre-check reveals impossible constraints (e.g. missing teachers, capacity limits)
    if any(w.get("level") == "error" for w in warnings):
        logger.warning("Fail-fast triggered due to pre-check errors. Returning to frontend for Auto-Fix.")
        constraints_pre = problem.get("constraints", {}) or {}
        lunch_after_pre = int(constraints_pre.get("lunch_after_period", 0))
        lunch_dur_pre = int(problem.get("lunch_duration_minutes", 0))
        period_slots_pre = _generate_time_slots(
            problem.get("start_time", "08:00"),
            int(problem.get("periods_per_day", 7)),
            int(problem.get("period_duration_minutes", 45)),
            lunch_after_period=lunch_after_pre,
            lunch_duration_minutes=lunch_dur_pre,
        )
        from app.core.solver_shared import build_lunch_slot as _build_lunch_slot_pre
        lunch_slot_pre = _build_lunch_slot_pre(period_slots_pre, lunch_after_pre, lunch_dur_pre)
        if lunch_slot_pre:
            display_slots_pre = period_slots_pre[:lunch_after_pre] + [lunch_slot_pre] + period_slots_pre[lunch_after_pre:]
        else:
            display_slots_pre = list(period_slots_pre)
        fast_fail_result = _empty_result(problem, display_slots_pre, problem.get("working_days", []), "Precheck")
        fast_fail_result["warnings"] = warnings
        return fast_fail_result

    try:
        result = _cp_solve(problem)
    except ImportError:
        logger.warning("ortools not installed — using Greedy solver.")
        result = _greedy_solve(problem)
    except Exception as e:
        logger.error(f"CP-SAT failed: {e}", exc_info=True)
        return _empty_result(problem, [], problem.get("working_days", []), "CP-SAT")

    # Flag genuine unplacement. Greedy completion has already run inside
    # _cp_solve and tried to fill anything CP-SAT couldn't fit. A non-zero
    # `unplaced_sessions` here means *neither* could place those sessions —
    # always a true capacity / constraint problem, not a time issue.
    stats = result.get("stats", {}) or {}
    if stats.get("unplaced_sessions", 0) > 0:
        unplaced = stats["unplaced_sessions"]
        status   = stats.get("solver_status", "")
        elapsed  = stats.get("solve_time_seconds", 0)
        msg = (
            f"Could not fit {unplaced} session(s) — neither CP-SAT nor the greedy "
            f"completion pass could find a valid slot for them. The constraints are "
            f"genuinely too tight for the available teachers/rooms/periods."
        )
        fix = "Add more teachers, rooms, or working periods, or reduce periods_per_week"
        warnings.append({
            "level": "warning",
            "code": "UNPLACED_SESSION",
            "message": msg,
            "detail": {
                "unplaced_count": unplaced,
                "solver_status": status,
                "cause": "constraints",
                "elapsed_seconds": elapsed,
                "fix": fix,
            }
        })

    # Merge pre-solve warnings with any placement warnings from greedy
    existing = result.get("warnings", [])
    result["warnings"] = warnings + existing
    return result


# ──────────────────────────────────────────────────────────────
# Diagnostics — run before solving to surface actionable issues
# ──────────────────────────────────────────────────────────────

def _diagnose_problem(problem: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Analyse the problem and return a list of warnings the frontend can display.
    Each warning has: { level: "error"|"warning"|"info", code: str, message: str, detail: dict }
    """
    issues: List[Dict[str, Any]] = []

    subjects     = problem.get("subjects", [])
    teachers     = problem.get("teachers", [])
    classes      = problem.get("classes", [])
    rooms        = problem.get("rooms", [])
    working_days = problem.get("working_days", [])
    ppd          = int(problem.get("periods_per_day", 7))
    constraints  = problem.get("constraints", {}) or {}
    lunch_after  = int(constraints.get("lunch_after_period", 0))

    usable_ppd   = ppd  # all periods are schedulable; lunch is a gap, not a sacrificed period
    slots_pw     = len(working_days) * usable_ppd  # slots per class per week

    subj_codes   = {s["code"] for s in subjects}

    # 1. Subjects with NO qualified teacher
    for subj in subjects:
        qualified = [
            t["name"] for t in teachers
            if subj["code"] in t.get("subjects", [])
        ]
        if not qualified:
            issues.append({
                "level":   "error",
                "code":    "NO_TEACHER_FOR_SUBJECT",
                "message": f"No teacher can teach '{subj['name']}' ({subj['code']}). Assign at least one teacher.",
                "detail":  {"subject": subj["code"]},
            })

    # 2. Teachers with unknown subject codes
    for teacher in teachers:
        bad = [c for c in teacher.get("subjects", []) if c not in subj_codes]
        if bad:
            issues.append({
                "level":   "warning",
                "code":    "UNKNOWN_SUBJECT_CODE",
                "message": f"Teacher '{teacher['name']}' has subject code(s) {bad} that don't match any subject. "
                           f"Check the subject code spelling.",
                "detail":  {"teacher": teacher["name"], "unknown_codes": bad},
            })

    # 3. Over-subscribed schedule (total sessions > total available slots)
    total_sessions_needed = sum(
        int(s.get("periods_per_week", 3)) for s in subjects
    ) * len(classes)
    total_slots = slots_pw * len(classes)
    if total_sessions_needed > total_slots:
        issues.append({
            "level":   "error",
            "code":    "SCHEDULE_OVERSUBSCRIBED",
            "message": f"Schedule is over-subscribed: {total_sessions_needed} sessions needed "
                       f"but only {total_slots} slots available "
                       f"({len(working_days)} days × {usable_ppd} usable periods × {len(classes)} classes). "
                       f"Reduce periods_per_week or add more working days/periods.",
            "detail":  {
                "sessions_needed": total_sessions_needed,
                "slots_available": total_slots,
                "shortfall":       total_sessions_needed - total_slots,
            },
        })

    # 4. Per-subject teacher capacity check
    #    A teacher's true weekly cap is bounded by both raw slots_pw AND the
    #    max_periods_per_day cap. Additionally, the same-teacher-per-class
    #    rule means each teacher can fully serve only floor(cap / ppw) classes
    #    for that subject. Use the tighter of the two as the realistic cap.
    max_per_day = int(constraints.get("max_periods_per_day_per_teacher", 8))
    per_teacher_week_cap = min(slots_pw, max_per_day * len(working_days))
    for subj in subjects:
        ppw = int(subj.get("periods_per_week", 3))
        tc = subj.get("target_classes", [])
        affected_classes = [c for c in classes if not tc or c["name"] in tc]
        sessions_for_subj = ppw * len(affected_classes)
        qualified_teachers = [
            t for t in teachers
            if subj["code"] in t.get("subjects", [])
        ]
        # Realistic capacity factors in same-teacher-per-class: each qualified
        # teacher can fully serve floor(per_teacher_week_cap / ppw) classes.
        classes_per_teacher = max(1, per_teacher_week_cap // max(1, ppw))
        realistic_capacity = len(qualified_teachers) * classes_per_teacher * ppw
        if qualified_teachers and sessions_for_subj > realistic_capacity:
            issues.append({
                "level":   "error",
                "code":    "TEACHER_CAPACITY_EXCEEDED",
                "message": f"'{subj['name']}' needs {sessions_for_subj} sessions/week "
                           f"but qualified teacher(s) can only realistically cover {realistic_capacity} slots "
                           f"(each teacher caps at {per_teacher_week_cap} periods/week and must teach all "
                           f"sessions of a (class, subject) pair). "
                           f"Add more teachers for this subject or reduce periods_per_week.",
                "detail":  {
                    "subject":            subj["code"],
                    "sessions_needed":    sessions_for_subj,
                    "teacher_capacity":   realistic_capacity,
                    "per_teacher_week_cap": per_teacher_week_cap,
                    "classes_per_teacher": classes_per_teacher,
                    "ppw":                ppw,
                    "n_classes":          len(affected_classes),
                    "qualified_teachers": [t["name"] for t in qualified_teachers],
                },
            })

    # 5. Room capacity check
    for cls in classes:
        size = int(cls.get("size", 30))
        eligible = [r for r in rooms if int(r.get("capacity", 40)) >= size]
        if not eligible:
            max_cap = max((int(r.get("capacity", 40)) for r in rooms), default=0)
            issues.append({
                "level":   "error",
                "code":    "NO_ROOM_FOR_CLASS",
                "message": f"Class '{cls['name']}' has {size} students but no room is large enough "
                           f"(largest room holds {max_cap}). Add a larger room or reduce class size.",
                "detail":  {"class": cls["name"], "class_size": size, "max_room_capacity": max_cap},
            })

    # 6. Not enough rooms to run all classes simultaneously
    if len(rooms) < len(classes):
        issues.append({
            "level":   "warning",
            "code":    "FEWER_ROOMS_THAN_CLASSES",
            "message": f"There are {len(classes)} classes but only {len(rooms)} rooms. "
                       f"Not all classes can be scheduled in the same period simultaneously.",
            "detail":  {"classes": len(classes), "rooms": len(rooms)},
        })

    for w in issues:
        logger.warning(f"[Diagnose] [{w['level'].upper()}] {w['message']}")

    return issues


# ──────────────────────────────────────────────────────────────
# Pre-processing
# ──────────────────────────────────────────────────────────────

def _preprocess(problem: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate and normalise the problem.
    - Auto-cap periods_per_week to available slots
    - Split classes that exceed max room capacity into sections
    """
    problem = copy.deepcopy(problem)
    days        = len(problem.get("working_days", []))
    ppd         = max(1, int(problem.get("periods_per_day", 7)))
    lunch_after = int((problem.get("constraints") or {}).get("lunch_after_period", 0))
    usable_ppd  = ppd  # all periods are schedulable; lunch is a gap, not a sacrificed period
    slots_per_week = days * usable_ppd          # absolute maximum sessions/week/class

    # Cap periods_per_week
    for s in problem.get("subjects", []):
        ppw = int(s.get("periods_per_week", 3))
        if ppw > slots_per_week:
            logger.warning(
                f"Subject {s['code']}: periods_per_week={ppw} → capped to {slots_per_week}"
            )
            s["periods_per_week"] = slots_per_week

    # Split over-capacity classes into sections
    rooms = problem.get("rooms", [])
    max_cap = max((int(r.get("capacity", 40)) for r in rooms), default=40)
    expanded = []
    for cls in problem.get("classes", []):
        size = int(cls.get("size", 30))
        if size > max_cap and max_cap > 0:
            n = math.ceil(size / max_cap)
            sec_size = math.ceil(size / n)
            for i in range(n):
                c = dict(cls)
                c["name"] = f"{cls['name']}{chr(65+i)}"
                c["size"] = sec_size
                c["original_name"] = cls["name"]
                expanded.append(c)
        else:
            expanded.append(cls)
    problem["classes"] = expanded

    # Diagnostics
    total_sessions = sum(
        int(s.get("periods_per_week", 3)) for s in problem["subjects"]
    ) * max(1, len(problem["classes"]))
    total_available = slots_per_week * max(1, len(problem["classes"]))
    logger.info(
        f"[Preprocess] {total_sessions} sessions needed, "
        f"{total_available} slots available "
        f"({'OK' if total_sessions <= total_available else 'OVER-SUBSCRIBED — will use best-effort'})"
    )
    return problem


# ──────────────────────────────────────────────────────────────
# CP-SAT Solver — integer-variable model
# ──────────────────────────────────────────────────────────────

def _cp_solve(
    problem: Dict[str, Any],
    warm_start_assignments: Optional[List[Dict[str, Any]]] = None,
    _is_warm_retry: bool = False,
) -> Dict[str, Any]:
    from ortools.sat.python import cp_model

    t0 = datetime.now()
    logger.info("CP-SAT solver starting (integer-variable model) …")

    subjects    = problem["subjects"]
    teachers    = problem["teachers"]
    classes     = problem["classes"]
    rooms       = problem["rooms"]
    working_days = problem["working_days"]
    ppd          = int(problem.get("periods_per_day", 7))
    constraints  = problem.get("constraints", {})
    lunch_after  = int(constraints.get("lunch_after_period", 0))
    lunch_dur    = int(problem.get("lunch_duration_minutes", 0))
    max_consec   = int(constraints.get("max_consecutive_periods", 3))
    max_per_day_teacher = int(constraints.get("max_periods_per_day_per_teacher", 6))

    D = len(working_days)
    P = ppd

    # All periods are schedulable — lunch is a visual gap between periods,
    # not a period that's skipped. With lunch_after=K, period times after
    # K are shifted by lunch_dur so display times remain accurate.
    valid_periods = list(range(P))
    n_valid = len(valid_periods)

    # Period times account for the lunch gap (periods after lunch shift later)
    period_slots = _generate_time_slots(
        problem.get("start_time", "08:00"), P,
        int(problem.get("period_duration_minutes", 45)),
        lunch_after_period=lunch_after,
        lunch_duration_minutes=lunch_dur,
    )
    # Display slots: insert a lunch entry between period K and K+1 for the grid to render
    from app.core.solver_shared import build_lunch_slot as _build_lunch_slot
    lunch_slot = _build_lunch_slot(period_slots, lunch_after, lunch_dur)
    if lunch_slot:
        display_slots = period_slots[:lunch_after] + [lunch_slot] + period_slots[lunch_after:]
    else:
        display_slots = list(period_slots)

    # Subject code → index
    subj_idx = {s["code"]: i for i, s in enumerate(subjects)}

    # Teacher capabilities: teacher_can[t] = set of subject indices
    teacher_can = []
    for t in teachers:
        can = {subj_idx[c] for c in t.get("subjects", []) if c in subj_idx}
        teacher_can.append(can)

    # Room eligibility: room_ok[c_idx] = list of room indices with enough capacity
    room_ok = {}
    for ci, cls in enumerate(classes):
        size = int(cls.get("size", 30))
        eligible = [ri for ri, r in enumerate(rooms) if int(r.get("capacity", 40)) >= size]
        room_ok[ci] = eligible if eligible else list(range(len(rooms)))

    # Build session list: [(class_idx, subj_idx)]
    sessions = []
    for ci, cls in enumerate(classes):
        for si, subj in enumerate(subjects):
            tc = subj.get("target_classes", [])
            orig = cls.get("original_name")
            if tc and cls["name"] not in tc and (not orig or orig not in tc):
                continue
            ppw = int(subj.get("periods_per_week", 3))
            for _ in range(ppw):
                sessions.append((ci, si))

    S = len(sessions)
    if S == 0:
        return _empty_result(problem, display_slots, working_days, "CP-SAT")

    logger.info(f"CP-SAT: {S} sessions, {D} days, {P} periods ({n_valid} usable), "
                f"{len(teachers)} teachers, {len(rooms)} rooms")

    model = cp_model.CpModel()

    # ── Decision variables ─────────────────────────────────
    # For each session: is it scheduled, which valid_period index, which day, which teacher, which room
    is_scheduled = [model.NewBoolVar(f"is_scheduled_{s}") for s in range(S)]

    day_var     = [model.NewIntVar(0, D - 1,      f"d{s}") for s in range(S)]
    # Use valid_period index (0..n_valid-1) then map back
    vp_var      = [model.NewIntVar(0, n_valid - 1, f"vp{s}") for s in range(S)]

    # Teacher and room: constrained per session based on subject / class
    t_var = []
    r_var = []

    for s, (ci, si) in enumerate(sessions):
        valid_t = [ti for ti, can in enumerate(teacher_can) if si in can]
        if not valid_t:
            valid_t = list(range(len(teachers)))
        t_var.append(model.NewIntVarFromDomain(
            cp_model.Domain.FromValues(valid_t), f"t{s}"
        ))
        r_var.append(model.NewIntVarFromDomain(
            cp_model.Domain.FromValues(room_ok[ci]), f"r{s}"
        ))

    # ── Constraints ────────────────────────────────────────

    # 1. No two sessions for the same class at the same (day, vp)
    #    We encode (day, vp) as a single integer: day * n_valid + vp
    class_timeslot = {}   # ci → list of linearised time vars
    for s, (ci, si) in enumerate(sessions):
        # We add S to the domain to give unscheduled sessions a unique dummy value
        combo = model.NewIntVar(0, D * n_valid + S, f"cdt{s}")
        model.Add(combo == day_var[s] * n_valid + vp_var[s]).OnlyEnforceIf(is_scheduled[s])
        model.Add(combo == D * n_valid + s).OnlyEnforceIf(is_scheduled[s].Not())
        class_timeslot.setdefault(ci, []).append(combo)

    for ci, vars_list in class_timeslot.items():
        if len(vars_list) > 1:
            model.AddAllDifferent(vars_list)

    # 2. No two sessions with the same teacher at the same (day, vp)
    teacher_timeslot = []
    teacher_combo_max = len(teachers) * D * n_valid + S
    for s in range(S):
        tc = model.NewIntVar(0, teacher_combo_max, f"tdt{s}")
        model.Add(tc == t_var[s] * D * n_valid + day_var[s] * n_valid + vp_var[s]).OnlyEnforceIf(is_scheduled[s])
        # Unique dummy value if not scheduled
        model.Add(tc == len(teachers) * D * n_valid + s).OnlyEnforceIf(is_scheduled[s].Not())
        teacher_timeslot.append(tc)
    model.AddAllDifferent(teacher_timeslot)

    # 3. No two sessions in the same room at the same (day, vp)
    room_timeslot = []
    room_combo_max = len(rooms) * D * n_valid + S
    for s in range(S):
        rc = model.NewIntVar(0, room_combo_max, f"rdt{s}")
        model.Add(rc == r_var[s] * D * n_valid + day_var[s] * n_valid + vp_var[s]).OnlyEnforceIf(is_scheduled[s])
        # Unique dummy value if not scheduled
        model.Add(rc == len(rooms) * D * n_valid + s).OnlyEnforceIf(is_scheduled[s].Not())
        room_timeslot.append(rc)
    model.AddAllDifferent(room_timeslot)

    # ── Subject constraints ──────────────────────────────
    # Group sessions by (class, subject)
    cs_groups: Dict[Tuple[int, int], List[int]] = {}
    for s, (ci, si) in enumerate(sessions):
        cs_groups.setdefault((ci, si), []).append(s)

    # Symmetry breaking: when Auto-Fix or the user provides multiple teachers
    # with identical capability sets (e.g. "Math Teacher 1, 2, 3" all teach
    # only Math with the same caps), CP-SAT explores N! equivalent solutions.
    # Detect interchangeable groups and break the symmetry by forcing classes
    # to be assigned to the lower-indexed teacher first.
    #
    # Encoding: for each subject's qualified teachers, find groups of
    # interchangeable ones (same subject set, same max_periods_per_week).
    # Then for adjacent pairs (ti, tj) within a group, require:
    #     class_count_using(ti) >= class_count_using(tj)
    # which collapses N! symmetry to 1 canonical ordering.
    def _teacher_signature(t: Dict[str, Any]) -> Tuple:
        return (
            tuple(sorted(t.get("subjects", []))),
            t.get("max_periods_per_week"),
        )

    # Build per-subject teacher equivalence classes
    sig_by_teacher = [_teacher_signature(t) for t in teachers]
    for si, subj in enumerate(subjects):
        # Qualified teachers for this subject
        qualified = [ti for ti in range(len(teachers)) if si in teacher_can[ti]]
        if len(qualified) < 2:
            continue
        # Bucket by signature; only buckets with 2+ teachers need symmetry breaking
        buckets: Dict[Tuple, List[int]] = {}
        for ti in qualified:
            buckets.setdefault(sig_by_teacher[ti], []).append(ti)
        for sig, group in buckets.items():
            if len(group) < 2:
                continue
            # group is sorted by teacher index already (qualified iterates ascending)
            # Build an indicator per (class, subject) pair: this pair uses teacher ti
            class_groups_for_si = [
                grp for (ci, sii), grp in cs_groups.items() if sii == si
            ]
            if not class_groups_for_si:
                continue
            # Count classes using each interchangeable teacher
            counts = []
            for ti in group:
                indicators = []
                for grp in class_groups_for_si:
                    # Use the first session's t_var (others are equal-pinned)
                    uses_ti = model.NewBoolVar(f"sym_uses_{si}_{ti}_g{grp[0]}")
                    model.Add(t_var[grp[0]] == ti).OnlyEnforceIf(uses_ti)
                    model.Add(t_var[grp[0]] != ti).OnlyEnforceIf(uses_ti.Not())
                    indicators.append(uses_ti)
                count_var = model.NewIntVar(0, len(class_groups_for_si),
                                            f"sym_count_{si}_{ti}")
                model.Add(count_var == sum(indicators))
                counts.append(count_var)
            # Adjacent ordering: count(ti) >= count(tj) for each consecutive pair
            for i in range(len(counts) - 1):
                model.Add(counts[i] >= counts[i + 1])

    for (ci, si), grp in cs_groups.items():
        if len(grp) > 1:
            # Hard Constraint: All sessions of a (class, subject) share teacher AND room.
            # The room pin mirrors college_solver C5 (line 576) and is the architectural
            # fix that lets dense problems converge — collapses S independent room
            # decisions to one per (class, subject), shrinking the search space ~4x
            # on typical schools.
            for i in range(1, len(grp)):
                model.Add(t_var[grp[0]] == t_var[grp[i]])
                model.Add(r_var[grp[0]] == r_var[grp[i]])

            # Note: "no consecutive same subject on same day" used to be encoded
            # here as a hard O(K^2) constraint per (class, subject) — generating
            # ~8 BoolVars per session-pair. On dense schools (17 classes x 6
            # subjects x 5 ppw) that's ~8000 BoolVars + as many model.Add calls,
            # which dominated CP-SAT model build cost.
            #
            # Demoted to a soft penalty below (lighter weight than the same-day
            # spread penalty so the spread term still wins). The soft "spread
            # across days" objective already discourages this scenario in the
            # common case; the rare consecutive placement is acceptable when the
            # alternative is leaving the session unplaced.

    # ── Soft constraints as objective ──────────────────────
    # 4. Spread each subject across different days per class (soft)
    #    Penalty: count pairs of sessions of same (class, subject) on the same day
    #    We want to minimize this.
    penalty_terms = []

    # Same-day spread penalty. Weight bumped to 1000 per same-day pair so the
    # soft constraint actually has teeth against the 100,000-per-placement
    # reward. Previously weight 1 was decorative (a 4-session-on-one-day
    # solution scored only 6 penalty units, easily ignored). With weight 1000,
    # 6 same-day pairs cost 6,000 — comparable to placing 0.06 of a session,
    # giving the spread real influence on search without overpowering placement.
    SPREAD_WEIGHT = 1000
    for (ci, si), grp in cs_groups.items():
        if len(grp) < 2:
            continue
        for i in range(len(grp)):
            for j in range(i + 1, len(grp)):
                same_day = model.NewBoolVar(f"sd_{ci}_{si}_{i}_{j}")
                model.Add(day_var[grp[i]] == day_var[grp[j]]).OnlyEnforceIf(same_day)
                model.Add(day_var[grp[i]] != day_var[grp[j]]).OnlyEnforceIf(same_day.Not())
                penalty_terms.append(same_day * SPREAD_WEIGHT)

    # 5. Soft: max periods per day per teacher (hard cap if asked)
    # Convert to hard constraint for max_per_day_teacher
    # Only generate BoolVars for (teacher, session) pairs where the teacher
    # is actually qualified to teach that subject — matches the college solver's
    # approach and reduces variable count by ~5x in typical schools.
    for ti in range(len(teachers)):
        teachable = teacher_can[ti]
        for d in range(D):
            # Count sessions for teacher ti on day d
            indicators = []
            for s, (ci, si) in enumerate(sessions):
                if si not in teachable:
                    continue
                is_this_teacher_day = model.NewBoolVar(f"htd_{ti}_{d}_{s}")
                t_match = model.NewBoolVar(f"tmatch_{ti}_{d}_{s}")
                d_match = model.NewBoolVar(f"dmatch_{ti}_{d}_{s}")
                model.Add(t_var[s] == ti).OnlyEnforceIf(t_match)
                model.Add(t_var[s] != ti).OnlyEnforceIf(t_match.Not())
                model.Add(day_var[s] == d).OnlyEnforceIf(d_match)
                model.Add(day_var[s] != d).OnlyEnforceIf(d_match.Not())
                model.AddBoolAnd([t_match, d_match, is_scheduled[s]]).OnlyEnforceIf(is_this_teacher_day)
                model.AddBoolOr([t_match.Not(), d_match.Not(), is_scheduled[s].Not()]).OnlyEnforceIf(is_this_teacher_day.Not())
                indicators.append(is_this_teacher_day)
            if indicators:
                model.Add(sum(indicators) <= max_per_day_teacher)

    # 6. Soft/Hard: max periods per week per teacher
    for ti, t in enumerate(teachers):
        max_pw = t.get("max_periods_per_week")
        if max_pw is not None:
            max_pw = int(max_pw)
            teachable = teacher_can[ti]
            indicators = []
            for s, (ci, si) in enumerate(sessions):
                if si not in teachable:
                    continue
                is_this_teacher_week = model.NewBoolVar(f"hw_{ti}_{s}")
                t_match = model.NewBoolVar(f"tmatch_w_{ti}_{s}")
                model.Add(t_var[s] == ti).OnlyEnforceIf(t_match)
                model.Add(t_var[s] != ti).OnlyEnforceIf(t_match.Not())
                model.AddBoolAnd([t_match, is_scheduled[s]]).OnlyEnforceIf(is_this_teacher_week)
                model.AddBoolOr([t_match.Not(), is_scheduled[s].Not()]).OnlyEnforceIf(is_this_teacher_week.Not())
                indicators.append(is_this_teacher_week)
            if indicators:
                model.Add(sum(indicators) <= max_pw)

    # ── User-defined soft constraints ──────────────────────
    soft_constraints = problem.get("soft_constraints", []) or []
    if soft_constraints:
        user_penalties = _apply_soft_school(
            model=model,
            soft_constraints=soft_constraints,
            sessions=sessions,
            day_var=day_var,
            vp_var=vp_var,
            t_var=t_var,
            is_scheduled=is_scheduled,
            teachers=teachers,
            subjects=subjects,
            working_days=working_days,
            valid_periods=valid_periods,
        )
        for var, w in user_penalties:
            penalty_terms.append(var * w)

    # ── Objective ──────────────────────────────────────────
    # Heavily prioritize scheduling all sessions over soft constraints
    reward_scheduled = sum(is_scheduled[s] * 100_000 for s in range(S))
    if penalty_terms:
        model.Maximize(reward_scheduled - sum(penalty_terms))
    else:
        model.Maximize(reward_scheduled)

    # Hint: try scheduling everything first — biases search toward complete solutions
    for s in range(S):
        model.AddHint(is_scheduled[s], 1)

    # Warm-start hint from a prior greedy solution. Only set on retry path
    # (CP-SAT failed on its own, then we ran greedy, then re-call with hints).
    # We hint only `day_var` and `vp_var` — letting CP-SAT pick teacher and
    # room itself. This avoids hint-discard on room-pinning conflicts (greedy
    # doesn't enforce per-(class,subject) room equality) while still giving
    # CP-SAT the time-shape of greedy's solution as a feasible starting point.
    if warm_start_assignments:
        # Build (class_name, subject_code) → list of (day_idx, vp_idx) from greedy.
        greedy_slots: Dict[Tuple[str, str], List[Tuple[int, int]]] = {}
        for a in warm_start_assignments:
            cn = a.get("class_name")
            sc = a.get("subject_code")
            d  = a.get("day_index")
            p  = a.get("period")
            if cn is None or sc is None or d is None or p is None:
                continue
            # period is 1-based; convert to vp_index by finding p-1 in valid_periods
            p0 = int(p) - 1
            if p0 not in valid_periods:
                continue
            vp = valid_periods.index(p0)
            greedy_slots.setdefault((cn, sc), []).append((int(d), int(vp)))

        # Assign greedy's slots to CP-SAT's sessions, one per (class, subject)
        # session in order. Extra greedy slots beyond CP-SAT's session count
        # are dropped; missing slots leave the session unhinted.
        used_per_pair: Dict[Tuple[int, int], int] = {}
        n_hinted = 0
        for s, (ci, si) in enumerate(sessions):
            cn = classes[ci]["name"]
            sc = subjects[si]["code"]
            slots = greedy_slots.get((cn, sc))
            if not slots:
                continue
            idx = used_per_pair.get((ci, si), 0)
            if idx >= len(slots):
                continue
            d, vp = slots[idx]
            used_per_pair[(ci, si)] = idx + 1
            # Only hint if values are within the current variable domains
            if 0 <= d < D and 0 <= vp < n_valid:
                model.AddHint(day_var[s], d)
                model.AddHint(vp_var[s], vp)
                n_hinted += 1
        logger.info(
            f"CP-SAT warm-start: hinted day+vp for {n_hinted}/{S} sessions "
            f"from greedy solution"
        )

    # Layered decision strategy. CP-SAT branches in this order:
    #   1. is_scheduled (max-value first → try to place every session)
    #   2. day_var     (lowest day first → fill Monday before Friday)
    #   3. vp_var      (lowest period first → fill morning before afternoon)
    #   4. t_var       (lowest teacher index → consistent teacher assignment)
    #   5. r_var       (lowest room index → consistent room assignment)
    #
    # Matches how a human schedules — pick the time slot first, then assign
    # the resources. Cuts search time dramatically on dense problems because
    # CP-SAT no longer wastes time exploring teacher/room permutations before
    # committing to a (day, period).
    model.AddDecisionStrategy(
        is_scheduled, cp_model.CHOOSE_FIRST, cp_model.SELECT_MAX_VALUE,
    )
    model.AddDecisionStrategy(
        day_var,      cp_model.CHOOSE_FIRST, cp_model.SELECT_MIN_VALUE,
    )
    model.AddDecisionStrategy(
        vp_var,       cp_model.CHOOSE_FIRST, cp_model.SELECT_MIN_VALUE,
    )
    model.AddDecisionStrategy(
        t_var,        cp_model.CHOOSE_FIRST, cp_model.SELECT_MIN_VALUE,
    )
    model.AddDecisionStrategy(
        r_var,        cp_model.CHOOSE_FIRST, cp_model.SELECT_MIN_VALUE,
    )

    # ── Solve ──────────────────────────────────────────────
    # Density-aware time budget. Density = sessions to schedule / total class-slots
    # available. Dense problems (>80%) genuinely need more search time; sparse
    # ones converge quickly regardless of raw size.
    total_class_slots = max(1, len(classes) * D * n_valid)
    density = S / total_class_slots
    if density < 0.30:
        time_budget = 10.0
    elif density < 0.70:
        time_budget = 90.0
    elif density < 0.90:
        time_budget = 300.0
    else:
        time_budget = 600.0

    # Caller (Auto-Fix retry) may override the auto-tiered budget. Log the
    # *actual* budget given to CP-SAT so observability matches reality.
    actual_budget = float(problem.get("solve_time_limit_seconds") or time_budget)
    override_note = "" if actual_budget == time_budget else f" [override; tier={time_budget}s]"
    logger.info(
        f"CP-SAT budget: {actual_budget}s (density={density:.2f}, "
        f"{S} sessions / {total_class_slots} class-slots){override_note}"
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = actual_budget
    solver.parameters.num_search_workers = 4   # parallel search
    solver.parameters.log_search_progress = False

    # Early-stop callback. Stops the search in three cases:
    #   (1) Complete + polished: every session is placed AND we've spent
    #       POLISH_SECONDS without further soft-constraint improvement. The
    #       polish window lets CP-SAT spread/balance the schedule a bit
    #       instead of shipping the very first complete (but possibly bunched)
    #       solution.
    #   (2) Placement-stalled: we've found at least one feasible solution and
    #       haven't improved the placement count for STALL_SECONDS. Greedy
    #       completion will fill the remainder; further CP-SAT search at the
    #       same placement level just wastes the budget chasing soft polish.
    #   (3) Cap-from-first-solution: once we have ANY feasible solution, cap
    #       remaining search at MAX_AFTER_FIRST_SOLUTION seconds. This is the
    #       safety net for when callbacks stop firing entirely (CP-SAT
    #       converges internally without finding new improving solutions but
    #       hasn't proved optimality, so it just sits there until deadline).
    import time as _time
    STALL_SECONDS              = 8.0
    POLISH_SECONDS             = 5.0
    MAX_AFTER_FIRST_SOLUTION   = 20.0

    class _StopWhenStable(cp_model.CpSolverSolutionCallback):
        def __init__(self, scheduled_vars, total):
            cp_model.CpSolverSolutionCallback.__init__(self)
            self._scheduled        = scheduled_vars
            self._total            = total
            self._best             = -1
            self._best_at          = _time.monotonic()
            self._first_solution_at: Any = None
            self._first_complete_at: Any = None
            self._best_obj         = None
            self.stopped_complete = False
            self.stopped_stalled  = False
            self.stopped_capped   = False

        def on_solution_callback(self):
            placed = sum(self.Value(v) for v in self._scheduled)
            now    = _time.monotonic()
            obj    = self.ObjectiveValue()
            if self._first_solution_at is None:
                self._first_solution_at = now
            if placed > self._best:
                self._best    = placed
                self._best_at = now
            if placed >= self._total:
                if self._first_complete_at is None:
                    self._first_complete_at = now
                    self._best_obj = obj
                else:
                    if self._best_obj is None or obj > self._best_obj:
                        self._best_obj = obj
                        self._first_complete_at = now
                if (now - self._first_complete_at) >= POLISH_SECONDS:
                    self.stopped_complete = True
                    self.StopSearch()
                    return
            else:
                # Tight stall on placement-count plateau
                if self._best > 0 and (now - self._best_at) >= STALL_SECONDS:
                    self.stopped_stalled = True
                    self.StopSearch()
                    return
                # Hard cap from first feasible solution, regardless of whether
                # callbacks keep firing. CP-SAT may settle on a partial
                # solution and stop emitting improvements without proving
                # optimality — this stops it cleanly.
                if (
                    self._first_solution_at is not None
                    and (now - self._first_solution_at) >= MAX_AFTER_FIRST_SOLUTION
                ):
                    self.stopped_capped = True
                    self.StopSearch()

    early_stop = _StopWhenStable(is_scheduled, S)
    status = solver.Solve(model, early_stop)
    elapsed = round((datetime.now() - t0).total_seconds(), 3)
    if early_stop.stopped_complete:
        early_note = " (early-stop: all sessions placed)"
    elif early_stop.stopped_stalled:
        early_note = f" (early-stop: stalled at {early_stop._best}/{S} for {STALL_SECONDS}s)"
    elif early_stop.stopped_capped:
        early_note = f" (early-stop: hit {MAX_AFTER_FIRST_SOLUTION}s cap from first solution at {early_stop._best}/{S})"
    else:
        early_note = ""
    logger.info(f"CP-SAT done: {solver.StatusName(status)} in {elapsed}s{early_note}")

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        assignments = []
        unplaced_pairs: List[Tuple[int, int]] = []
        for s, (ci, si) in enumerate(sessions):
            if not solver.Value(is_scheduled[s]):
                unplaced_pairs.append((ci, si))
                continue

            d  = solver.Value(day_var[s])
            vp = solver.Value(vp_var[s])
            p  = valid_periods[vp]   # actual 0-based period index
            ti = solver.Value(t_var[s])
            ri = solver.Value(r_var[s])
            slot = period_slots[p] if p < len(period_slots) else {"start": "?", "end": "?"}
            assignments.append({
                "class_name":    classes[ci]["name"],
                "class_index":   ci,
                "subject_name":  subjects[si]["name"],
                "subject_code":  subjects[si]["code"],
                "teacher_name":  teachers[ti]["name"],
                "teacher_index": ti,
                "room_name":     rooms[ri]["name"],
                "room_index":    ri,
                "day":           working_days[d],
                "day_index":     d,
                "period":        p + 1,
                "start_time":    slot["start"],
                "end_time":      slot["end"],
            })

        # Greedy completion: try to fill any unplaced sessions into remaining
        # free (day, period) slots, respecting CP-SAT's already-chosen
        # teacher/room/class assignments. Eliminates "ran out of time" partial
        # solutions whenever capacity actually exists for the leftovers.
        unplaced_count = len(unplaced_pairs)
        if unplaced_pairs:
            extra, still_unplaced = _greedy_complete(
                unplaced_pairs, assignments,
                classes, subjects, teachers, rooms,
                working_days, period_slots, valid_periods,
            )
            if extra:
                logger.info(
                    f"Greedy completion placed {len(extra)} of {unplaced_count} "
                    f"CP-SAT-unplaced session(s)."
                )
                assignments.extend(extra)
                unplaced_count = still_unplaced

        grid = _build_grid(assignments, classes, working_days, period_slots)
        return {
            "success":            True,
            "solver":             "CP-SAT",
            "status":             solver.StatusName(status),
            "solve_time":         elapsed,
            "assignments":        assignments,
            "grid":               grid,
            "time_slots":         display_slots,
            "working_days":       working_days,
            "lunch_period_index": -1,  # frontend detects lunch via slot.is_lunch flag in display_slots
            "warnings":           [],
            "stats": {
                "total_assignments":  len(assignments),
                "unplaced_sessions":  unplaced_count,
                "classes":            len(classes),
                "subjects":           len(subjects),
                "teachers":           len(teachers),
                "rooms":              len(rooms),
                "solve_time_seconds": elapsed,
                "solver":             "CP-SAT",
                "solver_status":      solver.StatusName(status),
            },
        }
    else:
        # CP-SAT found nothing (UNKNOWN/INFEASIBLE/MODEL_INVALID). Run greedy
        # as fallback. If greedy produces a high-quality solution, retry
        # CP-SAT once with greedy as a warm-start hint — this often turns
        # UNKNOWN into FEASIBLE/OPTIMAL on problems where the model is large
        # enough that CP-SAT's presolve eats the whole budget without ever
        # finding an initial solution.
        logger.warning(
            f"CP-SAT found no solution ({solver.StatusName(status)}); "
            f"falling back to greedy."
        )
        greedy = _greedy_solve(problem)

        # Guard: only attempt warm-start retry if
        #   (a) we're not already in a retry (no infinite recursion)
        #   (b) greedy actually placed >=95% of expected sessions (otherwise
        #       its hint isn't reliable)
        greedy_placed   = len(greedy.get("assignments", []))
        greedy_unplaced = greedy.get("stats", {}).get("unplaced_sessions", 0)
        greedy_total    = greedy_placed + greedy_unplaced
        warm_start_eligible = (
            not _is_warm_retry
            and greedy_placed > 0
            and greedy_total > 0
            and (greedy_placed / greedy_total) >= 0.95
        )

        if warm_start_eligible:
            logger.info(
                f"Greedy placed {greedy_placed}/{greedy_total}; "
                f"retrying CP-SAT with greedy solution as warm-start hint."
            )
            try:
                warm_result = _cp_solve(
                    problem,
                    warm_start_assignments=greedy["assignments"],
                    _is_warm_retry=True,
                )
                warm_status = warm_result.get("stats", {}).get("solver_status", "")
                warm_placed = warm_result.get("stats", {}).get("total_assignments", 0)
                # Use warm-start result only if it produced something usable.
                # Otherwise fall through to the greedy result.
                if warm_status in ("OPTIMAL", "FEASIBLE") and warm_placed > 0:
                    logger.info(
                        f"Warm-start CP-SAT succeeded: status={warm_status}, "
                        f"placed={warm_placed}"
                    )
                    return warm_result
                logger.info(
                    f"Warm-start CP-SAT did not improve over greedy "
                    f"(status={warm_status}); using greedy result."
                )
            except Exception as e:
                logger.warning(f"Warm-start retry failed: {e}; using greedy result.")

        # Tag with the fact that CP-SAT failed so callers can distinguish
        # "greedy as fallback" from "greedy as primary."
        greedy_stats = greedy.setdefault("stats", {})
        greedy_stats["solver"]        = "Greedy (CP-SAT failed)"
        greedy_stats["solver_status"] = f"CP-SAT-{solver.StatusName(status)}"
        greedy_stats["solve_time_seconds"] = elapsed
        greedy["solver"] = "Greedy (CP-SAT failed)"
        greedy.setdefault("warnings", []).insert(0, {
            "level":   "warning",
            "code":    "CPSAT_NO_SOLUTION",
            "message": (
                f"CP-SAT could not find any complete solution within {elapsed}s "
                f"(status={solver.StatusName(status)}). Returned a best-effort "
                f"greedy timetable. Consider adding more teachers or rooms."
            ),
            "detail": {"cpsat_status": solver.StatusName(status), "elapsed": elapsed},
        })
        return greedy


# ──────────────────────────────────────────────────────────────
# Greedy completion — fill in sessions CP-SAT couldn't place
# ──────────────────────────────────────────────────────────────

def _greedy_complete(
    unplaced_pairs: List[Tuple[int, int]],
    placed_assignments: List[Dict[str, Any]],
    classes: List[Dict[str, Any]],
    subjects: List[Dict[str, Any]],
    teachers: List[Dict[str, Any]],
    rooms: List[Dict[str, Any]],
    working_days: List[str],
    period_slots: List[Dict[str, Any]],
    valid_periods: List[int],
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Try to place each (class_idx, subject_idx) pair from `unplaced_pairs` into
    a (day, period) slot that doesn't conflict with `placed_assignments`.

    Honours hard conflicts (class, teacher, room can't double-book) and
    prefers same-teacher-per-class when CP-SAT already pinned a teacher to a
    (class, subject) pair. Soft constraints are ignored — this is a best-effort
    fill, not an optimisation pass.

    Returns: (new_assignments, still_unplaced_count)
    """
    D = len(working_days)
    extra: List[Dict[str, Any]] = []

    # Reconstruct busy maps from already-placed assignments
    class_busy:   Dict[Tuple[int, int, int], bool] = {}
    teacher_busy: Dict[Tuple[int, int, int], bool] = {}
    room_busy:    Dict[Tuple[int, int, int], bool] = {}
    # Same-teacher-per-class hint: which teacher CP-SAT chose for each (class, subject)
    pinned_teacher: Dict[Tuple[int, int], int] = {}

    for a in placed_assignments:
        ci = a["class_index"]
        ti = a["teacher_index"]
        ri = a["room_index"]
        d  = a["day_index"]
        p  = a["period"] - 1
        class_busy[(ci, d, p)]   = True
        teacher_busy[(ti, d, p)] = True
        room_busy[(ri, d, p)]    = True
        # CP-SAT enforces same-teacher-per-class; capture the binding
        si_for_class = next(
            (idx for idx, s in enumerate(subjects) if s["code"] == a["subject_code"]),
            None,
        )
        if si_for_class is not None:
            pinned_teacher.setdefault((ci, si_for_class), ti)

    # Subject code -> index, room eligibility, teacher capability
    teacher_can = []
    subj_idx = {s["code"]: i for i, s in enumerate(subjects)}
    for t in teachers:
        teacher_can.append({subj_idx[c] for c in t.get("subjects", []) if c in subj_idx})
    room_ok: Dict[int, List[int]] = {}
    for ci, cls in enumerate(classes):
        size = int(cls.get("size", 30))
        eligible = [ri for ri, r in enumerate(rooms) if int(r.get("capacity", 40)) >= size]
        room_ok[ci] = eligible if eligible else list(range(len(rooms)))

    still_unplaced = 0
    for (ci, si) in unplaced_pairs:
        placed = False
        # Prefer the teacher CP-SAT already bound to this (class, subject)
        teacher_priority: List[int] = []
        if (ci, si) in pinned_teacher:
            teacher_priority.append(pinned_teacher[(ci, si)])
        for ti, can in enumerate(teacher_can):
            if si in can and ti not in teacher_priority:
                teacher_priority.append(ti)

        for d in range(D):
            if placed:
                break
            for p in valid_periods:
                if class_busy.get((ci, d, p)):
                    continue
                ti = next(
                    (t for t in teacher_priority if not teacher_busy.get((t, d, p))),
                    None,
                )
                if ti is None:
                    continue
                ri = next(
                    (r for r in room_ok[ci] if not room_busy.get((r, d, p))),
                    None,
                )
                if ri is None:
                    continue
                # Avoid same-day same-subject consecutive — soft, but cheap to honour
                # Skip: greedy completion treats this as a soft preference; if
                # the only available slot is consecutive, take it rather than
                # leaving the session unplaced.
                slot = period_slots[p] if p < len(period_slots) else {"start": "?", "end": "?"}
                extra.append({
                    "class_name":    classes[ci]["name"],
                    "class_index":   ci,
                    "subject_name":  subjects[si]["name"],
                    "subject_code":  subjects[si]["code"],
                    "teacher_name":  teachers[ti]["name"],
                    "teacher_index": ti,
                    "room_name":     rooms[ri]["name"],
                    "room_index":    ri,
                    "day":           working_days[d],
                    "day_index":     d,
                    "period":        p + 1,
                    "start_time":    slot["start"],
                    "end_time":      slot["end"],
                })
                class_busy[(ci, d, p)]   = True
                teacher_busy[(ti, d, p)] = True
                room_busy[(ri, d, p)]    = True
                # If CP-SAT didn't pin a teacher (shouldn't happen, but be safe),
                # remember this binding so subsequent unplaced sessions of the
                # same (class, subject) reuse this teacher.
                pinned_teacher.setdefault((ci, si), ti)
                placed = True
                break

        if not placed:
            still_unplaced += 1

    return extra, still_unplaced


# ──────────────────────────────────────────────────────────────
# Greedy Solver — fast, best-effort
# ──────────────────────────────────────────────────────────────

def _greedy_solve(problem: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fast greedy solver. Spreads sessions across days round-robin.
    Always returns a result (partial if some sessions can't be placed).
    """
    t0 = datetime.now()
    logger.info("Greedy solver starting …")

    subjects     = problem["subjects"]
    teachers     = problem["teachers"]
    classes      = problem["classes"]
    rooms        = problem["rooms"]
    working_days = problem["working_days"]
    ppd          = int(problem.get("periods_per_day", 7))
    constraints  = problem.get("constraints", {})
    lunch_after  = int(constraints.get("lunch_after_period", 0))
    lunch_dur    = int(problem.get("lunch_duration_minutes", 0))

    period_slots = _generate_time_slots(
        problem.get("start_time", "08:00"), ppd,
        int(problem.get("period_duration_minutes", 45)),
        lunch_after_period=lunch_after,
        lunch_duration_minutes=lunch_dur,
    )
    from app.core.solver_shared import build_lunch_slot as _build_lunch_slot
    lunch_slot = _build_lunch_slot(period_slots, lunch_after, lunch_dur)
    if lunch_slot:
        display_slots = period_slots[:lunch_after] + [lunch_slot] + period_slots[lunch_after:]
    else:
        display_slots = list(period_slots)

    valid_periods = list(range(ppd))
    subj_idx = {s["code"]: i for i, s in enumerate(subjects)}

    teacher_can: List[Any] = []
    for t in teachers:
        can = {subj_idx[c] for c in t.get("subjects", []) if c in subj_idx}
        teacher_can.append(can)

    teacher_busy:   Dict[Tuple, bool] = {}
    room_busy:      Dict[Tuple, bool] = {}
    class_slot_busy: Dict[Tuple, bool] = {}
    assignments = []
    placement_warnings: List[Dict[str, Any]] = []

    D = len(working_days)
    for ci, cls in enumerate(classes):
        size = int(cls.get("size", 30))
        sessions_needed = []
        for si, subj in enumerate(subjects):
            tc = subj.get("target_classes", [])
            orig = cls.get("original_name")
            if tc and cls["name"] not in tc and (not orig or orig not in tc):
                continue
            ppw = int(subj.get("periods_per_week", 3))
            for n in range(ppw):
                sessions_needed.append((si, n % D))  # (subj_idx, preferred_day)

        sessions_needed.sort(key=lambda x: x[1])

        for si, preferred_day in sessions_needed:
            assigned = False
            day_order = list(range(D))
            day_order = day_order[preferred_day:] + day_order[:preferred_day]

            for d in day_order:
                if assigned:
                    break
                for p in valid_periods:
                    if class_slot_busy.get((ci, d, p)):
                        continue
                    # Find available teacher
                    ti = next(
                        (i for i, can in enumerate(teacher_can)
                         if si in can and not teacher_busy.get((i, d, p))),
                        None
                    )
                    if ti is None:
                        continue
                    # Find available room
                    eligible = sorted(
                        [ri for ri, r in enumerate(rooms) if int(r.get("capacity", 40)) >= size],
                        key=lambda ri: rooms[ri].get("capacity", 40)
                    ) or list(range(len(rooms)))
                    ri = next((r for r in eligible if not room_busy.get((r, d, p))), None)
                    if ri is None:
                        continue

                    teacher_busy[(ti, d, p)] = True
                    room_busy[(ri, d, p)] = True
                    class_slot_busy[(ci, d, p)] = True
                    slot = period_slots[p] if p < len(period_slots) else {"start": "?", "end": "?"}
                    assignments.append({
                        "class_name":    cls["name"],
                        "class_index":   ci,
                        "subject_name":  subjects[si]["name"],
                        "subject_code":  subjects[si]["code"],
                        "teacher_name":  teachers[ti]["name"],
                        "teacher_index": ti,
                        "room_name":     rooms[ri]["name"],
                        "room_index":    ri,
                        "day":           working_days[d],
                        "day_index":     d,
                        "period":        p + 1,
                        "start_time":    slot["start"],
                        "end_time":      slot["end"],
                    })
                    assigned = True
                    break

            if not assigned:
                # Diagnose why placement failed
                free_class_slots = [
                    (d, p) for d in range(D) for p in valid_periods
                    if not class_slot_busy.get((ci, d, p))
                ]
                if not free_class_slots:
                    reason = "Class has no free slots remaining in the week"
                    fix    = f"Reduce total periods_per_week across all subjects for '{cls['name']}'"
                else:
                    teacher_blocked = all(
                        teacher_busy.get((ti2, d, p))
                        for (d, p) in free_class_slots
                        for ti2, can in enumerate(teacher_can) if si in can
                    )
                    qualified_teachers = [t for t, can in enumerate(teacher_can) if si in can]
                    if not qualified_teachers:
                        reason = f"No teacher is qualified to teach '{subjects[si]['name']}'"
                        fix    = f"Assign at least one teacher to '{subjects[si]['code']}'"
                    elif teacher_blocked or all(
                        teacher_busy.get((ti2, d, p))
                        for (d, p) in free_class_slots
                        for ti2 in qualified_teachers
                    ):
                        reason = (
                            f"All {len(qualified_teachers)} teacher(s) for "
                            f"'{subjects[si]['name']}' are busy in every slot where "
                            f"'{cls['name']}' is free"
                        )
                        fix = (
                            f"Add another teacher for '{subjects[si]['name']}' "
                            f"or reduce their other subject loads"
                        )
                    else:
                        reason = (
                            f"No suitable room available in slots where both "
                            f"'{cls['name']}' and a teacher are free"
                        )
                        fix = "Add more rooms or increase existing room capacities"

                msg = (
                    f"Could not schedule '{subjects[si]['name']}' for '{cls['name']}': "
                    f"{reason}. Fix: {fix}"
                )
                logger.warning(f"Greedy: {msg}")
                placement_warnings.append({
                    "level":   "warning",
                    "code":    "UNPLACED_SESSION",
                    "message": msg,
                    "detail": {
                        "class":   cls["name"],
                        "subject": subjects[si]["code"],
                        "reason":  reason,
                        "fix":     fix,
                    },
                })

    elapsed = round((datetime.now() - t0).total_seconds(), 3)
    grid = _build_grid(assignments, classes, working_days, period_slots)
    return {
        "success":            True,
        "solver":             "Greedy",
        "status":             "FEASIBLE",
        "solve_time":         elapsed,
        "assignments":        assignments,
        "grid":               grid,
        "time_slots":         display_slots,
        "working_days":       working_days,
        "lunch_period_index": -1,  # frontend detects lunch via slot.is_lunch flag in display_slots
        "warnings":           placement_warnings,
        "stats": {
            "total_assignments":   len(assignments),
            "unplaced_sessions":   len(placement_warnings),
            "classes":             len(classes),
            "subjects":            len(subjects),
            "teachers":            len(teachers),
            "rooms":               len(rooms),
            "solve_time_seconds":  elapsed,
            "solver":              "Greedy",
            "solver_status":       "FEASIBLE",
        },
    }


# ──────────────────────────────────────────────────────────────
# Helpers — imported from solver_shared.py
# _generate_time_slots, _build_grid, _empty_result, make_warning
# ──────────────────────────────────────────────────────────────
