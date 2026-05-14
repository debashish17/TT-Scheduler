"""Persistence for school runs — save inputs + assignments inside one transaction."""
import re
from datetime import time
from typing import Optional
from uuid import UUID, uuid4


_TIMETABLE_SUFFIX_RE = re.compile(r"(?:\s+timetable)+$", re.IGNORECASE)


def _build_run_name(institution_name: str) -> str:
    """Build a run name like 'Acme School timetable', stripping any trailing
    ' timetable' suffix(es) from the institution name first so iterative
    Duplicate / Regenerate flows don't pile up the suffix.
    """
    cleaned = _TIMETABLE_SUFFIX_RE.sub("", institution_name or "").strip() or "Untitled"
    return f"{cleaned} timetable"

from sqlalchemy.orm import Session

from app.models.shared.run import Run, RunKind, RunStatus
from app.models.shared.soft_constraint import RunSoftConstraint
from app.models.school.time_config       import SchoolTimeConfig
from app.models.school.hard_constraints  import SchoolHardConstraints
from app.models.school.subject           import SchoolSubject
from app.models.school.teacher           import SchoolTeacher
from app.models.school.class_            import SchoolClass
from app.models.school.room              import SchoolRoom
from app.models.school.teacher_subject   import SchoolTeacherSubject
from app.models.school.subject_class     import SchoolSubjectClass
from app.models.school.assignment        import SchoolAssignment
from app.schemas.school import SchoolGenerateRequest


def _parse_time(s: str) -> time:
    h, m = s.split(":")
    return time(int(h), int(m))


def _solver_status_to_enum(s: str) -> RunStatus:
    s = s.upper()
    if s == "OPTIMAL":
        return RunStatus.OPTIMAL
    if s == "FEASIBLE":
        return RunStatus.FEASIBLE
    return RunStatus.FAILED


