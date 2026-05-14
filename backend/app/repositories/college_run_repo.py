"""Persistence for college runs — save inputs + assignments inside one transaction."""
import re
from datetime import time
from typing import Optional
from uuid import UUID, uuid4


_TIMETABLE_SUFFIX_RE = re.compile(r"(?:\s+timetable)+$", re.IGNORECASE)


def _build_run_name(institution_name: str) -> str:
    """Build a run name like 'Acme College timetable', stripping any trailing
    ' timetable' suffix(es) first to prevent iterative Duplicate / Regenerate
    from piling up the suffix.
    """
    cleaned = _TIMETABLE_SUFFIX_RE.sub("", institution_name or "").strip() or "Untitled"
    return f"{cleaned} timetable"

from sqlalchemy.orm import Session

from app.models.shared.run import Run, RunKind, RunStatus
from app.models.shared.soft_constraint import RunSoftConstraint
from app.models.college.time_config       import CollegeTimeConfig
from app.models.college.hard_constraints  import CollegeHardConstraints
from app.models.college.department        import CollegeDepartment
from app.models.college.course            import CollegeCourse
from app.models.college.faculty           import CollegeFaculty
from app.models.college.section           import CollegeSection
from app.models.college.room              import CollegeRoom
from app.models.college.faculty_course    import CollegeFacultyCourse
from app.models.college.assignment        import CollegeAssignment, CollegeSlotKind
from app.schemas.college import CollegeGenerateRequest


def _parse_time(s: str) -> time:
    h, m = s.split(":")
    return time(int(h), int(m))


def _solver_status_to_enum(s: str) -> RunStatus:
    s = s.upper()
    if s == "OPTIMAL":   return RunStatus.OPTIMAL
    if s == "FEASIBLE":  return RunStatus.FEASIBLE
    return RunStatus.FAILED


def _extract_solve_time(result: dict) -> Optional[float]:
    """Solvers report solve time under 'solve_time' (top-level) or 'stats.solve_time_seconds'."""
    for key in ("solve_time_seconds", "solve_time"):
        v = result.get(key)
        if v is not None:
            return float(v)
    stats = result.get("stats") or {}
    v = stats.get("solve_time_seconds") or stats.get("solve_time")
    return float(v) if v is not None else None


