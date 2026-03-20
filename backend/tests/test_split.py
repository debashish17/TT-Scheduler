import json
from app.core.simple_solver import solve_timetable

problem = {
    "institution_name": "Greenwood High",
    "subjects": [
        {"name": "Math", "code": "MATH", "periods_per_week": 4, "target_classes": ["Class 6", "Class 7"]},
        {"name": "Science", "code": "SCI", "periods_per_week": 3, "target_classes": ["Class 6", "Class 7"]},
        {"name": "History", "code": "HIS", "periods_per_week": 2, "target_classes": ["Class 6"]},
        {"name": "Geography", "code": "GEO", "periods_per_week": 2, "target_classes": ["Class 7"]}
    ],
    "teachers": [
        {"name": "Alice", "subjects": ["MATH"]},
        {"name": "Bob", "subjects": ["SCI"]},
        {"name": "Charlie", "subjects": ["HIS"]},
        {"name": "Diana", "subjects": ["GEO"]},
    ],
    "classes": [
        {"name": "Class 6", "size": 60},
        {"name": "Class 7", "size": 30}
    ],
    "rooms": [
        {"name": "Room 101", "capacity": 35},
        {"name": "Room 102", "capacity": 35},
        {"name": "Room 103", "capacity": 40},
    ],
    "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "periods_per_day": 4,
    "period_duration_minutes": 45,
    "start_time": "08:00",
    "constraints": {}
}

result = solve_timetable(problem)
print("="*50)
print(f"🏆 SOLVER USED:      {result['solver']}")
print(f"📊 SOLVER STATUS:    {result['status']}")
print(f"⏱  SOLVE TIME:       {result['stats']['solve_time_seconds']} seconds")
print(f"✅ SUCCESS:          {result['success']}")
print("="*50)

unique_classes = sorted(list(set(c["class_name"] for c in result["assignments"])))
print(f"\n🏫 DYNAMICALLY GENERATED BATCHES: {unique_classes}")

print("\n📅 SAMPLE TIMETABLE FOR CLASS 6 A:")
grid = result["grid"].get("Class 6 A", {})
for day in problem["working_days"]:
    print(f"\n{day}:")
    day_schedule = grid.get(day, {})
    if not day_schedule:
        print("  - Free Day -")
        continue
    for p in range(1, problem["periods_per_day"] + 1):
        period = str(p)
        if period in day_schedule:
            a = day_schedule[period]
            print(f"  Period {p}: {a['subject_code']} w/ {a['teacher_name']} in {a['room_name']}")
        else:
            print(f"  Period {p}: -- Free --")

print("\nTesting Note: If you look closely, you will see CP-SAT's 'Spread' constraint naturally evenly distributed the subjects!")