def _extract_solve_time(result: dict) -> Optional[float]:
    """Solvers report solve time under either 'solve_time' (top-level) or 'stats.solve_time_seconds'."""
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
    request: SchoolGenerateRequest,
    result: dict,
    parent_run_id: Optional[UUID],
) -> UUID:
    """Persist a school run + all inputs + assignments. Caller owns the transaction."""
    run_id = uuid4()
    db.add(Run(
        id=run_id, user_id=user_id, kind=RunKind.SCHOOL,
        parent_run_id=parent_run_id,
        # _build_run_name strips any trailing " timetable" before re-appending
        # so iterative Duplicate / Regenerate doesn't pile up the suffix.
        name=request.name or _build_run_name(request.institution_name),
        status=_solver_status_to_enum(result.get("status", "FAILED")),
        solver=result.get("solver", "CP-SAT"),
        solve_time_seconds=_extract_solve_time(result),
    ))
    db.flush()

    db.add(SchoolTimeConfig(
        run_id=run_id,
        working_days=request.working_days,
        periods_per_day=request.periods_per_day,
        period_duration_minutes=request.period_duration_minutes,
        start_time=_parse_time(request.start_time),
        lunch_after_period=request.constraints.lunch_after_period,
        lunch_duration_minutes=request.lunch_duration_minutes,
    ))

    db.add(SchoolHardConstraints(
        run_id=run_id,
        max_consecutive_periods=request.constraints.max_consecutive_periods,
        max_periods_per_day_per_teacher=request.constraints.max_periods_per_day_per_teacher,
    ))

    # subjects (code -> id)
    subject_id_by_code: dict[str, UUID] = {}
    for s in request.subjects:
        sid = uuid4()
        subject_id_by_code[s.code] = sid
        db.add(SchoolSubject(id=sid, run_id=run_id, name=s.name,
                             code=s.code, periods_per_week=s.periods_per_week))

    # classes (name -> id)
    # The school solver MAY split over-capacity classes into sections at solve
    # time. For example: "Class 7" (size 120) with max room capacity 50 becomes
    # "Class 7A", "Class 7B", "Class 7C" — each ceil(120/3) = 40 students.
    # Only the SECTIONS get scheduled; the parent class is a transient input
    # concept the solver consumed.
    #
    # We persist exactly the classes the solver actually scheduled — i.e. the
    # distinct class_name values from result.assignments. This means:
    #  - When section-splitting happened, the DB stores 7A/B/C (not 7).
    #  - When no splitting happened, the DB stores the original class names.
    #  - On regenerate, the wizard hydrates with 8 distinct sections (matching
    #    what was scheduled), not with both the parent AND the sections.
    #
    # Section size is computed as ceil(parent_size / n_sections) — matching the
    # solver's preprocess (see app/core/simple_solver.py: _preprocess_problem).
    import math
    request_classes_by_name = {c.name: c for c in request.classes}

    # Distinct class_name values the solver actually emitted.
    seen_class_names: set[str] = set()
    for a in result.get("assignments", []):
        cname = a.get("class_name")
        if cname:
            seen_class_names.add(cname)

    # Edge case: if the solver returned no assignments (precheck fail-fast or
    # empty result), fall back to the request's classes so we have something
    # to FK against. The router skips auto-save for empty results anyway, but
    # this keeps save_run safe in tests / future callers.
    if not seen_class_names:
        seen_class_names = set(request_classes_by_name.keys())

    # For each PARENT class in the request, count how many sections the solver
    # produced (e.g. "Class 7A", "Class 7B", "Class 7C" → 3 sections of "Class 7").
    # A section is recognized as `parent_name` + a single uppercase letter.
    sections_of_parent: dict[str, list[str]] = {}
    standalone_names: list[str] = []
    for cname in seen_class_names:
        matched_parent = None
        for parent_name in request_classes_by_name:
            if (cname.startswith(parent_name)
                and len(cname) == len(parent_name) + 1
                and cname[-1].isalpha() and cname[-1].isupper()):
                matched_parent = parent_name
                break
        if matched_parent:
            sections_of_parent.setdefault(matched_parent, []).append(cname)
        else:
            standalone_names.append(cname)

    def _section_size(parent_name: str) -> int:
        parent_size = request_classes_by_name[parent_name].size
        n_sections = max(1, len(sections_of_parent[parent_name]))
        return math.ceil(parent_size / n_sections)

    def _standalone_size(cname: str) -> int:
        # Solver didn't split this one — size is whatever the user entered.
        return request_classes_by_name[cname].size if cname in request_classes_by_name else 30

    class_id_by_name: dict[str, UUID] = {}
    # Insert section rows (split classes)
    for parent_name, sections in sections_of_parent.items():
        size = _section_size(parent_name)
        for section_name in sections:
            cid = uuid4()
            class_id_by_name[section_name] = cid
            db.add(SchoolClass(id=cid, run_id=run_id, name=section_name, size=size))
    # Insert standalone rows (un-split classes — solver scheduled them as-is)
    for cname in standalone_names:
        cid = uuid4()
        class_id_by_name[cname] = cid
        db.add(SchoolClass(id=cid, run_id=run_id, name=cname, size=_standalone_size(cname)))

    db.flush()  # subjects + classes visible before joins

    # teachers (name -> id) and teacher_subjects
    teacher_id_by_name: dict[str, UUID] = {}
    for t in request.teachers:
        tid = uuid4()
        teacher_id_by_name[t.name] = tid
        db.add(SchoolTeacher(id=tid, run_id=run_id, name=t.name))
        for code in t.subjects:
            sid = subject_id_by_code.get(code)
            if sid:
                db.add(SchoolTeacherSubject(teacher_id=tid, subject_id=sid))

    # subject_classes — map each target class name to all of its persisted
    # rows. If the solver split "Class 7" → 7A/B/C, the request still says
    # the subject targets "Class 7" but the DB only has 7A/B/C. Expand parent
    # names to their sections so the link table actually points at real rows.
    for s in request.subjects:
        sid = subject_id_by_code[s.code]
        for cname in s.target_classes:
            if cname in class_id_by_name:
                # Direct hit — un-split class or already a section name.
                db.add(SchoolSubjectClass(
                    subject_id=sid, class_id=class_id_by_name[cname],
                ))
            elif cname in sections_of_parent:
                # Parent name from the wizard — fan out to each section row.
                for section_name in sections_of_parent[cname]:
                    db.add(SchoolSubjectClass(
                        subject_id=sid, class_id=class_id_by_name[section_name],
                    ))

    # rooms (name -> id)
    room_id_by_name: dict[str, UUID] = {}
    for r in request.rooms:
        rid = uuid4()
        room_id_by_name[r.name] = rid
        db.add(SchoolRoom(id=rid, run_id=run_id, name=r.name, capacity=r.capacity))

    # soft constraints
    for sc in request.soft_constraints:
        db.add(RunSoftConstraint(
            run_id=run_id, type=sc.type, target=sc.target,
            when_value=sc.when, weight=sc.weight,
        ))

    db.flush()  # all parent rows materialized before assignments

    # assignments — solver result lookups
    import logging
    _log = logging.getLogger(__name__)
    skipped_summary: dict[str, int] = {
        "missing_subject": 0, "missing_teacher": 0,
        "missing_class": 0, "missing_room": 0, "missing_day": 0,
    }
    skipped_examples: list[str] = []
    for a in result.get("assignments", []):
        sid = subject_id_by_code.get(a.get("subject_code"))
        tid = teacher_id_by_name.get(a.get("teacher_name"))
        cid = class_id_by_name.get(a.get("class_name"))
        rid = room_id_by_name.get(a.get("room_name"))
        if not all([sid, tid, cid, rid]):
            if not sid:    skipped_summary["missing_subject"] += 1
            elif not tid:  skipped_summary["missing_teacher"] += 1
            elif not cid:  skipped_summary["missing_class"]   += 1
            elif not rid:  skipped_summary["missing_room"]    += 1
            if len(skipped_examples) < 3:
                skipped_examples.append(
                    f"subject_code={a.get('subject_code')!r}, "
                    f"teacher_name={a.get('teacher_name')!r}, "
                    f"class_name={a.get('class_name')!r}, "
                    f"room_name={a.get('room_name')!r}"
                )
            continue
        # Solver emits day_index (0-based int) plus day (string name).
        # Our DB column is day_of_week (0-6 int) — use day_index.
        day_int = a.get("day_index", a.get("day_of_week"))
        if day_int is None:
            continue
        db.add(SchoolAssignment(
            id=uuid4(), run_id=run_id,
            day_of_week=day_int, period=a["period"],
            subject_id=sid, teacher_id=tid, class_id=cid, room_id=rid,
        ))

    if any(skipped_summary.values()):
        _log.warning(
            "save_run skipped assignments: %s. Examples: %s. "
            "Known maps — subjects=%d, teachers=%d, classes=%d, rooms=%d",
            skipped_summary, skipped_examples,
            len(subject_id_by_code), len(teacher_id_by_name),
            len(class_id_by_name), len(room_id_by_name),
        )

    return run_id


