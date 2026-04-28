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
from typing import Dict, List, Any, Tuple
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
        time_slots = _generate_time_slots(
            problem.get("start_time", "08:00"),
            int(problem.get("periods_per_day", 7)),
            int(problem.get("period_duration_minutes", 45))
        )
        fast_fail_result = _empty_result(problem, time_slots, problem.get("working_days", []), "Precheck")
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

    # Flag if CP-SAT had to leave unplaced sessions
    if result.get("stats", {}).get("unplaced_sessions", 0) > 0:
        unplaced = result["stats"]["unplaced_sessions"]
        warnings.append({
            "level": "warning",
            "code": "UNPLACED_SESSIONS",
            "message": f"Solver could not fit {unplaced} session(s) due to constraints.",
            "detail": {"unplaced_count": unplaced}
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

    usable_ppd   = ppd - (1 if lunch_after > 0 else 0)
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
    #    A teacher can cover at most slots_pw sessions per week.
    #    If one subject needs N_classes × ppw sessions but teacher capacity < that, warn.
    for subj in subjects:
        ppw = int(subj.get("periods_per_week", 3))
        tc = subj.get("target_classes", [])
        affected_classes = [c for c in classes if not tc or c["name"] in tc]
        sessions_for_subj = ppw * len(affected_classes)
        qualified_teachers = [
            t for t in teachers
            if subj["code"] in t.get("subjects", [])
        ]
        teacher_capacity = len(qualified_teachers) * slots_pw
        if qualified_teachers and sessions_for_subj > teacher_capacity:
            issues.append({
                "level":   "error",
                "code":    "TEACHER_CAPACITY_EXCEEDED",
                "message": f"'{subj['name']}' needs {sessions_for_subj} sessions/week "
                           f"but qualified teacher(s) can only cover {teacher_capacity} slots. "
                           f"Add more teachers for this subject or reduce periods_per_week.",
                "detail":  {
                    "subject":            subj["code"],
                    "sessions_needed":    sessions_for_subj,
                    "teacher_capacity":   teacher_capacity,
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
    usable_ppd  = ppd - (1 if lunch_after > 0 else 0)
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

def _cp_solve(problem: Dict[str, Any]) -> Dict[str, Any]:
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
    max_consec   = int(constraints.get("max_consecutive_periods", 3))
    max_per_day_teacher = int(constraints.get("max_periods_per_day_per_teacher", 6))

    D = len(working_days)
    P = ppd

    # Valid period indices (skip lunch slot)
    valid_periods = [p for p in range(P) if lunch_after == 0 or p != lunch_after - 1]
    n_valid = len(valid_periods)

    time_slots = _generate_time_slots(
        problem.get("start_time", "08:00"), P,
        int(problem.get("period_duration_minutes", 45))
    )

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
        return _empty_result(problem, time_slots, working_days, "CP-SAT")

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

    for (ci, si), grp in cs_groups.items():
        if len(grp) > 1:
            # Hard Constraint: Ensure the same teacher teaches all sessions of a specific class-subject combination
            for i in range(1, len(grp)):
                model.Add(t_var[grp[0]] == t_var[grp[i]])

            # Hard Constraint: Forbid consecutive periods of the same subject on the same day for a class
            for i in range(len(grp)):
                for j in range(i + 1, len(grp)):
                    same_day = model.NewBoolVar(f"hs_sd_{ci}_{si}_{i}_{j}")
                    model.Add(day_var[grp[i]] == day_var[grp[j]]).OnlyEnforceIf(same_day)
                    model.Add(day_var[grp[i]] != day_var[grp[j]]).OnlyEnforceIf(same_day.Not())

                    vp_diff = model.NewIntVar(-n_valid, n_valid, f"hs_vpdiff_{ci}_{si}_{i}_{j}")
                    model.Add(vp_diff == vp_var[grp[i]] - vp_var[grp[j]])

                    is_consec_1 = model.NewBoolVar(f"hs_c1_{ci}_{si}_{i}_{j}")
                    model.Add(vp_diff == 1).OnlyEnforceIf(is_consec_1)
                    model.Add(vp_diff != 1).OnlyEnforceIf(is_consec_1.Not())

                    is_consec_m1 = model.NewBoolVar(f"hs_cm1_{ci}_{si}_{i}_{j}")
                    model.Add(vp_diff == -1).OnlyEnforceIf(is_consec_m1)
                    model.Add(vp_diff != -1).OnlyEnforceIf(is_consec_m1.Not())

                    is_consec = model.NewBoolVar(f"hs_consec_{ci}_{si}_{i}_{j}")
                    model.AddBoolOr([is_consec_1, is_consec_m1]).OnlyEnforceIf(is_consec)
                    model.AddBoolAnd([is_consec_1.Not(), is_consec_m1.Not()]).OnlyEnforceIf(is_consec.Not())

                    # They cannot be on the same day, consecutive, and both scheduled
                    forbidden = model.NewBoolVar(f"hs_forbid_{ci}_{si}_{i}_{j}")
                    model.AddBoolAnd([same_day, is_consec, is_scheduled[grp[i]], is_scheduled[grp[j]]]).OnlyEnforceIf(forbidden)
                    model.AddBoolOr([same_day.Not(), is_consec.Not(), is_scheduled[grp[i]].Not(), is_scheduled[grp[j]].Not()]).OnlyEnforceIf(forbidden.Not())
                    model.Add(forbidden == 0)

    # ── Soft constraints as objective ──────────────────────
    # 4. Spread each subject across different days per class (soft)
    #    Penalty: count pairs of sessions of same (class, subject) on the same day
    #    We want to minimize this.
    penalty_terms = []

    for (ci, si), grp in cs_groups.items():
        if len(grp) < 2:
            continue
        for i in range(len(grp)):
            for j in range(i + 1, len(grp)):
                same_day = model.NewBoolVar(f"sd_{ci}_{si}_{i}_{j}")
                model.Add(day_var[grp[i]] == day_var[grp[j]]).OnlyEnforceIf(same_day)
                model.Add(day_var[grp[i]] != day_var[grp[j]]).OnlyEnforceIf(same_day.Not())
                penalty_terms.append(same_day)

    # 5. Soft: max periods per day per teacher (hard cap if asked)
    # Convert to hard constraint for max_per_day_teacher
    for ti in range(len(teachers)):
        for d in range(D):
            # Count sessions for teacher ti on day d
            indicators = []
            for s in range(S):
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
            indicators = []
            for s in range(S):
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
    reward_scheduled = sum(is_scheduled[s] * 10000 for s in range(S))
    if penalty_terms:
        model.Maximize(reward_scheduled - sum(penalty_terms))
    else:
        model.Maximize(reward_scheduled)

    # ── Solve ──────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.num_search_workers = 4   # parallel search
    solver.parameters.log_search_progress = False

    status = solver.Solve(model)
    elapsed = round((datetime.now() - t0).total_seconds(), 3)
    logger.info(f"CP-SAT done: {solver.StatusName(status)} in {elapsed}s")

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        assignments = []
        unplaced_count = 0
        for s, (ci, si) in enumerate(sessions):
            if not solver.Value(is_scheduled[s]):
                unplaced_count += 1
                continue
                
            d  = solver.Value(day_var[s])
            vp = solver.Value(vp_var[s])
            p  = valid_periods[vp]   # actual 0-based period index
            ti = solver.Value(t_var[s])
            ri = solver.Value(r_var[s])
            slot = time_slots[p] if p < len(time_slots) else {"start": "?", "end": "?"}
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

        grid = _build_grid(assignments, classes, working_days, time_slots)
        return {
            "success":      True,
            "solver":       "CP-SAT",
            "status":       solver.StatusName(status),
            "solve_time":   elapsed,
            "assignments":  assignments,
            "grid":         grid,
            "time_slots":   time_slots,
            "working_days": working_days,
            "warnings":     [],
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
        logger.warning(f"CP-SAT failed completely: {solver.StatusName(status)}")
        return _empty_result(problem, time_slots, working_days, "CP-SAT")


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

    time_slots = _generate_time_slots(
        problem.get("start_time", "08:00"), ppd,
        int(problem.get("period_duration_minutes", 45))
    )

    valid_periods = [p for p in range(ppd) if lunch_after == 0 or p != lunch_after - 1]
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
                    slot = time_slots[p] if p < len(time_slots) else {"start": "?", "end": "?"}
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
    grid = _build_grid(assignments, classes, working_days, time_slots)
    return {
        "success":      True,
        "solver":       "Greedy",
        "status":       "FEASIBLE",
        "solve_time":   elapsed,
        "assignments":  assignments,
        "grid":         grid,
        "time_slots":   time_slots,
        "working_days": working_days,
        "warnings":     placement_warnings,
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