def save_run(
    db: Session,
    *,
    user_id: UUID,
    request: CollegeGenerateRequest,
    result: dict,
    parent_run_id: Optional[UUID],
) -> UUID:
    """Persist a college run + all inputs + assignments. Caller owns the transaction."""
    run_id = uuid4()
    db.add(Run(
        id=run_id, user_id=user_id, kind=RunKind.COLLEGE,
        parent_run_id=parent_run_id,
        name=request.name or _build_run_name(request.institution_name),
        status=_solver_status_to_enum(result.get("status", "FAILED")),
        solver=result.get("solver", "CP-SAT"),
        solve_time_seconds=_extract_solve_time(result),
    ))
    db.flush()

    db.add(CollegeTimeConfig(
        run_id=run_id,
        working_days=request.working_days,
        periods_per_day=request.periods_per_day,
        period_duration_minutes=request.period_duration_minutes,
        start_time=_parse_time(request.start_time),
        semester=request.semester,
    ))
    db.add(CollegeHardConstraints(
        run_id=run_id,
        max_consecutive_periods=request.constraints.max_consecutive_periods,
        max_periods_per_day_per_faculty=request.constraints.max_periods_per_day_per_faculty,
        lunch_period_index=request.constraints.lunch_period_index,
    ))

    # departments (code -> id)
    dept_id_by_code: dict[str, UUID] = {}
    for d in request.departments:
        did = uuid4()
        dept_id_by_code[d.code] = did
        db.add(CollegeDepartment(id=did, run_id=run_id, code=d.code, name=d.name))

    db.flush()  # departments must exist before courses reference them via FK

    # courses (code -> id) — auto-create department if missing
    course_id_by_code: dict[str, UUID] = {}
    for c in request.course_offerings:
        cid = uuid4()
        course_id_by_code[c.code] = cid
        dept_id = dept_id_by_code.get(c.department)
        if dept_id is None and c.department:
            dept_id = uuid4()
            dept_id_by_code[c.department] = dept_id
            db.add(CollegeDepartment(id=dept_id, run_id=run_id,
                                     code=c.department, name=c.department))
            db.flush()  # flush auto-created dept before its courses
        db.add(CollegeCourse(
            id=cid, run_id=run_id, department_id=dept_id,
            code=c.code, name=c.name, year=c.year, credits=c.credits,
            lectures_per_week=c.lectures_per_week, has_lab=c.has_lab,
            required_lecture_room_type=c.required_lecture_room_type,
            required_lab_room_type=c.required_lab_room_type,
            enrolled_students=c.enrolled_students, is_elective=c.is_elective,
        ))

    db.flush()  # courses must exist before faculty_courses + sections reference them

    # faculty (code -> id, also name -> id since solver emits teacher_name)
    faculty_id_by_code: dict[str, UUID] = {}
    faculty_id_by_name: dict[str, UUID] = {}
    for f in request.faculty:
        fid = uuid4()
        faculty_id_by_code[f.code] = fid
        faculty_id_by_name[f.name] = fid
        db.add(CollegeFaculty(
            id=fid, run_id=run_id,
            department_id=dept_id_by_code.get(f.department) if f.department else None,
            code=f.code, name=f.name,
            max_hours_per_week=f.max_hours_per_week,
        ))
        for course_code in f.courses_can_teach:
            course_id = course_id_by_code.get(course_code)
            if course_id:
                db.add(CollegeFacultyCourse(faculty_id=fid, course_id=course_id))

    # rooms (name -> id)
    room_id_by_name: dict[str, UUID] = {}
    for r in request.rooms:
        rid = uuid4()
        room_id_by_name[r.name] = rid
        db.add(CollegeRoom(
            id=rid, run_id=run_id, name=r.name,
            capacity=r.capacity, room_type=r.room_type,
        ))

    # soft constraints
    for sc in request.soft_constraints:
        db.add(RunSoftConstraint(
            run_id=run_id, type=sc.type, target=sc.target,
            when_value=sc.when, weight=sc.weight,
        ))

    # ── sections — derive from the solver's actual section list ──
    # The solver derives multiple sections per course based on enrolment vs.
    # room capacity (e.g. course CS101 with 120 students might split into
    # sections "A", "B", "C"). Each assignment carries `section_label`.
    # We collect unique (course_code, section_label) pairs from assignments
    # and create one CollegeSection per pair.
    section_id_by_course_section: dict[tuple[str, str], UUID] = {}
    for a in result.get("assignments", []):
        course_code   = a.get("course_code") or a.get("subject_code")
        section_label = a.get("section_label") or "A"
        if course_code is None:
            continue
        key = (course_code, section_label)
        if key in section_id_by_course_section:
            continue
        course_id = course_id_by_code.get(course_code)
        if course_id is None:
            continue
        sid = uuid4()
        section_id_by_course_section[key] = sid
        db.add(CollegeSection(
            id=sid, run_id=run_id, course_id=course_id, name=section_label,
        ))

    db.flush()

    # ── assignments ──
    # Solver output keys (see app/core/college_solver.py around line 820):
    #   subject_code = course code, teacher_name = faculty's display name,
    #   room_name, day / day_index, period, course_type ('lecture' | 'lab'),
    #   section_label = which section of the course this assignment belongs to.
    for a in result.get("assignments", []):
        course_code   = a.get("course_code") or a.get("subject_code")
        section_label = a.get("section_label") or "A"
        course_id     = course_id_by_code.get(course_code)
        # Faculty: try faculty_code/teacher_code first, then teacher_name (what solver actually emits)
        faculty_id    = (
            faculty_id_by_code.get(a.get("faculty_code"))
            or faculty_id_by_code.get(a.get("teacher_code"))
            or faculty_id_by_name.get(a.get("teacher_name"))
        )
        section_id    = section_id_by_course_section.get((course_code, section_label))
        room_id       = room_id_by_name.get(a.get("room_name"))
        if not all([course_id, faculty_id, section_id, room_id]):
            continue
        # Slot kind: solver uses 'course_type' ('lecture'|'lab'); fall back to 'slot_kind'.
        slot_kind_str = (a.get("course_type") or a.get("slot_kind") or "lecture").lower()
        kind = CollegeSlotKind.LAB if slot_kind_str == "lab" else CollegeSlotKind.LECTURE
        day_int = a.get("day_index", a.get("day_of_week"))
        if day_int is None:
            continue
        db.add(CollegeAssignment(
            id=uuid4(), run_id=run_id,
            day_of_week=day_int, period=a["period"],
            course_id=course_id, faculty_id=faculty_id,
            section_id=section_id, room_id=room_id,
            slot_kind=kind,
        ))

    return run_id


