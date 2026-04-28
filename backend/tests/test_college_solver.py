"""
Tests for college_solver.py — all MUST-tier constraints verified.

Run with:
    cd backend
    pytest tests/test_college_solver.py -v
"""
import pytest
from app.core.college_solver import (
    _derive_sections,
    _diagnose_college_problem,
    solve_college_timetable,
)

# ──────────────────────────────────────────────────────────────
# Fixtures / helpers
# ──────────────────────────────────────────────────────────────

LECTURE_ROOMS = [
    {"name": "LH-1", "capacity": 60, "room_type": "lecture_hall"},
    {"name": "LH-2", "capacity": 60, "room_type": "lecture_hall"},
]
LAB_ROOM = {"name": "CS-Lab-1", "capacity": 40, "room_type": "computer_lab"}


def _base_problem(**overrides) -> dict:
    """Minimal valid college problem — 1 dept, 1 course, 2 faculty, 2 lecture rooms."""
    p = {
        "mode": "college",
        "institution_name": "Test College",
        "semester": 5,
        "departments": [{"code": "CS", "name": "Computer Science"}],
        "course_offerings": [
            {
                "code": "CS301",
                "name": "Data Structures",
                "department": "CS",
                "year": 3,
                "credits": 3,
                "lectures_per_week": 3,
                "has_lab": False,
                "required_lecture_room_type": "lecture_hall",
                "required_lab_room_type": None,
                "enrolled_students": 90,
                "is_elective": False,
                "faculty_codes": ["F1", "F2"],
            }
        ],
        "faculty": [
            {"code": "F1", "name": "Prof. A", "department": "CS",
             "courses_can_teach": ["CS301"], "max_hours_per_week": 18},
            {"code": "F2", "name": "Prof. B", "department": "CS",
             "courses_can_teach": ["CS301"], "max_hours_per_week": 18},
        ],
        "rooms": list(LECTURE_ROOMS),
        "working_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "periods_per_day": 6,
        "period_duration_minutes": 60,
        "start_time": "08:00",
        "constraints": {
            "lunch_period_index": 3,
            "max_consecutive_periods": 3,
            "max_periods_per_day_per_faculty": 6,
        },
    }
    p.update(overrides)
    return p


# ──────────────────────────────────────────────────────────────
# Section derivation tests
# ──────────────────────────────────────────────────────────────

class TestDeriveSection:
    def test_single_section_exact_fit(self):
        courses = [{"code": "X", "enrolled_students": 50,
                    "required_lecture_room_type": "classroom"}]
        rooms   = [{"name": "R1", "capacity": 60, "room_type": "classroom"}]
        sections, warnings = _derive_sections(courses, rooms)
        assert len(sections) == 1
        assert sections[0]["label"] == "A"
        assert sections[0]["student_count"] == 50
        assert not warnings

    def test_two_sections_even_split(self):
        courses = [{"code": "X", "enrolled_students": 100,
                    "required_lecture_room_type": "lecture_hall"}]
        rooms   = [
            {"name": "LH1", "capacity": 60, "room_type": "lecture_hall"},
            {"name": "LH2", "capacity": 60, "room_type": "lecture_hall"},
        ]
        sections, warnings = _derive_sections(courses, rooms)
        assert len(sections) == 2
        counts = sorted([s["student_count"] for s in sections])
        assert counts == [50, 50]
        assert not warnings

    def test_unequal_sections_warning(self):
        courses = [{"code": "X", "enrolled_students": 148,
                    "required_lecture_room_type": "lecture_hall"}]
        rooms   = [
            {"name": "Big",   "capacity": 80, "room_type": "lecture_hall"},
            {"name": "Small1","capacity": 40, "room_type": "lecture_hall"},
            {"name": "Small2","capacity": 40, "room_type": "lecture_hall"},
        ]
        sections, warnings = _derive_sections(courses, rooms)
        codes = [w["code"] for w in warnings]
        assert "UNEQUAL_SECTIONS" in codes
        assert len(sections) == 3

    def test_no_room_capacity_error(self):
        courses = [{"code": "X", "enrolled_students": 200,
                    "required_lecture_room_type": "lecture_hall"}]
        rooms   = [{"name": "R1", "capacity": 50, "room_type": "lecture_hall"}]
        sections, warnings = _derive_sections(courses, rooms)
        codes = [w["code"] for w in warnings]
        assert "NO_LECTURE_ROOM_CAPACITY" in codes

    def test_deterministic_labels(self):
        """Same input twice → same labels and counts."""
        courses = [{"code": "X", "enrolled_students": 90,
                    "required_lecture_room_type": "lecture_hall"}]
        rooms   = [
            {"name": "LH1", "capacity": 60, "room_type": "lecture_hall"},
            {"name": "LH2", "capacity": 60, "room_type": "lecture_hall"},
        ]
        s1, _ = _derive_sections(courses, rooms)
        s2, _ = _derive_sections(courses, rooms)
        assert s1 == s2


