"""
College Timetable Solver — Google OR-Tools CP-SAT.

CP-SAT only. No greedy fallback.
- Pre-solve: _derive_sections, _diagnose_college_problem.
- Fast-fail on any error-level warning.
- On timeout: return partial (FEASIBLE) with SOLVER_TIMEOUT warning.
- On 0 assignments after timeout: fast-fail with warnings.

Key concepts:
  - Section: subdivision of a course derived from enrolled students ÷ room capacity.
  - Session unit: (section_id, occurrence_index).
  - Lecture sessions: lectures_per_week sessions per section.
  - Lab sessions: 2 per section (start + follower) when credits == 4.
"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Tuple

from app.core.solver_shared import (
    empty_result,
    generate_time_slots,
    make_warning,
    apply_soft_constraints_college as _apply_soft_college,
)

logger = logging.getLogger(__name__)

LAB_BLOCK_SIZE = 2   # always 2 consecutive periods for a lab block

# ──────────────────────────────────────────────────────────────
# Public entry point
# ──────────────────────────────────────────────────────────────

def solve_college_timetable(problem: Dict[str, Any]) -> Dict[str, Any]:
    """
    CP-SAT college solver.
    Returns a result envelope that is a superset of the school envelope.
    """
    working_days = problem.get("working_days", [])
    ppd          = int(problem.get("periods_per_day", 7))
    pdm          = int(problem.get("period_duration_minutes", 45))
    start_time   = problem.get("start_time", "08:00")

    time_slots = generate_time_slots(start_time, ppd, pdm)

    # 1. Derive sections (pre-CP-SAT)
    sections, derive_warnings = _derive_sections(
        problem.get("course_offerings", []),
        problem.get("rooms", []),
    )

    # 2. Diagnose
    diag_warnings = _diagnose_college_problem(problem, sections)
    all_warnings  = derive_warnings + diag_warnings

    if any(w["level"] == "error" for w in all_warnings):
        logger.warning("Fast-fail: pre-check errors found.")
        result = empty_result(problem, time_slots, working_days, "CP-SAT-College")
        result["warnings"]        = all_warnings
        result["sections_derived"] = []
        return result

    # 3. Solve
    try:
        result = _cp_solve(problem, sections, time_slots)
    except ImportError:
        logger.error("OR-Tools not installed — college solver requires CP-SAT.")
        result = empty_result(problem, time_slots, working_days, "CP-SAT-College")
        result["warnings"] = all_warnings + [
            make_warning("error", "ORTOOLS_NOT_INSTALLED",
                         "OR-Tools is not installed. College solver requires CP-SAT.")
        ]
        result["sections_derived"] = []
        return result
    except Exception as exc:
        logger.error(f"CP-SAT college solver failed: {exc}", exc_info=True)
        result = empty_result(problem, time_slots, working_days, "CP-SAT-College")
        result["warnings"] = all_warnings
        result["sections_derived"] = []
        return result

    # 4. Merge warnings
    result["warnings"] = all_warnings + result.get("warnings", [])
    return result


# ──────────────────────────────────────────────────────────────
# Section derivation
# ──────────────────────────────────────────────────────────────

def _derive_sections(
    course_offerings: List[Dict[str, Any]],
    rooms: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    For each course offering derive sections from enrolled students + room capacities.

    Returns:
        sections: list of {course_code, label, student_count}
        warnings: UNEQUAL_SECTIONS or NO_LECTURE_ROOM_CAPACITY warnings
    """
    sections: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []

    for course in course_offerings:
        code       = course["code"]
        enrolled   = int(course.get("enrolled_students", 1))
        room_type  = course.get("required_lecture_room_type", "classroom")

        # Filter rooms by required type then sort: capacity DESC, name ASC
        eligible = [
            r for r in rooms if r.get("room_type") == room_type
        ]
        eligible.sort(key=lambda r: (-int(r.get("capacity", 0)), r.get("name", "")))

        if not eligible:
            # No room of this type at all — diagnostic handles error; yield 1 dummy section
            sections.append({
                "course_code":   code,
                "label":         "A",
                "student_count": enrolled,
            })
            continue

        # Greedy bin-pack: pick from top until cumulative capacity >= enrolled
        picked = []
        cumulative = 0
        for r in eligible:
            picked.append(r)
            cumulative += int(r.get("capacity", 0))
            if cumulative >= enrolled:
                break

        # If even all eligible rooms can't cover enrolled count use all of them
        if cumulative < enrolled:
            warnings.append(make_warning(
                "error", "NO_LECTURE_ROOM_CAPACITY",
                f"Course '{code}': enrolled {enrolled} students but all "
                f"{room_type} rooms combined hold only {cumulative}. "
                "Add more or larger rooms.",
                course_code=code,
                enrolled=enrolled,
                total_capacity=cumulative,
            ))
            # Still continue with all eligible rooms — solver will do best-effort

        section_count = len(picked)
        base      = enrolled // section_count
        remainder = enrolled % section_count

        capacities = [int(r.get("capacity", 0)) for r in picked]

        for idx in range(section_count):
            label = chr(ord("A") + idx)
            count = base + (1 if idx < remainder else 0)
            sections.append({
                "course_code":   code,
                "label":         label,
                "student_count": count,
            })

    return sections, warnings