def load_run(db: Session, *, run_id: UUID) -> dict:
    """Return wizard-shape payload for a college run, or raise ValueError."""
    run = db.get(Run, run_id)
    if run is None or run.kind != RunKind.COLLEGE:
        raise ValueError(f"College run {run_id} not found")

    tc = db.query(CollegeTimeConfig).filter_by(run_id=run_id).one()
    hc = db.query(CollegeHardConstraints).filter_by(run_id=run_id).one()
    depts   = db.query(CollegeDepartment).filter_by(run_id=run_id).all()
    courses = db.query(CollegeCourse).filter_by(run_id=run_id).all()
    faculty = db.query(CollegeFaculty).filter_by(run_id=run_id).all()
    rooms   = db.query(CollegeRoom).filter_by(run_id=run_id).all()
    softs   = db.query(RunSoftConstraint).filter_by(run_id=run_id).all()

    dept_code_by_id   = {d.id: d.code for d in depts}
    course_code_by_id = {c.id: c.code for c in courses}

    # faculty -> course codes
    fc_pairs = (
        db.query(CollegeFacultyCourse)
        .join(CollegeFaculty, CollegeFaculty.id == CollegeFacultyCourse.faculty_id)
        .filter(CollegeFaculty.run_id == run_id)
        .all()
    )
    courses_by_faculty: dict[UUID, list[str]] = {}
    for pair in fc_pairs:
        courses_by_faculty.setdefault(pair.faculty_id, []).append(course_code_by_id[pair.course_id])

    return {
        "institution_name": run.name,
        "name": run.name,
        "parent_run_id": str(run.parent_run_id) if run.parent_run_id else None,
        "semester": tc.semester,
        "departments": [{"code": d.code, "name": d.name} for d in depts],
        "course_offerings": [
            {
                "code": c.code, "name": c.name,
                "department": dept_code_by_id.get(c.department_id, ""),
                "year": c.year, "credits": c.credits,
                "lectures_per_week": c.lectures_per_week,
                "has_lab": c.has_lab,
                "required_lecture_room_type": c.required_lecture_room_type,
                "required_lab_room_type": c.required_lab_room_type,
                "enrolled_students": c.enrolled_students,
                "is_elective": c.is_elective,
                "faculty_codes": [],
            }
            for c in courses
        ],
        "faculty": [
            {
                "code": f.code, "name": f.name,
                "department": dept_code_by_id.get(f.department_id, "") if f.department_id else "",
                "courses_can_teach": courses_by_faculty.get(f.id, []),
                "max_hours_per_week": f.max_hours_per_week,
            }
            for f in faculty
        ],
        "rooms": [
            {"name": r.name, "capacity": r.capacity, "room_type": r.room_type}
            for r in rooms
        ],
        "working_days": list(tc.working_days),
        "periods_per_day": tc.periods_per_day,
        "period_duration_minutes": tc.period_duration_minutes,
        "start_time": tc.start_time.strftime("%H:%M"),
        "constraints": {
            "lunch_period_index": hc.lunch_period_index,
            "max_consecutive_periods": hc.max_consecutive_periods,
            "max_periods_per_day_per_faculty": hc.max_periods_per_day_per_faculty,
        },
        "soft_constraints": [
            {"type": s.type, "target": s.target, "when": s.when_value, "weight": s.weight}
            for s in softs
        ],
    }