# ──────────────────────────────────────────────────────────────
# Diagnostic tests
# ──────────────────────────────────────────────────────────────

class TestDiagnostics:
    def _run(self, problem):
        sections, _ = _derive_sections(
            problem.get("course_offerings", []),
            problem.get("rooms", []),
        )
        return _diagnose_college_problem(problem, sections)

    def test_no_qualified_faculty(self):
        p = _base_problem()
        # Remove all faculty qualification
        for f in p["faculty"]:
            f["courses_can_teach"] = []
        issues = self._run(p)
        codes = [w["code"] for w in issues]
        assert "NO_QUALIFIED_FACULTY" in codes
        errors = [w for w in issues if w["level"] == "error"]
        assert errors

    def test_no_lecture_room_for_course(self):
        p = _base_problem()
        # Replace lecture_hall rooms with classroom rooms — course needs lecture_hall
        p["rooms"] = [{"name": "C1", "capacity": 60, "room_type": "classroom"}]
        issues = self._run(p)
        codes = [w["code"] for w in issues]
        assert "NO_LECTURE_ROOM_FOR_COURSE" in codes

    def test_no_lab_room_for_course(self):
        p = _base_problem()
        p["course_offerings"][0].update({
            "credits": 4, "has_lab": True,
            "required_lab_room_type": "computer_lab",
            "lectures_per_week": 3,
        })
        # Rooms have no computer_lab
        issues = self._run(p)
        codes = [w["code"] for w in issues]
        assert "NO_LAB_ROOM_FOR_COURSE" in codes

    def test_minimum_load_infeasible(self):
        p = _base_problem()
        # F1 is sole qualifier for both courses.
        # Each course derives 2 sections × 3 lectures = 6 hrs.
        # Total forced load on F1 = 12 hrs, but cap is 6 → MINIMUM_LOAD_INFEASIBLE.
        p["course_offerings"] = [
            {"code": "CS301", "name": "DS", "department": "CS", "year": 3,
             "credits": 3, "lectures_per_week": 3, "has_lab": False,
             "required_lecture_room_type": "lecture_hall", "required_lab_room_type": None,
             "enrolled_students": 90, "is_elective": False, "faculty_codes": ["F1"]},
            {"code": "CS302", "name": "Algo", "department": "CS", "year": 3,
             "credits": 3, "lectures_per_week": 3, "has_lab": False,
             "required_lecture_room_type": "lecture_hall", "required_lab_room_type": None,
             "enrolled_students": 90, "is_elective": False, "faculty_codes": ["F1"]},
        ]
        p["rooms"] = [
            {"name": "LH-1", "capacity": 60, "room_type": "lecture_hall"},
            {"name": "LH-2", "capacity": 60, "room_type": "lecture_hall"},
            {"name": "LH-3", "capacity": 60, "room_type": "lecture_hall"},
            {"name": "LH-4", "capacity": 60, "room_type": "lecture_hall"},
        ]
        # F1 is sole qualifier: courses_can_teach must include both courses
        p["faculty"][0]["courses_can_teach"] = ["CS301", "CS302"]
        p["faculty"][0]["max_hours_per_week"] = 6   # cap at 6 — forced load is 12
        p["faculty"][1]["courses_can_teach"] = []    # F2 qualifies for nothing
        issues = self._run(p)
        codes = [w["code"] for w in issues]
        assert "MINIMUM_LOAD_INFEASIBLE" in codes

    def test_lunch_out_of_range(self):
        p = _base_problem()
        p["constraints"]["lunch_period_index"] = 99
        issues = self._run(p)
        codes = [w["code"] for w in issues]
        assert "LUNCH_PERIOD_OUT_OF_RANGE" in codes

    def test_dept_mismatch_warning(self):
        p = _base_problem()
        p["course_offerings"][0]["department"] = "GHOST"
        issues = self._run(p)
        codes = [w["code"] for w in issues]
        assert "DEPT_COURSE_MISMATCH" in codes
        # Should be warning level, not error
        mismatch = [w for w in issues if w["code"] == "DEPT_COURSE_MISMATCH"]
        assert mismatch[0]["level"] == "warning"

    def test_clean_problem_no_errors(self):
        p = _base_problem()
        issues = self._run(p)
        errors = [w for w in issues if w["level"] == "error"]
        assert not errors