def load_run(db: Session, *, run_id: UUID) -> dict:
    """Return a wizard-shape payload for a school run, or raise ValueError if not found."""
    run = db.get(Run, run_id)
    if run is None or run.kind != RunKind.SCHOOL:
        raise ValueError(f"School run {run_id} not found")

    tc = db.query(SchoolTimeConfig).filter_by(run_id=run_id).one()
    hc = db.query(SchoolHardConstraints).filter_by(run_id=run_id).one()
    subjects = db.query(SchoolSubject).filter_by(run_id=run_id).all()
    teachers = db.query(SchoolTeacher).filter_by(run_id=run_id).all()
    classes  = db.query(SchoolClass).filter_by(run_id=run_id).all()
    rooms    = db.query(SchoolRoom).filter_by(run_id=run_id).all()
    softs    = db.query(RunSoftConstraint).filter_by(run_id=run_id).all()

    # subject -> class names
    sc_pairs = (
        db.query(SchoolSubjectClass)
        .join(SchoolSubject, SchoolSubject.id == SchoolSubjectClass.subject_id)
        .filter(SchoolSubject.run_id == run_id)
        .all()
    )
    class_name_by_id = {c.id: c.name for c in classes}
    classes_by_subject: dict[UUID, list[str]] = {}
    for pair in sc_pairs:
        classes_by_subject.setdefault(pair.subject_id, []).append(class_name_by_id[pair.class_id])

    # teacher -> subject codes
    ts_pairs = (
        db.query(SchoolTeacherSubject)
        .join(SchoolTeacher, SchoolTeacher.id == SchoolTeacherSubject.teacher_id)
        .filter(SchoolTeacher.run_id == run_id)
        .all()
    )
    subj_code_by_id = {s.id: s.code for s in subjects}
    subjects_by_teacher: dict[UUID, list[str]] = {}
    for pair in ts_pairs:
        subjects_by_teacher.setdefault(pair.teacher_id, []).append(subj_code_by_id[pair.subject_id])

    return {
        "institution_name": run.name,
        "name": run.name,
        "parent_run_id": str(run.parent_run_id) if run.parent_run_id else None,
        "subjects": [
            {
                "name": s.name,
                "code": s.code,
                "periods_per_week": s.periods_per_week,
                "target_classes": classes_by_subject.get(s.id, []),
            }
            for s in subjects
        ],
        "teachers": [
            {"name": t.name, "subjects": subjects_by_teacher.get(t.id, [])}
            for t in teachers
        ],
        "classes": [{"name": c.name, "size": c.size} for c in classes],
        "rooms":   [{"name": r.name, "capacity": r.capacity} for r in rooms],
        "working_days": list(tc.working_days),
        "periods_per_day": tc.periods_per_day,
        "period_duration_minutes": tc.period_duration_minutes,
        "lunch_duration_minutes": tc.lunch_duration_minutes,
        "start_time": tc.start_time.strftime("%H:%M"),
        "constraints": {
            "max_consecutive_periods": hc.max_consecutive_periods,
            "lunch_after_period": tc.lunch_after_period,
            "max_periods_per_day_per_teacher": hc.max_periods_per_day_per_teacher,
        },
        "soft_constraints": [
            {"type": s.type, "target": s.target, "when": s.when_value, "weight": s.weight}
            for s in softs
        ],
    }