def load_run_result(db: Session, *, run_id: UUID) -> dict:
    """Reconstruct the solver-result shape from a saved college run.

    Returns the same dict shape that POST /college/generate emits, so the
    frontend can render a saved run with the existing /timetable view
    (no wizard, no re-solve).
    """
    from app.core.solver_shared import generate_time_slots, build_grid

    run = db.get(Run, run_id)
    if run is None or run.kind != RunKind.COLLEGE:
        raise ValueError(f"College run {run_id} not found")

    tc = db.query(CollegeTimeConfig).filter_by(run_id=run_id).one()
    hc = db.query(CollegeHardConstraints).filter_by(run_id=run_id).one()

    courses  = db.query(CollegeCourse).filter_by(run_id=run_id).all()
    faculty  = db.query(CollegeFaculty).filter_by(run_id=run_id).all()
    sections = db.query(CollegeSection).filter_by(run_id=run_id).all()
    rooms    = db.query(CollegeRoom).filter_by(run_id=run_id).all()
    depts    = db.query(CollegeDepartment).filter_by(run_id=run_id).all()
    saved_assignments = db.query(CollegeAssignment).filter_by(run_id=run_id).all()

    course_by_id  = {c.id: c for c in courses}
    faculty_by_id = {f.id: f for f in faculty}
    section_by_id = {s.id: s for s in sections}
    room_by_id    = {r.id: r for r in rooms}
    dept_code_by_id = {d.id: d.code for d in depts}

    # College has no separate lunch_duration_minutes column. Lunch is encoded
    # via lunch_period_index — if >= 0, lunch falls after that period, but the
    # grid is built without a synthetic slot (matches college solver behaviour).
    period_slots = generate_time_slots(
        start_time=tc.start_time.strftime("%H:%M"),
        periods_per_day=tc.periods_per_day,
        period_duration_minutes=tc.period_duration_minutes,
    )
    period_by_num = {ps["period"]: ps for ps in period_slots}

    # How many sections does each course have? Drives class_name format.
    sections_per_course: dict[UUID, int] = {}
    for s in sections:
        sections_per_course[s.course_id] = sections_per_course.get(s.course_id, 0) + 1

    flat_assignments: list[dict] = []
    for a in saved_assignments:
        course  = course_by_id.get(a.course_id)
        fac     = faculty_by_id.get(a.faculty_id)
        section = section_by_id.get(a.section_id)
        room    = room_by_id.get(a.room_id)
        slot    = period_by_num.get(a.period, {})
        if not all([course, fac, section, room]):
            continue
        is_single = sections_per_course.get(course.id, 1) == 1
        class_name = course.code if is_single else f"{course.code} Sec {section.name}"
        is_lab = a.slot_kind.value == "lab"
        flat_assignments.append({
            # School-compatible keys (used by the grid view)
            "class_name":    class_name,
            "subject_name":  course.name,
            "subject_code":  course.code,
            "teacher_name":  fac.name,
            "room_name":     room.name,
            "day":           tc.working_days[a.day_of_week] if 0 <= a.day_of_week < len(tc.working_days) else str(a.day_of_week),
            "day_index":     a.day_of_week,
            "period":        a.period,
            "start_time":    slot.get("start", ""),
            "end_time":      slot.get("end", ""),
            # College-specific keys
            "department":         dept_code_by_id.get(course.department_id, ""),
            "year":               course.year,
            "section_label":      section.name,
            "course_type":        "lab" if is_lab else "lecture",
            "credits":            course.credits,
            "is_elective":        course.is_elective,
        })

    # Class list for grid: one entry per section (matches solver output shape).
    section_class_list = []
    for s in sections:
        course = course_by_id.get(s.course_id)
        if course is None:
            continue
        is_single = sections_per_course.get(course.id, 1) == 1
        section_class_list.append({
            "name": course.code if is_single else f"{course.code} Sec {s.name}"
        })

    grid = build_grid(
        flat_assignments,
        section_class_list,
        list(tc.working_days),
        period_slots,
    )

    return {
        "run_id":             str(run.id),
        "success":            True,
        "solver":             run.solver,
        "status":             run.status.value.upper(),
        "solve_time":         float(run.solve_time_seconds) if run.solve_time_seconds is not None else 0.0,
        "solve_time_seconds": float(run.solve_time_seconds) if run.solve_time_seconds is not None else 0.0,
        "assignments":        flat_assignments,
        "grid":               grid,
        "time_slots":         period_slots,
        "working_days":       list(tc.working_days),
        "lunch_period_index": hc.lunch_period_index,
        "warnings":           [],
        "stats": {
            "total_assignments":  len(flat_assignments),
            "unplaced_sessions":  0,
            "classes":            len(section_class_list),
            "subjects":           len(courses),
            "teachers":           len(faculty),
            "rooms":              len(rooms),
            "solve_time_seconds": float(run.solve_time_seconds) if run.solve_time_seconds is not None else 0.0,
            "solver":             run.solver,
            "solver_status":      run.status.value.upper(),
        },
    }