# ──────────────────────────────────────────────────────────────
# Solver integration tests (require OR-Tools)
# ──────────────────────────────────────────────────────────────

def _ortools_available() -> bool:
    try:
        from ortools.sat.python import cp_model  # noqa
        return True
    except ImportError:
        return False


pytestmark_ortools = pytest.mark.skipif(
    not _ortools_available(), reason="OR-Tools not installed"
)


@pytestmark_ortools
class TestCollegeSolverIntegration:

    def test_basic_solve(self):
        """1 dept, 2 courses (3-credit + 4-credit), each with 1 section of 30 students."""
        p = _base_problem()
        # Both faculty can teach both courses
        p["faculty"][0]["courses_can_teach"] = ["CS301", "CS302"]
        p["faculty"][1]["courses_can_teach"] = ["CS301", "CS302"]
        p["course_offerings"] = [
            {
                "code": "CS301", "name": "Data Structures", "department": "CS",
                "year": 3, "credits": 3, "lectures_per_week": 3, "has_lab": False,
                "required_lecture_room_type": "lecture_hall",
                "required_lab_room_type": None,
                "enrolled_students": 30,   # 1 section of 30 in a 60-cap LH
                "is_elective": False,
                "faculty_codes": ["F1", "F2"],
            },
            {
                "code": "CS302", "name": "OS Lab Course", "department": "CS",
                "year": 3, "credits": 4, "lectures_per_week": 3, "has_lab": True,
                "required_lecture_room_type": "lecture_hall",
                "required_lab_room_type": "computer_lab",
                "enrolled_students": 30,   # 1 section of 30; lab room holds 40
                "is_elective": False,
                "faculty_codes": ["F1", "F2"],
            },
        ]
        p["rooms"] = list(LECTURE_ROOMS) + [LAB_ROOM]
        result = solve_college_timetable(p)

        assert result["success"]
        assert len(result["assignments"]) > 0
        errors = [w for w in result["warnings"] if w["level"] == "error"]
        assert not errors

    def test_no_qualified_faculty_fast_fail(self):
        """Fast-fail when NO faculty qualifies for a course."""
        p = _base_problem()
        for f in p["faculty"]:
            f["courses_can_teach"] = []
        result = solve_college_timetable(p)
        codes = [w["code"] for w in result["warnings"]]
        assert "NO_QUALIFIED_FACULTY" in codes
        assert result["assignments"] == []

    def test_no_lecture_room_fast_fail(self):
        """Fast-fail when no lecture_hall room exists."""
        p = _base_problem()
        p["rooms"] = [{"name": "C1", "capacity": 100, "room_type": "classroom"}]
        result = solve_college_timetable(p)
        codes = [w["code"] for w in result["warnings"]]
        assert "NO_LECTURE_ROOM_FOR_COURSE" in codes
        assert result["assignments"] == []

    def test_no_lab_room_fast_fail(self):
        """Fast-fail when no computer_lab room exists for a 4-credit course."""
        p = _base_problem()
        p["course_offerings"][0].update({
            "credits": 4, "has_lab": True,
            "required_lab_room_type": "computer_lab",
            "lectures_per_week": 3,
        })
        # Only lecture_hall rooms, no computer_lab
        result = solve_college_timetable(p)
        codes = [w["code"] for w in result["warnings"]]
        assert "NO_LAB_ROOM_FOR_COURSE" in codes
        assert result["assignments"] == []

    def test_capacity_constraint(self):
        """Solver must never assign a 55-student section to a 40-cap room."""
        p = _base_problem()
        p["course_offerings"][0]["enrolled_students"] = 55
        p["rooms"] = [
            {"name": "Big",   "capacity": 60, "room_type": "lecture_hall"},
            {"name": "Small", "capacity": 40, "room_type": "lecture_hall"},
        ]
        result = solve_college_timetable(p)
        for a in result["assignments"]:
            room = next(r for r in p["rooms"] if r["name"] == a["room_name"])
            assert room["capacity"] >= a["section_students"], (
                f"Room {room['name']} cap {room['capacity']} < section {a['section_students']}"
            )

    def test_lab_faculty_binding(self):
        """Lab sessions of a section must have same faculty as lecture sessions."""
        p = _base_problem()
        p["course_offerings"][0].update({
            "credits": 4, "has_lab": True,
            "required_lab_room_type": "computer_lab",
            "lectures_per_week": 3,
        })
        p["rooms"] = list(LECTURE_ROOMS) + [LAB_ROOM]
        result = solve_college_timetable(p)

        # Group by section
        by_section: dict = {}
        for a in result["assignments"]:
            key = (a["subject_code"], a["section_label"])
            by_section.setdefault(key, []).append(a)

        for key, sessions in by_section.items():
            faculty_names = {a["teacher_name"] for a in sessions}
            assert len(faculty_names) == 1, (
                f"Section {key} has multiple faculty: {faculty_names}"
            )

    def test_lab_block_consecutive(self):
        """Lab block must consist of two consecutive periods on the same day."""
        p = _base_problem()
        p["course_offerings"][0].update({
            "credits": 4, "has_lab": True,
            "required_lab_room_type": "computer_lab",
            "lectures_per_week": 3,
        })
        p["rooms"] = list(LECTURE_ROOMS) + [LAB_ROOM]
        result = solve_college_timetable(p)

        lab_sessions = [a for a in result["assignments"] if a["course_type"] == "lab"]
        starts    = [a for a in lab_sessions if a["is_lab_block_start"]]
        followers = [a for a in lab_sessions if not a["is_lab_block_start"]]

        assert len(starts) == len(followers)

        for start in starts:
            matching = [
                f for f in followers
                if f["subject_code"] == start["subject_code"]
                and f["section_label"] == start["section_label"]
                and f["day"] == start["day"]
            ]
            assert matching, f"No follower found for start {start}"
            follower = matching[0]
            assert follower["period"] == start["period"] + 1, (
                f"Lab follower period {follower['period']} != start+1 {start['period'] + 1}"
            )

    def test_determinism(self):
        """Same input twice must produce byte-identical assignments."""
        p = _base_problem()
        r1 = solve_college_timetable(p)
        r2 = solve_college_timetable(p)
        # Sort before comparing to be order-independent
        def sort_key(a):
            return (a["subject_code"], a["section_label"], a["day"], a["period"])
        a1 = sorted(r1["assignments"], key=sort_key)
        a2 = sorted(r2["assignments"], key=sort_key)
        assert a1 == a2

    def test_sections_derived_populated(self):
        """sections_derived must contain faculty and room info after solve."""
        p = _base_problem()
        result = solve_college_timetable(p)
        assert "sections_derived" in result
        for sec in result["sections_derived"]:
            assert "course_code"   in sec
            assert "section_label" in sec
            assert "faculty_name"  in sec
            assert "room_name"     in sec
            assert "student_count" in sec

    def test_school_baseline_untouched(self):
        """Importing college_solver must not affect school solver output."""
        import json, os
        from app.core.simple_solver import solve_timetable

        fixture_path = os.path.join(
            os.path.dirname(__file__), "fixtures", "school_baseline.json"
        )
        if not os.path.exists(fixture_path):
            pytest.skip("school_baseline.json not found — run capture_baseline.py first")

        with open(fixture_path) as f:
            baseline = json.load(f)

        from tests.fixtures.capture_baseline import PROBLEM
        result = solve_timetable(PROBLEM)
        result.pop("solve_time", None)
        if "stats" in result:
            result["stats"].pop("solve_time_seconds", None)

        assert result["stats"]["total_assignments"] == baseline["stats"]["total_assignments"]
        assert result["stats"]["unplaced_sessions"] == baseline["stats"]["unplaced_sessions"]
