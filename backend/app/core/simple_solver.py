"""
Simple School Timetable Solver using Google OR-Tools CP-SAT.

Uses an EFFICIENT model:
  - For each (class, day, period): assign one session (subject + teacher + room)
  - Integer variables instead of exponential boolean combinatorics
  - Falls back to a fast greedy algorithm if CP-SAT times out or is unavailable
"""
import logging
from typing import Dict, List, Any, Set, Tuple
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)  # logger


def generate_time_slots(start_time: str, periods_per_day: int, period_duration_minutes: int) -> List[Dict[str, Any]]:
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
    Solve the school timetable using Google OR-Tools CP-SAT.
    Falls back to a fast greedy algorithm ONLY if ortools is not installed.
    """
    try:
        return _cp_solve(problem)
    except ImportError:
        logger.warning("ortools not installed — falling back to Greedy solver.")
        return _greedy_solve(problem)
    except Exception as e:
        # Log the real error so we can see exactly what went wrong
        logger.error(f"CP-SAT solver failed: {type(e).__name__}: {e}", exc_info=True)
        raise  # re-raise so the API returns a 500 with the real error


def _cp_solve(problem: Dict[str, Any]) -> Dict[str, Any]:
    import math
    from ortools.sat.python import cp_model
    from datetime import datetime
    start_ts = datetime.now()
    logger.info("CP-SAT solver started ✓")

    subjects = problem["subjects"]
    teachers = problem["teachers"]
    raw_classes = problem.get("classes", [])
    rooms = problem.get("rooms", [])

    max_room_capacity = 40
    if rooms:
        max_room_capacity = int(max([int(r.get("capacity", 40)) for r in rooms]))

    classes = []
    for cls in raw_classes:
        class_size = int(cls.get("size", 30))
        if class_size > max_room_capacity:
            c_size = float(class_size)
            capacity = float(max_room_capacity)
            num_sections = max(2, math.ceil(c_size / capacity))
            section_size = math.ceil(c_size / float(num_sections))
            for i in range(num_sections):
                new_cls = cls.copy()
                new_cls["name"] = f"{cls['name']} {chr(65 + i)}"
                new_cls["size"] = section_size
                new_cls["original_name"] = cls["name"]
                classes.append(new_cls)
        else:
            classes.append(cls)

    working_days = problem["working_days"]
    periods_per_day = problem["periods_per_day"]
    constraints = problem.get("constraints", {})
    lunch_after = int(constraints.get("lunch_after_period", 0))

    time_slots = generate_time_slots(
        problem.get("start_time", "08:00"),
        periods_per_day,
        problem.get("period_duration_minutes", 45)
    )

    valid_period_indices = [
        p for p in range(periods_per_day)
        if lunch_after == 0 or p != lunch_after - 1
    ]

    subj_by_code = {s["code"]: i for i, s in enumerate(subjects)}
    teacher_can_teach = []
    for t in teachers:
        can = {subj_by_code[code] for code in t.get("subjects", []) if code in subj_by_code}
        if not can:
            can = set(range(len(subjects)))
        teacher_can_teach.append(can)

    model = cp_model.CpModel()
    assignments_vars = {}
    
    class_sessions = {c: [] for c in range(len(classes))}
    session_details = {} 
    session_counter = 0

    for c_idx, cls in enumerate(classes):
        for s_idx, subj in enumerate(subjects):
            target_classes = subj.get("target_classes", [])
            original_name = cls.get("original_name")
            target_match = not target_classes or cls["name"] in target_classes or (original_name and original_name in target_classes)
            if not target_match:
                continue
            required = int(subj.get("periods_per_week", 1))
            for _ in range(required):
                session_id = session_counter
                class_sessions[c_idx].append(session_id)
                session_details[session_id] = (c_idx, s_idx)
                session_counter += 1

    valid_teachers_for_subj = {}
    for s_idx in range(len(subjects)):
        valid_teachers_for_subj[s_idx] = [t_idx for t_idx, can in enumerate(teacher_can_teach) if s_idx in can]

    valid_rooms_for_class = {}
    for c_idx, cls in enumerate(classes):
        c_size = int(cls.get("size", 30))
        eligible = [r_idx for r_idx, r in enumerate(rooms) if r.get("capacity", 40) >= c_size]
        valid_rooms_for_class[c_idx] = eligible if eligible else list(range(len(rooms)))

    session_vars = {}
    vars_by_class_time = {} 
    vars_by_teacher_time = {} 
    vars_by_room_time = {} 
    vars_by_class_subject_day = {}

    for session_id, (c_idx, s_idx) in session_details.items():
        session_vars[session_id] = []
        for t_idx in valid_teachers_for_subj[s_idx]:
            for r_idx in valid_rooms_for_class[c_idx]:
                for d in range(len(working_days)):
                    for p in valid_period_indices:
                        name = f"x_s{session_id}_t{t_idx}_r{r_idx}_d{d}_p{p}"
                        var = model.NewBoolVar(name)
                        assignments_vars[(session_id, t_idx, r_idx, d, p)] = var
                        session_vars[session_id].append(var)
                        
                        if (c_idx, d, p) not in vars_by_class_time: vars_by_class_time[(c_idx, d, p)] = []
                        vars_by_class_time[(c_idx, d, p)].append(var)
                        if (t_idx, d, p) not in vars_by_teacher_time: vars_by_teacher_time[(t_idx, d, p)] = []
                        vars_by_teacher_time[(t_idx, d, p)].append(var)
                        if (r_idx, d, p) not in vars_by_room_time: vars_by_room_time[(r_idx, d, p)] = []
                        vars_by_room_time[(r_idx, d, p)].append(var)
                        if (c_idx, s_idx, d) not in vars_by_class_subject_day: vars_by_class_subject_day[(c_idx, s_idx, d)] = []
                        vars_by_class_subject_day[(c_idx, s_idx, d)].append(var)

    for session_id, vars_list in session_vars.items():
        if not vars_list:
            raise Exception(f"No valid assignments possible for a session (check teacher/room constraints)")
        model.AddExactlyOne(vars_list)

    for var_list in vars_by_class_time.values():
        model.AddAtMostOne(var_list)

    for var_list in vars_by_teacher_time.values():
        model.AddAtMostOne(var_list)

    for var_list in vars_by_room_time.values():
        model.AddAtMostOne(var_list)

    for (c_idx, s_idx, d), var_list in vars_by_class_subject_day.items():
        if not var_list:
            continue
        required = int(subjects[s_idx].get("periods_per_week", 1))
        max_per_day = max(1, math.ceil(required / len(working_days)))
        model.Add(sum(var_list) <= max_per_day)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 15.0
    status = solver.Solve(model)

    logger.info(f"CP-SAT solve complete. Status: {solver.StatusName(status)} | Time: {round(solver.WallTime(), 3)}s")

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        assignments = []
        for (session_id, t_idx, r_idx, d, p), var in assignments_vars.items():
            if solver.BooleanValue(var):
                c_idx, s_idx = session_details[session_id]
                cls = classes[c_idx]
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
        
        grid = _build_grid(assignments, classes, working_days, time_slots, valid_period_indices)
        
        return {
            "success": True,
            "solver": "CP-SAT",
            "status": solver.StatusName(status),
            "solve_time": round(solver.WallTime(), 3),
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
                "solve_time_seconds": round(solver.WallTime(), 3)
            }
        }
    else:
        raise Exception(f"Status returned '{solver.StatusName(status)}'")


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

    import math

    subjects = problem["subjects"]
    teachers = problem["teachers"]
    raw_classes = problem.get("classes", [])
    rooms = problem.get("rooms", [])

    max_room_capacity = 40
    if rooms:
        max_room_capacity = int(max([int(r.get("capacity", 40)) for r in rooms]))

    classes = []
    for cls in raw_classes:
        class_size = int(cls.get("size", 30))
        if class_size > max_room_capacity:
            c_size = float(class_size)
            capacity = float(max_room_capacity)
            num_sections = max(2, math.ceil(c_size / capacity))
            section_size = math.ceil(c_size / float(num_sections))
            for i in range(num_sections):
                new_cls = cls.copy()
                new_cls["name"] = f"{cls['name']} {chr(65 + i)}"
                new_cls["size"] = section_size
                new_cls["original_name"] = cls["name"]
                classes.append(new_cls)
        else:
            classes.append(cls)
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
    teacher_can_teach: List[Any] = []
    for t in teachers:
        can = {subj_by_code[code] for code in t.get("subjects", []) if code in subj_by_code}
        if not can:
            can = set(range(len(subjects)))  # teach all if none specified
        teacher_can_teach.append(can)

    # Busy sets: (teacher_idx, day_idx, period_idx) → True
    teacher_busy: Dict[Tuple[int, int, int], bool] = {}
    # Busy sets: (room_idx, day_idx, period_idx) → True
    room_busy: Dict[Tuple[int, int, int], bool] = {}
    # Class slots already assigned: (class_idx, day_idx, period_idx) → True
    class_slot_busy: Dict[Tuple[int, int, int], bool] = {}

    assignments = []

    for c_idx, cls in enumerate(classes):
        class_size = int(cls.get("size", 30))

        # Build a list of sessions this class needs, sorted so subjects spread across days
        sessions_needed = []
        for s_idx, subj in enumerate(subjects):
            target_classes = subj.get("target_classes", [])
            original_name = cls.get("original_name")
            target_match = not target_classes or cls["name"] in target_classes or (original_name and original_name in target_classes)
            if not target_match:
                continue

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
                    for ti, can_teach_set in enumerate(teacher_can_teach):
                        if s_idx not in can_teach_set:
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

                    assert t_idx is not None and r_idx is not None

                    # Assign!
                    teacher_busy[(t_idx, d, p)] = True
                    room_busy[(r_idx, d, p)] = True
                    class_slot_busy[(c_idx, d, p)] = True

                    slot_info = time_slots.__getitem__(p) if p < len(time_slots) else {"start": "?", "end": "?"}
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
    assignments: List[Dict[str, Any]],
    classes: List[Dict[str, Any]],
    working_days: List[str],
    time_slots: List[Dict[str, Any]],
    valid_period_indices: List[int]
) -> Dict[str, Any]:
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