def list_runs(db: Session, *, user_id: UUID, limit: int = 20) -> list[dict]:
    """Return summary rows for college runs owned by user, newest first."""
    from sqlalchemy import func

    runs = (
        db.query(Run)
        .filter(Run.user_id == user_id, Run.kind == RunKind.COLLEGE)
        .order_by(Run.created_at.desc())
        .limit(limit)
        .all()
    )
    if not runs:
        return []
    run_ids = [r.id for r in runs]

    def _count_by_run(model) -> dict:
        rows = (
            db.query(model.run_id, func.count(model.id))
            .filter(model.run_id.in_(run_ids))
            .group_by(model.run_id)
            .all()
        )
        return {rid: cnt for rid, cnt in rows}

    n_courses     = _count_by_run(CollegeCourse)
    n_faculty     = _count_by_run(CollegeFaculty)
    n_sections    = _count_by_run(CollegeSection)
    n_rooms       = _count_by_run(CollegeRoom)
    n_assignments = _count_by_run(CollegeAssignment)

    # Total enrollments = SUM(college_courses.enrolled_students) per run.
    # Note: this counts each student once per course they're enrolled in
    # (a student in 5 courses contributes 5). It matches "total course-seats."
    enrolment_rows = (
        db.query(CollegeCourse.run_id, func.coalesce(func.sum(CollegeCourse.enrolled_students), 0))
        .filter(CollegeCourse.run_id.in_(run_ids))
        .group_by(CollegeCourse.run_id)
        .all()
    )
    n_students = {rid: int(s) for rid, s in enrolment_rows}

    return [
        {
            "id": str(r.id), "name": r.name,
            "status": r.status.value, "solver": r.solver,
            "solve_time_seconds": float(r.solve_time_seconds) if r.solve_time_seconds is not None else None,
            "parent_run_id": str(r.parent_run_id) if r.parent_run_id else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "courses_count":     n_courses.get(r.id, 0),
            "faculty_count":     n_faculty.get(r.id, 0),
            "sections_count":    n_sections.get(r.id, 0),
            "rooms_count":       n_rooms.get(r.id, 0),
            "assignments_count": n_assignments.get(r.id, 0),
            "students_count":    n_students.get(r.id, 0),
        }
        for r in runs
    ]


def delete_run(db: Session, *, run_id: UUID, user_id: UUID) -> None:
    run = db.get(Run, run_id)
    if run is None or run.user_id != user_id or run.kind != RunKind.COLLEGE:
        raise ValueError(f"College run {run_id} not found for this user")
    db.delete(run)
