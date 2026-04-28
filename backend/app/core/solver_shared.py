"""
Shared helpers used by both simple_solver.py (school) and college_solver.py (college).

Extracted in Phase 1 of the college flow implementation.
Both solvers import from here — do not duplicate these functions.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple


def make_warning(level: str, code: str, message: str, **detail) -> Dict[str, Any]:
    """
    Canonical warning shape used by all solvers.
    level: "error" | "warning" | "info"
    """
    return {"level": level, "code": code, "message": message, "detail": detail}


def generate_time_slots(
    start_time: str,
    periods_per_day: int,
    period_duration_minutes: int,
) -> List[Dict[str, Any]]:
    """
    Build a list of time slot dicts for a school day.
    Returns: [{ period, start, end, label }, ...]  (period is 1-based)
    """
    slots = []
    h, m = map(int, start_time.split(":"))
    current = datetime(2000, 1, 1, h, m)
    for i in range(periods_per_day):
        end = current + timedelta(minutes=period_duration_minutes)
        slots.append({
            "period": i + 1,
            "start":  current.strftime("%H:%M"),
            "end":    end.strftime("%H:%M"),
            "label":  f"Period {i + 1}",
        })
        current = end
    return slots


def build_grid(
    assignments: List[Dict[str, Any]],
    classes: List[Dict[str, Any]],
    working_days: List[str],
    time_slots: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Build a nested grid: class_name → day → period_str → assignment dict.
    Used by both school and college result assembly.
    """
    grid = {cls["name"]: {day: {} for day in working_days} for cls in classes}
    for a in assignments:
        cn, day, p = a["class_name"], a["day"], str(a["period"])
        if cn in grid and day in grid[cn]:
            grid[cn][day][p] = a
    return grid


def empty_result(
    problem: Dict[str, Any],
    time_slots: List[Dict[str, Any]],
    working_days: List[str],
    solver_name: str,
) -> Dict[str, Any]:
    """
    Return a zero-assignment result envelope with the standard shape.
    Used on fast-fail and as a safe default on unexpected errors.
    """
    return {
        "success":      True,
        "solver":       solver_name,
        "status":       "FEASIBLE",
        "solve_time":   0,
        "assignments":  [],
        "grid":         {},
        "time_slots":   time_slots,
        "working_days": working_days,
        "warnings":     [],
        "stats": {
            "total_assignments":  0,
            "unplaced_sessions":  0,
            "classes":            0,
            "subjects":           0,
            "teachers":           0,
            "rooms":              0,
            "solve_time_seconds": 0,
            "solver":             solver_name,
            "solver_status":      "FEASIBLE",
        },
    }


