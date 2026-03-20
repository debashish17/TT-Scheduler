import requests, json

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

print("Sending request...")
resp = requests.post("http://localhost:8000/api/v1/timetable/generate-simple", json=payload, timeout=60)

print(f"Status: {resp.status_code}")
if resp.ok:
    data = resp.json()
    print(f"Solver:      {data.get('solver')}")
    print(f"Status:      {data.get('status')}")
    print(f"Solve time:  {data.get('solve_time')}s")
    stats = data.get('stats', {})
    print(f"Assignments: {stats.get('total_assignments')}")
    print(f"Classes:     {stats.get('classes')}")
    # Print first class Monday schedule as a sample
    grid = data.get("grid", {})
    first_class = next(iter(grid), None)
    if first_class:
        print(f"\nSample — {first_class} Monday:")
        monday = grid[first_class].get("Monday", {})
        for period, slot in sorted(monday.items(), key=lambda x: int(x[0])):
            print(f"  P{period}: {slot['subject_name']} ({slot['teacher_name']})")
else:
    print("Error:", resp.text)
