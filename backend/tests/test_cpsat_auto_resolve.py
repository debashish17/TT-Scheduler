import pytest
import logging
from app.core.simple_solver import solve_timetable

logging.basicConfig(level=logging.INFO)

def create_base_payload():
    return {
        "institution_name": "Test School",
        "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "periods_per_day": 5, # 25 periods per week total
        "period_duration_minutes": 45,
        "start_time": "08:00",
        "classes": [],
        "subjects": [],
        "teachers": [],
        "rooms": [],
        "assignments": []
    }

def test_normal_schedule():
    """Case 1: Perfectly solvable schedule."""
    payload = create_base_payload()
    payload["classes"] = [{"name": "10-A", "size": 30}]
    payload["subjects"] = [{"name": "Math", "code": "MATH", "periods_per_week": 5, "target_classes": []}]
    payload["teachers"] = [
        {"name": "Mr. A", "subject_codes": ["MATH"], "max_periods_per_week": 10, "is_part_time": False, "unavailable_periods": []}
    ]
    payload["rooms"] = [{"name": "Room 1", "capacity": 40, "room_type": "Regular"}]
    payload["assignments"] = [
        {"class_name": "10-A", "subject_code": "MATH", "teacher_name": "Mr. A", "room_name": "Room 1", "periods_per_week": 5}
    ]
    
    result = solve_timetable(payload)
    assert result["success"] is True
    assert result["stats"]["unplaced_sessions"] == 0

def test_teacher_overload_conflict():
    """Case 2: Teacher assigned more hours than available periods in the week (26 periods > 25 total periods)."""
    payload = create_base_payload()
    payload["classes"] = [{"name": "10-A", "size": 30}, {"name": "10-B", "size": 30}]
    payload["subjects"] = [{"name": "Math", "code": "MATH", "periods_per_week": 15, "target_classes": []}]
    payload["teachers"] = [
        {"name": "Mr. A", "subject_codes": ["MATH"], "max_periods_per_week": 30, "is_part_time": False, "unavailable_periods": []}
    ]
    payload["rooms"] = [{"name": "Room 1", "capacity": 40, "room_type": "Regular"}, {"name": "Room 2", "capacity": 40, "room_type": "Regular"}]
    payload["assignments"] = [
        {"class_name": "10-A", "subject_code": "MATH", "teacher_name": "Mr. A", "room_name": "Room 1", "periods_per_week": 13},
        {"class_name": "10-B", "subject_code": "MATH", "teacher_name": "Mr. A", "room_name": "Room 2", "periods_per_week": 13}
    ]
    
    result = solve_timetable(payload)
    # Since total periods/week is 25, Mr. A is assigned 26 periods. CP-SAT soft constraints will drop 1 session.
    assert result["success"] is True
    assert result["stats"]["unplaced_sessions"] >= 1
    assert any("Teacher load" in str(w) or "can only cover" in str(w) for w in result.get("warnings", []))

def test_class_split_overload_conflict():
    """Case 3: Class size > Room capacity causes an auto-split, mathematically doubling teacher hours to an overload."""
    payload = create_base_payload()
    # 25 periods per week. Assign 15 periods to Mr. A. Normally fine.
    # But class size is 80, room capacity is 40. It will split into 2 batches.
    # Total teacher periods will jump from 15 to 30, exceeding the 25 possible slots.
    payload["classes"] = [{"name": "10-A", "size": 80}]
    payload["subjects"] = [{"name": "Math", "code": "MATH", "periods_per_week": 15, "target_classes": []}]
    payload["teachers"] = [
        {"name": "Mr. A", "subject_codes": ["MATH"], "max_periods_per_week": 30, "is_part_time": False, "unavailable_periods": []}
    ]
    payload["rooms"] = [{"name": "Room 1", "capacity": 40, "room_type": "Regular"}, {"name": "Room 2", "capacity": 40, "room_type": "Regular"}]
    payload["assignments"] = [
        {"class_name": "10-A", "subject_code": "MATH", "teacher_name": "Mr. A", "room_name": "Room 1", "periods_per_week": 15}
    ]
    
    result = solve_timetable(payload)
    assert result["success"] is True
    # If 30 sessions are generated for a 25-slot week, 5 must be unplaced.
    assert result["stats"]["unplaced_sessions"] >= 5
    assert any("Class size" in str(w) or "Teacher load" in str(w) or "can only cover" in str(w) for w in result.get("warnings", []))

def test_room_scarcity_conflict():
    """Case 4: More concurrent classes than available rooms."""
    payload = create_base_payload()
    payload["classes"] = [{"name": "10-A", "size": 30}, {"name": "10-B", "size": 30}]
    payload["subjects"] = [{"name": "Math", "code": "MATH", "periods_per_week": 15, "target_classes": []}]
    payload["teachers"] = [
        {"name": "Mr. A", "subject_codes": ["MATH"], "max_periods_per_week": 20, "is_part_time": False},
        {"name": "Mr. B", "subject_codes": ["MATH"], "max_periods_per_week": 20, "is_part_time": False}
    ]
    # Only 1 room available.
    payload["rooms"] = [{"name": "Room 1", "capacity": 40, "room_type": "Regular"}]
    payload["assignments"] = [
        {"class_name": "10-A", "subject_code": "MATH", "teacher_name": "Mr. A", "room_name": "Room 1", "periods_per_week": 15},
        {"class_name": "10-B", "subject_code": "MATH", "teacher_name": "Mr. B", "room_name": "Room 1", "periods_per_week": 15}
    ]
    
    result = solve_timetable(payload)
    # Total room capacity is 25 slots for the week. 30 lessons need scheduling. 5 will be unplaced.
    assert result["success"] is True
    assert result["stats"]["unplaced_sessions"] >= 5

def test_part_time_teacher_availability_conflict():
    """Case 5: Part time teacher explicitly limits max_periods_per_week less than assignments."""
    payload = create_base_payload()
    payload["classes"] = [{"name": "10-A", "size": 30}]
    payload["subjects"] = [{"name": "Math", "code": "MATH", "periods_per_week": 5, "target_classes": []}]
    payload["teachers"] = [
        {"name": "Mr. A", "subject_codes": ["MATH"], "max_periods_per_week": 3, "is_part_time": True, "unavailable_periods": []}
    ]
    payload["rooms"] = [{"name": "Room 1", "capacity": 40, "room_type": "Regular"}]
    payload["assignments"] = [
        {"class_name": "10-A", "subject_code": "MATH", "teacher_name": "Mr. A", "room_name": "Room 1", "periods_per_week": 5}
    ]
    
    result = solve_timetable(payload)
    # Although mathematically there are enough slots in the week, teacher's personal limit is 3. 2 sessions drop.
    assert result["success"] is True
    assert result["stats"]["unplaced_sessions"] >= 2


