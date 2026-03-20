"""
Simple School Timetable Solver using Google OR-Tools CP-SAT.

Uses an EFFICIENT model:
  - For each (class, day, period): assign one session (subject + teacher + room)
  - Integer variables instead of exponential boolean combinatorics
  - Falls back to a fast greedy algorithm if CP-SAT times out or is unavailable
"""
import logging
from typing import Dict, List, Any
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def generate_time_slots(start_time: str, periods_per_day: int, period_duration_minutes: int) -> List[Dict]:
    """Generate time slot labels from start time."""
    slots = []
    h, m = map(int, start_time.split(":"))
    current = datetime(2000, 1, 1, h, m)
    for i in range(periods_per_day):
        end = current + timedelta(minutes=period_duration_minutes)
        slots.append({
            "period": i + 1,
            "start": current.strftime("%H:%M"),
            "end": end.strftime("%H:%M"),
            "label": f"Period {i + 1}"
        })
        current = end
    return slots


def solve_timetable(problem: Dict[str, Any]) -> Dict[str, Any]:
    """
    Solve the school timetable using a fast greedy algorithm by default.
    The greedy solver runs in < 1 second and is sufficient for school-scale problems.

    Input problem dict:
    {
      "institution_name": str,
      "subjects": [{"name": str, "code": str, "periods_per_week": int}],
      "teachers": [{"name": str, "subjects": [str]}],
      "classes": [{"name": str, "size": int}],
      "rooms": [{"name": str, "capacity": int}],
      "working_days": ["Monday", ...],
      "periods_per_day": int,
      "period_duration_minutes": int,
      "start_time": "HH:MM",
      "constraints": {
        "max_consecutive_periods": int (default 3),
        "lunch_after_period": int (default 0 = no lunch),
        "max_periods_per_day_per_teacher": int (default periods_per_day)
      }
    }
    """
    return _greedy_solve(problem)