def apply_soft_constraints_school(
    model: Any,
    soft_constraints: List[Dict[str, Any]],
    sessions: List[tuple],
    day_var: List,
    vp_var: List,
    t_var: List,
    is_scheduled: List,
    teachers: List[Dict[str, Any]],
    subjects: List[Dict[str, Any]],
    working_days: List[str],
    valid_periods: List[int],
) -> List[Tuple[Any, int]]:
    """
    Build CP-SAT penalty/reward vars for school soft constraints.
    Returns list of (BoolVar, weight) tuples.
    Caller adds to objective as: penalty_terms += [var * w for var, w in result]
    Negative weight = reward (subtracts from penalty sum).
    """
    teacher_idx = {t["name"]: i for i, t in enumerate(teachers)}
    subject_idx = {s["code"]: i for i, s in enumerate(subjects)}
    day_idx     = {d: i for i, d in enumerate(working_days)}
    penalties: List[Tuple[Any, int]] = []

    for sc in soft_constraints:
        rule_type = sc.get("type", "")
        target    = sc.get("target", "")
        when      = sc.get("when")
        weight    = int(sc.get("weight", 1))

        if rule_type == "avoid_day":
            ti = teacher_idx.get(target)
            di = day_idx.get(when)
            if ti is None or di is None:
                continue
            for s, (ci, si) in enumerate(sessions):
                pen     = model.NewBoolVar(f"sc_avday_{ti}_{di}_{s}")
                t_match = model.NewBoolVar(f"sc_avday_tm_{ti}_{di}_{s}")
                d_match = model.NewBoolVar(f"sc_avday_dm_{ti}_{di}_{s}")
                model.Add(t_var[s] == ti).OnlyEnforceIf(t_match)
                model.Add(t_var[s] != ti).OnlyEnforceIf(t_match.Not())
                model.Add(day_var[s] == di).OnlyEnforceIf(d_match)
                model.Add(day_var[s] != di).OnlyEnforceIf(d_match.Not())
                model.AddBoolAnd([t_match, d_match, is_scheduled[s]]).OnlyEnforceIf(pen)
                model.AddBoolOr([t_match.Not(), d_match.Not(), is_scheduled[s].Not()]).OnlyEnforceIf(pen.Not())
                penalties.append((pen, weight))

        elif rule_type == "avoid_slot":
            ti = teacher_idx.get(target)
            try:
                period_0 = int(when) - 1
            except (TypeError, ValueError):
                continue
            if ti is None or period_0 not in valid_periods:
                continue
            vp_target = valid_periods.index(period_0)
            for s, (ci, si) in enumerate(sessions):
                pen     = model.NewBoolVar(f"sc_avslot_{ti}_{period_0}_{s}")
                t_match = model.NewBoolVar(f"sc_avslot_tm_{ti}_{period_0}_{s}")
                p_match = model.NewBoolVar(f"sc_avslot_pm_{ti}_{period_0}_{s}")
                model.Add(t_var[s] == ti).OnlyEnforceIf(t_match)
                model.Add(t_var[s] != ti).OnlyEnforceIf(t_match.Not())
                model.Add(vp_var[s] == vp_target).OnlyEnforceIf(p_match)
                model.Add(vp_var[s] != vp_target).OnlyEnforceIf(p_match.Not())
                model.AddBoolAnd([t_match, p_match, is_scheduled[s]]).OnlyEnforceIf(pen)
                model.AddBoolOr([t_match.Not(), p_match.Not(), is_scheduled[s].Not()]).OnlyEnforceIf(pen.Not())
                penalties.append((pen, weight))

        elif rule_type == "prefer_slot":
            ti = teacher_idx.get(target)
            try:
                period_0 = int(when) - 1
            except (TypeError, ValueError):
                continue
            if ti is None or period_0 not in valid_periods:
                continue
            vp_target = valid_periods.index(period_0)
            for s, (ci, si) in enumerate(sessions):
                rew     = model.NewBoolVar(f"sc_pref_{ti}_{period_0}_{s}")
                t_match = model.NewBoolVar(f"sc_pref_tm_{ti}_{period_0}_{s}")
                p_match = model.NewBoolVar(f"sc_pref_pm_{ti}_{period_0}_{s}")
                model.Add(t_var[s] == ti).OnlyEnforceIf(t_match)
                model.Add(t_var[s] != ti).OnlyEnforceIf(t_match.Not())
                model.Add(vp_var[s] == vp_target).OnlyEnforceIf(p_match)
                model.Add(vp_var[s] != vp_target).OnlyEnforceIf(p_match.Not())
                model.AddBoolAnd([t_match, p_match, is_scheduled[s]]).OnlyEnforceIf(rew)
                model.AddBoolOr([t_match.Not(), p_match.Not(), is_scheduled[s].Not()]).OnlyEnforceIf(rew.Not())
                penalties.append((rew, -weight))  # negative = reward

        elif rule_type == "spread_subject":
            si_target = subject_idx.get(target)
            if si_target is None:
                continue
            grp = [s for s, (ci, si) in enumerate(sessions) if si == si_target]
            for i in range(len(grp)):
                for j in range(i + 1, len(grp)):
                    same_day = model.NewBoolVar(f"sc_spread_{si_target}_{i}_{j}")
                    model.Add(day_var[grp[i]] == day_var[grp[j]]).OnlyEnforceIf(same_day)
                    model.Add(day_var[grp[i]] != day_var[grp[j]]).OnlyEnforceIf(same_day.Not())
                    penalties.append((same_day, weight))

        elif rule_type == "group_on_day":
            si_target = subject_idx.get(target)
            if si_target is None:
                continue
            grp = [s for s, (ci, si) in enumerate(sessions) if si == si_target]
            for i in range(len(grp)):
                for j in range(i + 1, len(grp)):
                    diff_day = model.NewBoolVar(f"sc_group_{si_target}_{i}_{j}")
                    model.Add(day_var[grp[i]] != day_var[grp[j]]).OnlyEnforceIf(diff_day)
                    model.Add(day_var[grp[i]] == day_var[grp[j]]).OnlyEnforceIf(diff_day.Not())
                    penalties.append((diff_day, weight))

    return penalties


