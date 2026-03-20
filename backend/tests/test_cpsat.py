"""
Direct CP-SAT solver test - bypasses HTTP server entirely.
Run with: .\venv\Scripts\python test_cpsat.py
"""
import logging
logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")

from app.core.simple_solver import solve_timetable

payload = {
    "institution_name": "Green Valley High School",
    "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "periods_per_day": 8,
    "period_duration_minutes": 45,
    "start_time": "08:00",
    "classes": [
        {"name": "10-A", "size": 42},
        {"name": "10-B", "size": 38},
        {"name": "11-Science", "size": 35},
        {"name": "11-Commerce", "size": 40},
        {"name": "12-Science", "size": 32},
    ],
    "subjects": [
        {"name": "Mathematics",    "code": "MATH", "periods_per_week": 6, "target_classes": []},
        {"name": "English",        "code": "ENG",  "periods_per_week": 5, "target_classes": []},
        {"name": "Physics",        "code": "PHY",  "periods_per_week": 5, "target_classes": ["11-Science", "12-Science"]},
        {"name": "Chemistry",      "code": "CHE",  "periods_per_week": 5, "target_classes": ["11-Science", "12-Science"]},
        {"name": "Biology",        "code": "BIO",  "periods_per_week": 4, "target_classes": ["11-Science", "12-Science"]},
        {"name": "Accountancy",    "code": "ACC",  "periods_per_week": 5, "target_classes": ["11-Commerce"]},
        {"name": "Economics",      "code": "ECO",  "periods_per_week": 4, "target_classes": ["11-Commerce"]},
        {"name": "History",        "code": "HIST", "periods_per_week": 3, "target_classes": ["10-A", "10-B"]},
        {"name": "Geography",      "code": "GEO",  "periods_per_week": 3, "target_classes": ["10-A", "10-B"]},
        {"name": "Computer Sci",   "code": "CS",   "periods_per_week": 3, "target_classes": []},
        {"name": "Phys Education", "code": "PE",   "periods_per_week": 2, "target_classes": []},
    ],
    "teachers": [
        {"name": "Mr. Sharma",  "subjects": ["MATH"]},
        {"name": "Ms. Kapoor",  "subjects": ["MATH"]},
        {"name": "Mrs. Nair",   "subjects": ["ENG"]},
        {"name": "Mr. Verma",   "subjects": ["ENG"]},
        {"name": "Dr. Mehta",   "subjects": ["PHY", "CS"]},
        {"name": "Ms. Iyer",    "subjects": ["CHE"]},
        {"name": "Mr. Gupta",   "subjects": ["BIO"]},
        {"name": "Ms. Bose",    "subjects": ["ACC", "ECO"]},
        {"name": "Mr. Pillai",  "subjects": ["HIST", "GEO"]},
        {"name": "Ms. Rao",     "subjects": ["PE"]},
    ],
    "rooms": [
        {"name": "Room 101",     "capacity": 45},
        {"name": "Room 102",     "capacity": 45},
        {"name": "Room 103",     "capacity": 45},
        {"name": "Room 201",     "capacity": 45},
        {"name": "Room 202",     "capacity": 45},
        {"name": "Science Lab",  "capacity": 35},
        {"name": "Computer Lab", "capacity": 35},
    ],
    "constraints": {
        "max_consecutive_periods": 3,
        "lunch_after_period": 4,
        "max_periods_per_day_per_teacher": 6,
    },
}

print("\nRunning solver (may take up to 15s)...")
result = solve_timetable(payload)

print()
print("=" * 40)
print(f"Solver:      {result['solver']}")
print(f"Status:      {result['status']}")
print(f"Solve time:  {result['solve_time']}s")
print(f"Assignments: {result['stats']['total_assignments']}")
print("=" * 40)

# Per-class subject summary
print()
for cls_name in ["10-A", "11-Science", "11-Commerce", "12-Science"]:
    subj = sorted(set(a["subject_code"] for a in result["assignments"] if a["class_name"] == cls_name))
    print(f"{cls_name:15s}: {subj}")

# Constraint validation
print()
print("Constraint checks (target_classes):")
tests = [
    ("PHY in 10-A",    "10-A",         "PHY",  False),
    ("PHY in 11-Sci",  "11-Science",   "PHY",  True),
    ("ACC in 10-A",    "10-A",         "ACC",  False),
    ("ACC in 11-Com",  "11-Commerce",  "ACC",  True),
    ("HIST in 10-A",   "10-A",         "HIST", True),
    ("HIST in 11-Sci", "11-Science",   "HIST", False),
]
all_pass = True
for label, cls, code, expected in tests:
    codes = set(a["subject_code"] for a in result["assignments"] if a["class_name"] == cls)
    actual = code in codes
    ok = "✅" if actual == expected else "❌"
    if actual != expected:
        all_pass = False
    print(f"  {ok}  {label:20s}  expected={expected}  got={actual}")

print()
print("ALL CONSTRAINTS PASSED ✅" if all_pass else "SOME CONSTRAINTS FAILED ❌")