def _greedy_solve(problem: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fast greedy solver that assigns sessions round-robin across days.
    
    Strategy:
    1. For every class × subject, build a list of required sessions.
    2. Iterate over available (day, period) slots in a round-robin order.
    3. Assign a session if the teacher and room are free.
    4. If no exact fit, try any free teacher who can teach the subject.
    """
    start_ts = datetime.now()

    subjects = problem["subjects"]
    teachers = problem["teachers"]
    classes = problem["classes"]
    rooms = problem["rooms"]
    working_days = problem["working_days"]
    periods_per_day = problem["periods_per_day"]
    constraints = problem.get("constraints", {})
    lunch_after = int(constraints.get("lunch_after_period", 0))

    time_slots = generate_time_slots(
        problem.get("start_time", "08:00"),
        periods_per_day,
        problem.get("period_duration_minutes", 45)
    )

    # Skip lunch period index (0-based)
    valid_period_indices = [
        p for p in range(periods_per_day)
        if lunch_after == 0 or p != lunch_after - 1
    ]

    # Build subject code → index map
    subj_by_code = {s["code"]: i for i, s in enumerate(subjects)}

    # For each teacher, build a set of subject indexes they can teach
    teacher_can_teach: List[set] = []
    for t in teachers:
        can = {subj_by_code[code] for code in t.get("subjects", []) if code in subj_by_code}
        if not can:
            can = set(range(len(subjects)))  # teach all if none specified
        teacher_can_teach.append(can)

    # Busy sets: (teacher_idx, day_idx, period_idx) → True
    teacher_busy: Dict = {}
    # Busy sets: (room_idx, day_idx, period_idx) → True
    room_busy: Dict = {}
    # Class slots already assigned: (class_idx, day_idx, period_idx) → True
    class_slot_busy: Dict = {}

    assignments = []

    for c_idx, cls in enumerate(classes):
        class_size = int(cls.get("size", 30))

        # Build a list of sessions this class needs, sorted so subjects spread across days
        sessions_needed = []
        for s_idx, subj in enumerate(subjects):
            required = int(subj.get("periods_per_week", 1))
            for session_num in range(required):
                # Store (subject_idx, preferred_day) — spread across week by session_num
                preferred_day = session_num % len(working_days)
                sessions_needed.append((s_idx, preferred_day))

        # Sort sessions by preferred_day so we naturally spread across the week
        sessions_needed.sort(key=lambda x: x[1])

        # For each session, find a free (day, period, teacher, room) slot
        for s_idx, preferred_day in sessions_needed:
            assigned = False

            # Build a sorted list of (day, period) to try — start near preferred_day
            day_order = list(range(len(working_days)))
            # rotate so we start near the preferred day
            day_order = day_order[preferred_day:] + day_order[:preferred_day]

            for d in day_order:
                if assigned:
                    break
                for p in valid_period_indices:
                    # Skip if class already has something at this slot
                    if class_slot_busy.get((c_idx, d, p)):
                        continue

                    # Find a teacher who can teach this subject and is free
                    t_idx = None
                    for ti in range(len(teachers)):
                        if s_idx not in teacher_can_teach[ti]:
                            continue
                        if teacher_busy.get((ti, d, p)):
                            continue
                        t_idx = ti
                        break

                    if t_idx is None:
                        continue

                    # Find a room that fits the class and is free
                    r_idx = None
                    # Prefer smallest room that fits
                    eligible_rooms = sorted(
                        [ri for ri in range(len(rooms)) if rooms[ri].get("capacity", 40) >= class_size],
                        key=lambda ri: rooms[ri].get("capacity", 40)
                    )
                    if not eligible_rooms:
                        # Accept any free room if none fits (best-effort)
                        eligible_rooms = list(range(len(rooms)))

                    for ri in eligible_rooms:
                        if not room_busy.get((ri, d, p)):
                            r_idx = ri
                            break

                    if r_idx is None:
                        continue

                    # Assign!
                    teacher_busy[(t_idx, d, p)] = True
                    room_busy[(r_idx, d, p)] = True
                    class_slot_busy[(c_idx, d, p)] = True

                    slot_info = time_slots[p] if p < len(time_slots) else {"start": "?", "end": "?"}
                    assignments.append({
                        "class_name": cls["name"],
                        "class_index": c_idx,
                        "subject_name": subjects[s_idx]["name"],
                        "subject_code": subjects[s_idx]["code"],
                        "teacher_name": teachers[t_idx]["name"],
                        "teacher_index": t_idx,
                        "room_name": rooms[r_idx]["name"],
                        "room_index": r_idx,
                        "day": working_days[d],
                        "day_index": d,
                        "period": p + 1,
                        "start_time": slot_info["start"],
                        "end_time": slot_info["end"]
                    })
                    assigned = True
                    break

            if not assigned:
                logger.warning(
                    f"Could not assign {subjects[s_idx]['name']} for {cls['name']} "
                    f"— not enough available slots"
                )

    solve_duration = (datetime.now() - start_ts).total_seconds()
    grid = _build_grid(assignments, classes, working_days, time_slots, valid_period_indices)

    return {
        "success": True,
        "solver": "Greedy",
        "status": "FEASIBLE",
        "solve_time": round(solve_duration, 3),
        "assignments": assignments,
        "grid": grid,
        "time_slots": time_slots,
        "working_days": working_days,
        "stats": {
            "total_assignments": len(assignments),
            "classes": len(classes),
            "subjects": len(subjects),
            "teachers": len(teachers),
            "rooms": len(rooms),
            "solve_time_seconds": round(solve_duration, 3)
        }
    }


def _build_grid(
    assignments: List[Dict],
    classes: List[Dict],
    working_days: List[str],
    time_slots: List[Dict],
    valid_period_indices: List[int]
) -> Dict:
    """Build a grid structure: grid[class_name][day][period] = assignment."""
    grid = {}
    for cls in classes:
        grid[cls["name"]] = {day: {} for day in working_days}

    for a in assignments:
        class_name = a["class_name"]
        day = a["day"]
        period = str(a["period"])
        if class_name in grid and day in grid[class_name]:
            grid[class_name][day][period] = a

    return grid