def apply_soft_constraints_college(
    model: Any,
    soft_constraints: List[Dict[str, Any]],
    all_sessions: List[Dict[str, Any]],
    day_var: List,
    vp_var: List,
    faculty_var: List,
    is_scheduled: List,
    faculty_list: List[Dict[str, Any]],
    working_days: List[str],
    valid_periods: List[int],
) -> List[Tuple[Any, int]]:
    """
    Build CP-SAT penalty/reward vars for college soft constraints.
    Returns list of (BoolVar, weight) tuples.
    """
    faculty_idx = {f["code"]: i for i, f in enumerate(faculty_list)}
    day_idx     = {d: i for i, d in enumerate(working_days)}
    penalties: List[Tuple[Any, int]] = []

    for sc in soft_constraints:
        rule_type = sc.get("type", "")
        target    = sc.get("target", "")
        when      = sc.get("when")
        weight    = int(sc.get("weight", 1))

        if rule_type == "avoid_day":
            fi = faculty_idx.get(target)
            di = day_idx.get(when)
            if fi is None or di is None:
                continue
            for s, sess in enumerate(all_sessions):
                pen     = model.NewBoolVar(f"cc_avday_{fi}_{di}_{s}")
                f_match = model.NewBoolVar(f"cc_avday_fm_{fi}_{di}_{s}")
                d_match = model.NewBoolVar(f"cc_avday_dm_{fi}_{di}_{s}")
                model.Add(faculty_var[s] == fi).OnlyEnforceIf(f_match)
                model.Add(faculty_var[s] != fi).OnlyEnforceIf(f_match.Not())
                model.Add(day_var[s] == di).OnlyEnforceIf(d_match)
                model.Add(day_var[s] != di).OnlyEnforceIf(d_match.Not())
                model.AddBoolAnd([f_match, d_match, is_scheduled[s]]).OnlyEnforceIf(pen)
                model.AddBoolOr([f_match.Not(), d_match.Not(), is_scheduled[s].Not()]).OnlyEnforceIf(pen.Not())
                penalties.append((pen, weight))

        elif rule_type == "avoid_slot":
            fi = faculty_idx.get(target)
            try:
                period_0 = int(when) - 1
            except (TypeError, ValueError):
                continue
            if fi is None or period_0 not in valid_periods:
                continue
            vp_target = valid_periods.index(period_0)
            for s, sess in enumerate(all_sessions):
                pen     = model.NewBoolVar(f"cc_avslot_{fi}_{period_0}_{s}")
                f_match = model.NewBoolVar(f"cc_avslot_fm_{fi}_{period_0}_{s}")
                p_match = model.NewBoolVar(f"cc_avslot_pm_{fi}_{period_0}_{s}")
                model.Add(faculty_var[s] == fi).OnlyEnforceIf(f_match)
                model.Add(faculty_var[s] != fi).OnlyEnforceIf(f_match.Not())
                model.Add(vp_var[s] == vp_target).OnlyEnforceIf(p_match)
                model.Add(vp_var[s] != vp_target).OnlyEnforceIf(p_match.Not())
                model.AddBoolAnd([f_match, p_match, is_scheduled[s]]).OnlyEnforceIf(pen)
                model.AddBoolOr([f_match.Not(), p_match.Not(), is_scheduled[s].Not()]).OnlyEnforceIf(pen.Not())
                penalties.append((pen, weight))

        elif rule_type == "prefer_slot":
            fi = faculty_idx.get(target)
            try:
                period_0 = int(when) - 1
            except (TypeError, ValueError):
                continue
            if fi is None or period_0 not in valid_periods:
                continue
            vp_target = valid_periods.index(period_0)
            for s, sess in enumerate(all_sessions):
                rew     = model.NewBoolVar(f"cc_pref_{fi}_{period_0}_{s}")
                f_match = model.NewBoolVar(f"cc_pref_fm_{fi}_{period_0}_{s}")
                p_match = model.NewBoolVar(f"cc_pref_pm_{fi}_{period_0}_{s}")
                model.Add(faculty_var[s] == fi).OnlyEnforceIf(f_match)
                model.Add(faculty_var[s] != fi).OnlyEnforceIf(f_match.Not())
                model.Add(vp_var[s] == vp_target).OnlyEnforceIf(p_match)
                model.Add(vp_var[s] != vp_target).OnlyEnforceIf(p_match.Not())
                model.AddBoolAnd([f_match, p_match, is_scheduled[s]]).OnlyEnforceIf(rew)
                model.AddBoolOr([f_match.Not(), p_match.Not(), is_scheduled[s].Not()]).OnlyEnforceIf(rew.Not())
                penalties.append((rew, -weight))

        elif rule_type == "spread_subject":
            code = target
            grp  = [s for s, sess in enumerate(all_sessions)
                    if sess["course_code"] == code and sess["session_type"] == "lecture"]
            for i in range(len(grp)):
                for j in range(i + 1, len(grp)):
                    same_day = model.NewBoolVar(f"cc_spread_{code}_{i}_{j}")
                    model.Add(day_var[grp[i]] == day_var[grp[j]]).OnlyEnforceIf(same_day)
                    model.Add(day_var[grp[i]] != day_var[grp[j]]).OnlyEnforceIf(same_day.Not())
                    penalties.append((same_day, weight))

        elif rule_type == "group_on_day":
            code = target
            grp  = [s for s, sess in enumerate(all_sessions)
                    if sess["course_code"] == code and sess["session_type"] == "lecture"]
            for i in range(len(grp)):
                for j in range(i + 1, len(grp)):
                    diff_day = model.NewBoolVar(f"cc_group_{code}_{i}_{j}")
                    model.Add(day_var[grp[i]] != day_var[grp[j]]).OnlyEnforceIf(diff_day)
                    model.Add(day_var[grp[i]] == day_var[grp[j]]).OnlyEnforceIf(diff_day.Not())
                    penalties.append((diff_day, weight))

    return penalties
