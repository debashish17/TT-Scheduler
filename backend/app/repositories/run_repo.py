"""Cross-product run reads. For per-product details use the branch repos."""
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.shared.run import Run, RunKind
from app.models.school.subject     import SchoolSubject
from app.models.school.teacher     import SchoolTeacher
from app.models.school.class_      import SchoolClass
from app.models.school.room        import SchoolRoom
from app.models.school.assignment  import SchoolAssignment
from app.models.college.course     import CollegeCourse
from app.models.college.faculty    import CollegeFaculty
from app.models.college.section    import CollegeSection
from app.models.college.room       import CollegeRoom
from app.models.college.assignment import CollegeAssignment


def list_all_runs(db: Session, *, user_id: UUID, limit: int = 20) -> list[dict]:
    """Return summary rows for both school and college runs, newest first.

    Each row includes aggregate counts:
      - assignments_count: total scheduled rows
      - subjects_count:    subjects (school) or courses (college)
      - teachers_count:    teachers (school) or faculty (college)
      - classes_count:     classes (school) or sections (college)
      - rooms_count:       rooms
    These map to a single 5-tile UI regardless of run kind.
    """
    runs = (
        db.query(Run)
        .filter(Run.user_id == user_id)
        .order_by(Run.created_at.desc())
        .limit(limit)
        .all()
    )
    if not runs:
        return []

    school_ids  = [r.id for r in runs if r.kind == RunKind.SCHOOL]
    college_ids = [r.id for r in runs if r.kind == RunKind.COLLEGE]

    def _count(model, ids):
        if not ids:
            return {}
        rows = (
            db.query(model.run_id, func.count(model.id))
            .filter(model.run_id.in_(ids))
            .group_by(model.run_id)
            .all()
        )
        return {rid: cnt for rid, cnt in rows}

    n_school_subjects    = _count(SchoolSubject,    school_ids)
    n_school_teachers    = _count(SchoolTeacher,    school_ids)
    n_school_classes     = _count(SchoolClass,      school_ids)
    n_school_rooms       = _count(SchoolRoom,       school_ids)
    n_school_assignments = _count(SchoolAssignment, school_ids)

    n_college_courses     = _count(CollegeCourse,     college_ids)
    n_college_faculty     = _count(CollegeFaculty,    college_ids)
    n_college_sections    = _count(CollegeSection,    college_ids)
    n_college_rooms       = _count(CollegeRoom,       college_ids)
    n_college_assignments = _count(CollegeAssignment, college_ids)

    # Students:
    #  - school: SUM(school_classes.size) per run
    #  - college: SUM(college_courses.enrolled_students) per run (= total course-seats)
    n_school_students: dict = {}
    if school_ids:
        rows = (
            db.query(SchoolClass.run_id, func.coalesce(func.sum(SchoolClass.size), 0))
            .filter(SchoolClass.run_id.in_(school_ids))
            .group_by(SchoolClass.run_id)
            .all()
        )
        n_school_students = {rid: int(s) for rid, s in rows}

    n_college_students: dict = {}
    if college_ids:
        rows = (
            db.query(CollegeCourse.run_id, func.coalesce(func.sum(CollegeCourse.enrolled_students), 0))
            .filter(CollegeCourse.run_id.in_(college_ids))
            .group_by(CollegeCourse.run_id)
            .all()
        )
        n_college_students = {rid: int(s) for rid, s in rows}

    out = []
    for r in runs:
        is_school = r.kind == RunKind.SCHOOL
        out.append({
            "id": str(r.id),
            "kind": r.kind.value,
            "name": r.name,
            "status": r.status.value,
            "solver": r.solver,
            "solve_time_seconds": float(r.solve_time_seconds) if r.solve_time_seconds is not None else None,
            "parent_run_id": str(r.parent_run_id) if r.parent_run_id else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "subjects_count":    (n_school_subjects if is_school else n_college_courses).get(r.id, 0),
            "teachers_count":    (n_school_teachers if is_school else n_college_faculty).get(r.id, 0),
            "classes_count":     (n_school_classes  if is_school else n_college_sections).get(r.id, 0),
            "rooms_count":       (n_school_rooms    if is_school else n_college_rooms).get(r.id, 0),
            "assignments_count": (n_school_assignments if is_school else n_college_assignments).get(r.id, 0),
            "students_count":    (n_school_students if is_school else n_college_students).get(r.id, 0),
        })
    return out