def load_run_result(db: Session, *, run_id: UUID) -> dict:
    """Reconstruct the solver-result shape from a saved school run.

    Returns the same dict shape that POST /school/generate emits, so the
    frontend can render a saved run with the existing /timetable view
    (no wizard, no re-solve).
    """
    from app.core.solver_shared import generate_time_slots, build_lunch_slot, build_grid

    run = db.get(Run, run_id)
    if run is None or run.kind != RunKind.SCHOOL:
        raise ValueError(f"School run {run_id} not found")

    tc = db.query(SchoolTimeConfig).filter_by(run_id=run_id).one()

    subjects   = db.query(SchoolSubject).filter_by(run_id=run_id).all()
    teachers   = db.query(SchoolTeacher).filter_by(run_id=run_id).all()
    classes    = db.query(SchoolClass).filter_by(run_id=run_id).all()
    rooms      = db.query(SchoolRoom).filter_by(run_id=run_id).all()
    saved_assignments = db.query(SchoolAssignment).filter_by(run_id=run_id).all()

    subj_by_id    = {s.id: s for s in subjects}
    teacher_by_id = {t.id: t for t in teachers}
    class_by_id   = {c.id: c for c in classes}
    room_by_id    = {r.id: r for r in rooms}

    period_slots = generate_time_slots(
        start_time=tc.start_time.strftime("%H:%M"),
        periods_per_day=tc.periods_per_day,
        period_duration_minutes=tc.period_duration_minutes,
        lunch_after_period=tc.lunch_after_period,
        lunch_duration_minutes=tc.lunch_duration_minutes,
    )
    period_by_num = {ps["period"]: ps for ps in period_slots}
    lunch_slot = build_lunch_slot(
        period_slots, tc.lunch_after_period, tc.lunch_duration_minutes
    )

    # Re-emit assignments in the solver's flat shape.
    flat_assignments: list[dict] = []
    for a in saved_assignments:
        subj    = subj_by_id.get(a.subject_id)
        teacher = teacher_by_id.get(a.teacher_id)
        klass   = class_by_id.get(a.class_id)
        room    = room_by_id.get(a.room_id)
        slot    = period_by_num.get(a.period, {})
        if not all([subj, teacher, klass, room]):
            continue
        flat_assignments.append({
            "class_name":    klass.name,
            "subject_name":  subj.name,
            "subject_code":  subj.code,
            "teacher_name":  teacher.name,
            "room_name":     room.name,
            "day":           tc.working_days[a.day_of_week] if 0 <= a.day_of_week < len(tc.working_days) else str(a.day_of_week),
            "day_index":     a.day_of_week,
            "period":        a.period,
            "start_time":    slot.get("start", ""),
            "end_time":      slot.get("end", ""),
        })

    # Build display_slots: period slots + a synthetic lunch slot in position
    display_slots = list(period_slots)
    if lunch_slot is not None and tc.lunch_after_period > 0:
        display_slots.insert(tc.lunch_after_period, lunch_slot)

    grid = build_grid(
        flat_assignments,
        [{"name": c.name} for c in classes],
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
        "time_slots":         display_slots,
        "working_days":       list(tc.working_days),
        # The synthetic lunch slot inserted into display_slots carries
        # `is_lunch: true`, which is how the frontend grid identifies the
        # lunch column. Returning a positive `lunch_period_index` here would
        # cause the frontend to ALSO mark the next-numbered period as lunch
        # (its OR check is `is_lunch === true OR period === lunchPeriod`),
        # producing two lunch columns. Match the fresh solver, which always
        # returns -1 for this field.
        "lunch_period_index": -1,
        "warnings":           [],
        "stats": {
            "total_assignments":  len(flat_assignments),
            "unplaced_sessions":  0,
            "classes":            len(classes),
            "subjects":           len(subjects),
            "teachers":           len(teachers),
            "rooms":              len(rooms),
            "solve_time_seconds": float(run.solve_time_seconds) if run.solve_time_seconds is not None else 0.0,
            "solver":             run.solver,
            "solver_status":      run.status.value.upper(),
        },
    }