# ──────────────────────────────────────────────────────────────
# Diagnostics
# ──────────────────────────────────────────────────────────────

def _diagnose_college_problem(
    problem: Dict[str, Any],
    sections: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Run all pre-solve diagnostics. Returns list of warnings (error + warning level).
    """
    issues: List[Dict[str, Any]] = []

    courses    = problem.get("course_offerings", [])
    faculty    = problem.get("faculty", [])
    rooms      = problem.get("rooms", [])
    working_days = problem.get("working_days", [])
    ppd        = int(problem.get("periods_per_day", 7))
    constraints = problem.get("constraints", {}) or {}
    lunch_idx  = int(constraints.get("lunch_period_index", -1))
    departments = {d["code"] for d in problem.get("departments", [])}

    course_map = {c["code"]: c for c in courses}

    # Index: course_code → list of qualified faculty
    qualified_for: Dict[str, List[str]] = {c["code"]: [] for c in courses}
    for fac in faculty:
        for code in fac.get("courses_can_teach", []):
            if code in qualified_for:
                qualified_for[code].append(fac["code"])

    # C1 — No qualified faculty for a course
    for course in courses:
        if not qualified_for.get(course["code"]):
            issues.append(make_warning(
                "error", "NO_QUALIFIED_FACULTY",
                f"Course '{course['code']}' ({course['name']}) has no qualified faculty. "
                "Assign at least one faculty member who can teach this course.",
                course_code=course["code"],
            ))

    # C2 — No lecture room of required type with enough capacity for smallest section
    sections_by_course: Dict[str, List[Dict]] = {}
    for sec in sections:
        sections_by_course.setdefault(sec["course_code"], []).append(sec)

    for course in courses:
        code      = course["code"]
        room_type = course.get("required_lecture_room_type", "classroom")
        course_sections = sections_by_course.get(code, [])
        min_students = min((s["student_count"] for s in course_sections), default=1)

        eligible = [
            r for r in rooms
            if r.get("room_type") == room_type
            and int(r.get("capacity", 0)) >= min_students
        ]
        if not eligible:
            max_cap = max(
                (int(r.get("capacity", 0)) for r in rooms if r.get("room_type") == room_type),
                default=0,
            )
            issues.append(make_warning(
                "error", "NO_LECTURE_ROOM_FOR_COURSE",
                f"Course '{code}' needs a '{room_type}' for sections of "
                f"{min_students}+ students but none is large enough "
                f"(largest {room_type} holds {max_cap}).",
                course_code=code,
                required_type=room_type,
                min_section_size=min_students,
                max_available_capacity=max_cap,
            ))

    # C3 — No lab room for 4-credit courses (existence + capacity)
    for course in courses:
        if not course.get("has_lab"):
            continue
        lab_type = course.get("required_lab_room_type")
        if not lab_type:
            continue
        code = course["code"]
        eligible = [r for r in rooms if r.get("room_type") == lab_type]
        if not eligible:
            issues.append(make_warning(
                "error", "NO_LAB_ROOM_FOR_COURSE",
                f"Course '{code}' requires a '{lab_type}' for its lab "
                "but no such room exists. Add a lab room.",
                course_code=code,
                required_lab_type=lab_type,
            ))
        else:
            # Smallest section for this course must fit in at least one lab room
            course_sections = sections_by_course.get(code, [])
            min_students = min((s["student_count"] for s in course_sections), default=1)
            capable = [r for r in eligible if int(r.get("capacity", 0)) >= min_students]
            if not capable:
                max_cap = max(int(r.get("capacity", 0)) for r in eligible)
                issues.append(make_warning(
                    "error", "NO_LAB_ROOM_CAPACITY",
                    f"Course '{code}' lab sections have {min_students} students but the "
                    f"largest '{lab_type}' holds only {max_cap}. "
                    "Add a larger lab room or reduce enrolled students.",
                    course_code=code,
                    required_lab_type=lab_type,
                    min_section_size=min_students,
                    max_lab_capacity=max_cap,
                ))

    # C4 — Lab block fits in day
    if LAB_BLOCK_SIZE > ppd - 1:
        issues.append(make_warning(
            "error", "LAB_BLOCK_TOO_LONG",
            f"Lab block size ({LAB_BLOCK_SIZE}) requires at least "
            f"{LAB_BLOCK_SIZE + 1} periods per day but only {ppd} configured.",
            lab_block_size=LAB_BLOCK_SIZE,
            periods_per_day=ppd,
        ))

    # C5 — Lunch period index in range
    if lunch_idx != -1 and not (0 <= lunch_idx < ppd):
        issues.append(make_warning(
            "error", "LUNCH_PERIOD_OUT_OF_RANGE",
            f"lunch_period_index={lunch_idx} is out of range [0, {ppd - 1}].",
            lunch_period_index=lunch_idx,
            periods_per_day=ppd,
        ))

    # C6 — Schedule oversubscribed (rough check: total sessions > total room-slots)
    usable_ppd = ppd - (1 if 0 <= lunch_idx < ppd else 0)
    total_slots = len(working_days) * usable_ppd * len(rooms)

    total_sessions = 0
    for course in courses:
        code     = course["code"]
        n_sec    = len(sections_by_course.get(code, [{"course_code": code, "label": "A", "student_count": 1}]))
        lectures = int(course.get("lectures_per_week", 3))
        lab_sessions = LAB_BLOCK_SIZE if course.get("has_lab") else 0
        total_sessions += n_sec * (lectures + lab_sessions)

    if total_sessions > total_slots:
        issues.append(make_warning(
            "error", "SCHEDULE_OVERSUBSCRIBED",
            f"Total sessions needed ({total_sessions}) exceeds available "
            f"room-slots ({total_slots}: "
            f"{len(working_days)} days × {usable_ppd} usable periods × {len(rooms)} rooms).",
            sessions_needed=total_sessions,
            slots_available=total_slots,
        ))

    # C7 — Minimum forced faculty load infeasibility
    # For each faculty: forced load = sessions of courses where they are the ONLY qualifier.
    for fac in faculty:
        fac_code = fac["code"]
        max_hours = int(fac.get("max_hours_per_week", 18))
        forced = 0
        for code, qualifiers in qualified_for.items():
            if qualifiers == [fac_code]:    # sole qualifier
                course = course_map.get(code)
                if not course:
                    continue
                n_sec = len(sections_by_course.get(code, [{}]))
                lectures = int(course.get("lectures_per_week", 3))
                lab_hrs  = LAB_BLOCK_SIZE if course.get("has_lab") else 0
                forced  += n_sec * (lectures + lab_hrs)
        if forced > max_hours:
            issues.append(make_warning(
                "error", "MINIMUM_LOAD_INFEASIBLE",
                f"Faculty '{fac['name']}' is the sole qualifier for courses that "
                f"require at least {forced} sessions/week but their cap is {max_hours}.",
                faculty_code=fac_code,
                forced_load=forced,
                max_hours=max_hours,
            ))

    # C8 — Department reference check (warning level)
    for course in courses:
        if course.get("department") and course["department"] not in departments:
            issues.append(make_warning(
                "warning", "DEPT_COURSE_MISMATCH",
                f"Course '{course['code']}' references department "
                f"'{course['department']}' which is not in the departments list.",
                course_code=course["code"],
                department=course["department"],
            ))

    for w in issues:
        logger.warning(f"[CollegeDiagnose] [{w['level'].upper()}] {w['message']}")

    return issues


# ──────────────────────────────────────────────────────────────
# CP-SAT Solver
# ──────────────────────────────────────────────────────────────

def _cp_solve(
    problem: Dict[str, Any],
    sections: List[Dict[str, Any]],
    time_slots: List[Dict[str, Any]],
) -> Dict[str, Any]:
    from ortools.sat.python import cp_model  # type: ignore

    t0 = datetime.now()

    courses      = problem.get("course_offerings", [])
    faculty_list = problem.get("faculty", [])
    rooms        = problem.get("rooms", [])
    working_days = problem.get("working_days", [])
    ppd          = int(problem.get("periods_per_day", 7))
    constraints  = problem.get("constraints", {}) or {}
    lunch_idx    = int(constraints.get("lunch_period_index", -1))
    max_consec   = int(constraints.get("max_consecutive_periods", 3))
    max_per_day_faculty = int(constraints.get("max_periods_per_day_per_faculty", 6))

    D = len(working_days)
    P = ppd

    # Valid periods (exclude lunch)
    valid_periods = [p for p in range(P) if p != lunch_idx]
    n_valid = len(valid_periods)

    # Period index → valid_period index map (for last-period lab exclusion)
    period_to_vp = {p: i for i, p in enumerate(valid_periods)}

    # ── Index maps ──────────────────────────────────────────
    course_map   = {c["code"]: c for c in courses}
    faculty_map  = {f["code"]: i for i, f in enumerate(faculty_list)}
    room_indices = list(range(len(rooms)))

    # Faculty: code → set of course codes they can teach
    faculty_courses: List[set] = []
    for fac in faculty_list:
        faculty_courses.append(set(fac.get("courses_can_teach", [])))

    # Sections grouped by course code
    sections_by_course: Dict[str, List[Dict]] = {}
    for sec in sections:
        sections_by_course.setdefault(sec["course_code"], []).append(sec)

    # ── Build session list ───────────────────────────────────
    # Each entry: {section_id, course_code, session_type, occurrence}
    # section_id is an index into `sections`
    all_sessions: List[Dict[str, Any]] = []
    sec_global_index: Dict[Tuple[str, str], int] = {}  # (course_code, label) → section index in `sections`

    for i, sec in enumerate(sections):
        sec_global_index[(sec["course_code"], sec["label"])] = i

    for course in courses:
        code     = course["code"]
        lectures = int(course.get("lectures_per_week", 3))
        has_lab  = bool(course.get("has_lab"))
        course_sections = sections_by_course.get(code, [])

        for sec in course_sections:
            sec_idx = sec_global_index[(code, sec["label"])]
            # Lecture sessions
            for occ in range(lectures):
                all_sessions.append({
                    "sec_idx":     sec_idx,
                    "sec":         sec,
                    "course_code": code,
                    "session_type": "lecture",
                    "occurrence":  occ,
                })
            # Lab sessions (start + follower)
            if has_lab:
                all_sessions.append({
                    "sec_idx":     sec_idx,
                    "sec":         sec,
                    "course_code": code,
                    "session_type": "lab_start",
                    "occurrence":  0,
                })
                all_sessions.append({
                    "sec_idx":     sec_idx,
                    "sec":         sec,
                    "course_code": code,
                    "session_type": "lab_follower",
                    "occurrence":  1,
                })

    S = len(all_sessions)
    if S == 0:
        return empty_result(problem, time_slots, working_days, "CP-SAT-College")

    # Time budget by total section count
    n_sections = len(sections)
    n_courses  = len(courses)
    if n_courses <= 5 and n_sections <= 3:
        time_budget = 10.0
    elif n_courses <= 20 and n_sections <= 30:
        time_budget = 90.0
    else:
        time_budget = 300.0

    logger.info(
        f"CP-SAT college: {S} sessions, {n_sections} sections, "
        f"{D} days, {P} periods ({n_valid} usable), "
        f"{len(faculty_list)} faculty, {len(rooms)} rooms, "
        f"budget={time_budget}s"
    )

    model = cp_model.CpModel()

    # ── Decision variables ───────────────────────────────────
    is_scheduled = [model.NewBoolVar(f"sched_{s}") for s in range(S)]
    day_var      = [model.NewIntVar(0, D - 1, f"d_{s}") for s in range(S)]
    # vp_var indexes into valid_periods list
    vp_var       = [model.NewIntVar(0, n_valid - 1, f"vp_{s}") for s in range(S)]

    # Faculty and room variables with domain restriction
    faculty_var: List[Any] = []
    room_var:    List[Any] = []

    for s, sess in enumerate(all_sessions):
        code     = sess["course_code"]
        course   = course_map[code]
        sec      = sess["sec"]
        is_lab   = sess["session_type"] in ("lab_start", "lab_follower")

        # Faculty domain: qualified faculty indices
        valid_faculty = [
            fi for fi, fac_codes in enumerate(faculty_courses)
            if code in fac_codes
        ]
        if not valid_faculty:
            valid_faculty = list(range(len(faculty_list))) or [0]

        faculty_var.append(model.NewIntVarFromDomain(
            cp_model.Domain.FromValues(valid_faculty), f"f_{s}"
        ))

        # Room domain: type-filtered, then capacity-filtered
        required_type = (
            course.get("required_lab_room_type")
            if is_lab
            else course.get("required_lecture_room_type", "classroom")
        )
        student_count = sec["student_count"]
        valid_rooms = [
            ri for ri, r in enumerate(rooms)
            if r.get("room_type") == required_type
            and int(r.get("capacity", 0)) >= student_count
        ]
        if not valid_rooms:
            # Fallback: type match only (capacity constraint will apply via AddElement below)
            valid_rooms = [
                ri for ri, r in enumerate(rooms)
                if r.get("room_type") == required_type
            ]
        if not valid_rooms:
            valid_rooms = room_indices or [0]

        room_var.append(model.NewIntVarFromDomain(
            cp_model.Domain.FromValues(valid_rooms), f"r_{s}"
        ))

    # ── C9: Capacity (AddElement approach) ──────────────────
    room_capacities = [int(r.get("capacity", 0)) for r in rooms]
    for s, sess in enumerate(all_sessions):
        student_count = sess["sec"]["student_count"]
        cap_var = model.NewIntVar(0, max(room_capacities) if room_capacities else 1, f"cap_{s}")
        model.AddElement(room_var[s], room_capacities, cap_var)
        model.Add(cap_var >= student_count)

    # ── C1: No section double-booking ───────────────────────
    # (section_id, day, vp) must be unique for scheduled sessions
    sec_timeslot: Dict[int, List] = {}
    for s, sess in enumerate(all_sessions):
        combo = model.NewIntVar(0, D * n_valid + S, f"sec_ts_{s}")
        model.Add(combo == day_var[s] * n_valid + vp_var[s]).OnlyEnforceIf(is_scheduled[s])
        model.Add(combo == D * n_valid + s).OnlyEnforceIf(is_scheduled[s].Not())
        sec_timeslot.setdefault(sess["sec_idx"], []).append(combo)

    for sec_idx, combos in sec_timeslot.items():
        if len(combos) > 1:
            model.AddAllDifferent(combos)

    # ── C2: No faculty double-booking ───────────────────────
    fac_combo_max = len(faculty_list) * D * n_valid + S
    fac_timeslot  = []
    for s in range(S):
        fc = model.NewIntVar(0, fac_combo_max, f"fac_ts_{s}")
        model.Add(fc == faculty_var[s] * D * n_valid + day_var[s] * n_valid + vp_var[s]).OnlyEnforceIf(is_scheduled[s])
        model.Add(fc == len(faculty_list) * D * n_valid + s).OnlyEnforceIf(is_scheduled[s].Not())
        fac_timeslot.append(fc)
    model.AddAllDifferent(fac_timeslot)

    # ── C3: No room double-booking ───────────────────────────
    room_combo_max = len(rooms) * D * n_valid + S
    room_timeslot  = []
    for s in range(S):
        rc = model.NewIntVar(0, room_combo_max, f"room_ts_{s}")
        model.Add(rc == room_var[s] * D * n_valid + day_var[s] * n_valid + vp_var[s]).OnlyEnforceIf(is_scheduled[s])
        model.Add(rc == len(rooms) * D * n_valid + s).OnlyEnforceIf(is_scheduled[s].Not())
        room_timeslot.append(rc)
    model.AddAllDifferent(room_timeslot)

    # ── C5: Section binding (same faculty + room for all lectures of a section) ─
    # Group lecture sessions by (sec_idx, course_code)
    lecture_groups: Dict[Tuple[int, str], List[int]] = {}
    for s, sess in enumerate(all_sessions):
        if sess["session_type"] == "lecture":
            key = (sess["sec_idx"], sess["course_code"])
            lecture_groups.setdefault(key, []).append(s)

    for (sec_idx, code), grp in lecture_groups.items():
        for i in range(1, len(grp)):
            model.Add(faculty_var[grp[0]] == faculty_var[grp[i]])
            model.Add(room_var[grp[0]]    == room_var[grp[i]])

    # ── C6: No consecutive lecture repetition for same section ─
    for (sec_idx, code), grp in lecture_groups.items():
        for i in range(len(grp)):
            for j in range(i + 1, len(grp)):
                si, sj = grp[i], grp[j]
                same_day = model.NewBoolVar(f"lec_sd_{si}_{sj}")
                model.Add(day_var[si] == day_var[sj]).OnlyEnforceIf(same_day)
                model.Add(day_var[si] != day_var[sj]).OnlyEnforceIf(same_day.Not())

                vp_diff = model.NewIntVar(-n_valid, n_valid, f"lec_vpd_{si}_{sj}")
                model.Add(vp_diff == vp_var[si] - vp_var[sj])

                is_c1  = model.NewBoolVar(f"lec_c1_{si}_{sj}")
                is_cm1 = model.NewBoolVar(f"lec_cm1_{si}_{sj}")
                model.Add(vp_diff == 1).OnlyEnforceIf(is_c1)
                model.Add(vp_diff != 1).OnlyEnforceIf(is_c1.Not())
                model.Add(vp_diff == -1).OnlyEnforceIf(is_cm1)
                model.Add(vp_diff != -1).OnlyEnforceIf(is_cm1.Not())

                is_consec = model.NewBoolVar(f"lec_consec_{si}_{sj}")
                model.AddBoolOr([is_c1, is_cm1]).OnlyEnforceIf(is_consec)
                model.AddBoolAnd([is_c1.Not(), is_cm1.Not()]).OnlyEnforceIf(is_consec.Not())

                forbidden = model.NewBoolVar(f"lec_forbid_{si}_{sj}")
                model.AddBoolAnd([same_day, is_consec, is_scheduled[si], is_scheduled[sj]]).OnlyEnforceIf(forbidden)
                model.AddBoolOr([same_day.Not(), is_consec.Not(), is_scheduled[si].Not(), is_scheduled[sj].Not()]).OnlyEnforceIf(forbidden.Not())
                model.Add(forbidden == 0)

    # ── C7: Lab continuity (follower must be start+1 on same day) ──
    # Also lab shares faculty+room with the section's lecture sessions.
    # Map: (sec_idx, course_code) → lab_start index, lab_follower index
    lab_starts:    Dict[Tuple[int, str], int] = {}
    lab_followers: Dict[Tuple[int, str], int] = {}
    for s, sess in enumerate(all_sessions):
        key = (sess["sec_idx"], sess["course_code"])
        if sess["session_type"] == "lab_start":
            lab_starts[key] = s
        elif sess["session_type"] == "lab_follower":
            lab_followers[key] = s

    # Build list of vp indices that cannot be a lab_start.
    # A valid lab start at vp requires valid_periods[vp+1] == valid_periods[vp] + 1
    # (the follower period is immediately consecutive in actual period space).
    # This catches: last period of day (no vp+1 exists), and last period before lunch
    # (vp+1 exists in valid_periods but is not the immediate next actual period number).
    lab_start_excluded_vp: List[int] = []
    for vp_i in range(n_valid):
        if vp_i + 1 >= n_valid:
            # No follower index — cannot be a lab start
            lab_start_excluded_vp.append(vp_i)
        elif valid_periods[vp_i + 1] != valid_periods[vp_i] + 1:
            # Gap between this vp and the next (lunch break) — exclude
            lab_start_excluded_vp.append(vp_i)

    for key in lab_starts:
        s_start    = lab_starts[key]
        s_follower = lab_followers.get(key)
        if s_follower is None:
            continue

        # Day equality
        model.Add(day_var[s_follower] == day_var[s_start])

        # Follower period = start period + 1 (in actual period space)
        # Since follower is also lunch-excluded, express as:
        # valid_periods[vp_follower] == valid_periods[vp_start] + 1
        # We achieve this by constraining vp_follower = vp_start + 1
        # (valid_periods are contiguous for non-lunch blocks)
        model.Add(vp_var[s_follower] == vp_var[s_start] + 1)

        # Exclude last vp from lab start (no room for follower)
        for excl_vp in lab_start_excluded_vp:
            model.Add(vp_var[s_start] != excl_vp)

        # Faculty and room binding: lab shares with lecture session 0 of same section
        lec_grp = lecture_groups.get(key, [])
        if lec_grp:
            model.Add(faculty_var[s_start]    == faculty_var[lec_grp[0]])
            model.Add(room_var[s_start]        != room_var[lec_grp[0]])  # lab is different room type
            model.Add(faculty_var[s_follower]  == faculty_var[s_start])
            model.Add(room_var[s_follower]     == room_var[s_start])
        else:
            model.Add(faculty_var[s_follower] == faculty_var[s_start])
            model.Add(room_var[s_follower]    == room_var[s_start])

    # ── C10: Faculty weekly workload cap ─────────────────────
    for fi, fac in enumerate(faculty_list):
        max_hours = int(fac.get("max_hours_per_week", 18))
        assigned_and_scheduled = []
        for s, sess in enumerate(all_sessions):
            if sess["course_code"] not in faculty_courses[fi]:
                continue
            is_assigned = model.NewBoolVar(f"teaches_{fi}_{s}")
            model.Add(faculty_var[s] == fi).OnlyEnforceIf(is_assigned)
            model.Add(faculty_var[s] != fi).OnlyEnforceIf(is_assigned.Not())
            aws = model.NewBoolVar(f"aws_{fi}_{s}")
            model.AddBoolAnd([is_assigned, is_scheduled[s]]).OnlyEnforceIf(aws)
            model.AddBoolOr([is_assigned.Not(), is_scheduled[s].Not()]).OnlyEnforceIf(aws.Not())
            assigned_and_scheduled.append(aws)
        if assigned_and_scheduled:
            model.Add(sum(assigned_and_scheduled) <= max_hours)

    # ── Max periods per day per faculty (hard) ───────────────
    for fi in range(len(faculty_list)):
        for d in range(D):
            indicators = []
            for s, sess in enumerate(all_sessions):
                if sess["course_code"] not in faculty_courses[fi]:
                    continue
                is_fac_day = model.NewBoolVar(f"fd_{fi}_{d}_{s}")
                f_match    = model.NewBoolVar(f"fm_{fi}_{d}_{s}")
                d_match    = model.NewBoolVar(f"dm_{fi}_{d}_{s}")
                model.Add(faculty_var[s] == fi).OnlyEnforceIf(f_match)
                model.Add(faculty_var[s] != fi).OnlyEnforceIf(f_match.Not())
                model.Add(day_var[s] == d).OnlyEnforceIf(d_match)
                model.Add(day_var[s] != d).OnlyEnforceIf(d_match.Not())
                model.AddBoolAnd([f_match, d_match, is_scheduled[s]]).OnlyEnforceIf(is_fac_day)
                model.AddBoolOr([f_match.Not(), d_match.Not(), is_scheduled[s].Not()]).OnlyEnforceIf(is_fac_day.Not())
                indicators.append(is_fac_day)
            if indicators:
                model.Add(sum(indicators) <= max_per_day_faculty)

    # ── Soft constraints + objective ─────────────────────────
    penalty_terms = []

    # Spread: penalise pairs of lectures of same (section, course) on same day
    for (sec_idx, code), grp in lecture_groups.items():
        for i in range(len(grp)):
            for j in range(i + 1, len(grp)):
                si, sj = grp[i], grp[j]
                same_day = model.NewBoolVar(f"sp_sd_{si}_{sj}")
                model.Add(day_var[si] == day_var[sj]).OnlyEnforceIf(same_day)
                model.Add(day_var[si] != day_var[sj]).OnlyEnforceIf(same_day.Not())
                penalty_terms.append(same_day)

    # Consecutive penalty: for each section, penalise runs > max_consec
    # (lightweight approach: penalise any 3+ lectures same day)
    for (sec_idx, code), grp in lecture_groups.items():
        if len(grp) >= 3:
            for i in range(len(grp)):
                for j in range(i + 1, len(grp)):
                    for k in range(j + 1, len(grp)):
                        si, sj, sk = grp[i], grp[j], grp[k]
                        all_same = model.NewBoolVar(f"cons_{si}_{sj}_{sk}")
                        a = model.NewBoolVar(f"cons_a_{si}_{sj}_{sk}")
                        b = model.NewBoolVar(f"cons_b_{si}_{sj}_{sk}")
                        model.Add(day_var[si] == day_var[sj]).OnlyEnforceIf(a)
                        model.Add(day_var[si] != day_var[sj]).OnlyEnforceIf(a.Not())
                        model.Add(day_var[sj] == day_var[sk]).OnlyEnforceIf(b)
                        model.Add(day_var[sj] != day_var[sk]).OnlyEnforceIf(b.Not())
                        model.AddBoolAnd([a, b]).OnlyEnforceIf(all_same)
                        model.AddBoolOr([a.Not(), b.Not()]).OnlyEnforceIf(all_same.Not())
                        penalty_terms.append(all_same)

    # ── User-defined soft constraints ────────────────────────
    soft_constraints = problem.get("soft_constraints", []) or []
    if soft_constraints:
        user_penalties = _apply_soft_college(
            model=model,
            soft_constraints=soft_constraints,
            all_sessions=all_sessions,
            day_var=day_var,
            vp_var=vp_var,
            faculty_var=faculty_var,
            is_scheduled=is_scheduled,
            faculty_list=faculty_list,
            working_days=working_days,
            valid_periods=valid_periods,
        )
        for var, w in user_penalties:
            penalty_terms.append(var * w)

    reward = sum(is_scheduled[s] * 100_000 for s in range(S))
    if penalty_terms:
        model.Maximize(reward - sum(penalty_terms))
    else:
        model.Maximize(reward)

    # ── Solve ─────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds   = time_budget
    solver.parameters.num_search_workers    = 4
    solver.parameters.log_search_progress   = False

    status = solver.Solve(model)
    elapsed = round((datetime.now() - t0).total_seconds(), 3)
    logger.info(f"CP-SAT college done: {solver.StatusName(status)} in {elapsed}s")

    solve_warnings: List[Dict[str, Any]] = []
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        logger.warning(f"CP-SAT college: no solution ({solver.StatusName(status)})")
        result = empty_result(problem, time_slots, working_days, "CP-SAT-College")
        result["sections_derived"] = _build_sections_derived(sections, [], problem)
        return result

    if status == cp_model.FEASIBLE:
        solve_warnings.append(make_warning(
            "warning", "SOLVER_TIMEOUT",
            f"CP-SAT timed out after {elapsed}s. Returning best partial solution found.",
            solve_time=elapsed,
        ))

    # ── Result assembly ───────────────────────────────────────
    # Courses with exactly one section omit the "Sec X" label from class_name
    single_section_courses: set = {
        code for code, secs in sections_by_course.items() if len(secs) == 1
    }

    assignments:    List[Dict[str, Any]] = []
    unplaced_count: int = 0

    # Track actual faculty+room per section for sections_derived
    sec_faculty: Dict[int, int] = {}
    sec_room:    Dict[int, int] = {}

    for s, sess in enumerate(all_sessions):
        if not solver.Value(is_scheduled[s]):
            unplaced_count += 1
            continue

        d    = solver.Value(day_var[s])
        vp   = solver.Value(vp_var[s])
        p    = valid_periods[vp]
        fi   = solver.Value(faculty_var[s])
        ri   = solver.Value(room_var[s])
        slot = time_slots[p] if p < len(time_slots) else {"start": "?", "end": "?"}

        sec      = sess["sec"]
        code     = sess["course_code"]
        course   = course_map[code]
        sec_idx  = sess["sec_idx"]
        is_lab   = sess["session_type"] in ("lab_start", "lab_follower")

        # Track section binding for sections_derived
        if sess["session_type"] == "lecture" and sec_idx not in sec_faculty:
            sec_faculty[sec_idx] = fi
            sec_room[sec_idx]    = ri

        assignments.append({
            # School-compatible keys
            "class_name":    code if code in single_section_courses else f"{code} Sec {sec['label']}",
            "class_index":   sec_idx,
            "subject_name":  course["name"],
            "subject_code":  code,
            "teacher_name":  faculty_list[fi]["name"],
            "teacher_index": fi,
            "room_name":     rooms[ri]["name"],
            "room_index":    ri,
            "day":           working_days[d],
            "day_index":     d,
            "period":        p + 1,
            "start_time":    slot["start"],
            "end_time":      slot["end"],
            # College-specific keys
            "department":         course.get("department", ""),
            "year":               int(course.get("year", 1)),
            "section_label":      sec["label"],
            "section_students":   sec["student_count"],
            "course_type":        "lab" if is_lab else "lecture",
            "credits":            int(course.get("credits", 3)),
            "is_lab_block_start": sess["session_type"] == "lab_start",
            "is_elective":        bool(course.get("is_elective", False)),
        })

    # Build fake class list for build_grid compatibility
    section_class_list = [
        {"name": sec["course_code"] if sec["course_code"] in single_section_courses else f"{sec['course_code']} Sec {sec['label']}"}
        for sec in sections
    ]
    grid = _build_college_grid(assignments, section_class_list, working_days, time_slots)

    sections_derived = _build_sections_derived(sections, assignments, problem)

    if unplaced_count > 0:
        solve_warnings.append(make_warning(
            "warning", "UNPLACED_SESSIONS",
            f"Solver could not place {unplaced_count} session(s).",
            unplaced_count=unplaced_count,
        ))

    return {
        "success":            True,
        "solver":             "CP-SAT-College",
        "status":             solver.StatusName(status),
        "solve_time":         elapsed,
        "assignments":        assignments,
        "grid":               grid,
        "time_slots":         time_slots,
        "working_days":       working_days,
        "lunch_period_index": lunch_idx,
        "warnings":           solve_warnings,
        "sections_derived":   sections_derived,
        "stats": {
            "total_assignments":  len(assignments),
            "unplaced_sessions":  unplaced_count,
            "classes":            len(sections),
            "subjects":           len(courses),
            "teachers":           len(faculty_list),
            "rooms":              len(rooms),
            "solve_time_seconds": elapsed,
            "solver":             "CP-SAT-College",
            "solver_status":      solver.StatusName(status),
        },
    }


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _build_college_grid(
    assignments: List[Dict[str, Any]],
    section_class_list: List[Dict[str, Any]],
    working_days: List[str],
    time_slots: List[Dict[str, Any]],
) -> Dict[str, Any]:
    grid: Dict[str, Any] = {
        cls["name"]: {day: {} for day in working_days}
        for cls in section_class_list
    }
    for a in assignments:
        cn  = a["class_name"]
        day = a["day"]
        p   = str(a["period"])
        if cn in grid and day in grid[cn]:
            grid[cn][day][p] = a
    return grid


def _build_sections_derived(
    sections: List[Dict[str, Any]],
    assignments: List[Dict[str, Any]],
    problem: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Build sections_derived from section list + actual CP-SAT assignments.
    """
    faculty_list = problem.get("faculty", [])
    rooms        = problem.get("rooms", [])

    # For each (course_code, label) find first lecture assignment to get faculty+room
    sec_info: Dict[Tuple[str, str], Dict] = {}
    for a in assignments:
        if a.get("course_type") != "lecture":
            continue
        key = (a["subject_code"], a["section_label"])
        if key not in sec_info:
            sec_info[key] = {
                "faculty_name":  a["teacher_name"],
                "room_name":     a["room_name"],
                "room_capacity": next(
                    (int(r.get("capacity", 0)) for r in rooms if r["name"] == a["room_name"]),
                    0,
                ),
            }

    result = []
    for sec in sections:
        key = (sec["course_code"], sec["label"])
        info = sec_info.get(key, {"faculty_name": "", "room_name": "", "room_capacity": 0})
        result.append({
            "course_code":   sec["course_code"],
            "section_label": sec["label"],
            "faculty_name":  info["faculty_name"],
            "room_name":     info["room_name"],
            "room_capacity": info["room_capacity"],
            "student_count": sec["student_count"],
        })
    return result