def list_runs(db: Session, *, user_id: UUID, limit: int = 20) -> list[dict]:
    """Return summary rows for school runs owned by user, newest first.

    Each row carries aggregate counts so the history UI can show them
    without a per-run round-trip.
    """
    from sqlalchemy import func, select

    # Fetch the runs first
    runs = (
        db.query(Run)
        .filter(Run.user_id == user_id, Run.kind == RunKind.SCHOOL)
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

    n_subjects    = _count_by_run(SchoolSubject)
    n_teachers    = _count_by_run(SchoolTeacher)
    n_classes     = _count_by_run(SchoolClass)
    n_rooms       = _count_by_run(SchoolRoom)
    n_assignments = _count_by_run(SchoolAssignment)

    # Total students = SUM(school_classes.size) per run.
    students_rows = (
        db.query(SchoolClass.run_id, func.coalesce(func.sum(SchoolClass.size), 0))
        .filter(SchoolClass.run_id.in_(run_ids))
        .group_by(SchoolClass.run_id)
        .all()
    )
    n_students = {rid: int(s) for rid, s in students_rows}

    return [
        {
            "id": str(r.id),
            "name": r.name,
            "status": r.status.value,
            "solver": r.solver,
            "solve_time_seconds": float(r.solve_time_seconds) if r.solve_time_seconds is not None else None,
            "parent_run_id": str(r.parent_run_id) if r.parent_run_id else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "subjects_count":    n_subjects.get(r.id, 0),
            "teachers_count":    n_teachers.get(r.id, 0),
            "classes_count":     n_classes.get(r.id, 0),
            "rooms_count":       n_rooms.get(r.id, 0),
            "assignments_count": n_assignments.get(r.id, 0),
            "students_count":    n_students.get(r.id, 0),
        }
        for r in runs
    ]


def delete_run(db: Session, *, run_id: UUID, user_id: UUID) -> None:
    """Delete a school run owned by user. Cascade removes inputs + assignments."""
    run = db.get(Run, run_id)
    if run is None or run.user_id != user_id or run.kind != RunKind.SCHOOL:
        raise ValueError(f"School run {run_id} not found for this user")
    db.delete(run)
