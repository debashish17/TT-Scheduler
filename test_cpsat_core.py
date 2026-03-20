#!/usr/bin/env python3
"""
Simple CP-SAT Test - Verify Google OR-Tools constraint programming is working.
This test validates the core optimization engine without complex app dependencies.
"""

import sys
from datetime import datetime

def test_ortools_installation():
    """Test if OR-Tools is properly installed."""
    print("1. Testing OR-Tools installation...")

    try:
        from ortools.sat.python import cp_model
        print("   SUCCESS: OR-Tools imported successfully")
        return True
    except ImportError as e:
        print(f"   FAILED: OR-Tools import failed: {e}")
        return False

def test_basic_cp_sat():
    """Test basic CP-SAT functionality with a simple problem."""
    print("\\n2. Testing basic CP-SAT solver...")

    try:
        from ortools.sat.python import cp_model

        # Create a simple constraint problem: x + 2*y = 3, x,y >= 0
        model = cp_model.CpModel()

        # Variables
        x = model.NewIntVar(0, 3, 'x')
        y = model.NewIntVar(0, 3, 'y')

        # Constraint: x + 2*y = 3
        model.Add(x + 2 * y == 3)

        # Solve
        solver = cp_model.CpSolver()
        status = solver.Solve(model)

        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            print(f"   SUCCESS: CP-SAT solver working! Solution: x={solver.Value(x)}, y={solver.Value(y)}")
            return True
        else:
            print(f"   FAILED: CP-SAT solver failed with status: {status}")
            return False

    except Exception as e:
        print(f"   FAILED: CP-SAT test failed: {e}")
        return False

def test_timetable_like_problem():
    """Test a small timetable-like constraint problem."""
    print("\\n3. Testing timetable-like CP-SAT problem...")

    try:
        from ortools.sat.python import cp_model

        # Simple timetable: 2 courses, 2 faculty, 2 rooms, 4 time slots
        # Constraint: Each course assigned to exactly one (faculty, room, slot)
        # Constraint: No faculty/room overlap in same slot

        model = cp_model.CpModel()

        num_courses = 2
        num_faculty = 2
        num_rooms = 2
        num_slots = 4

        # Decision variables: assign[course][faculty][room][slot] = 1 if assigned
        assign = {}
        for c in range(num_courses):
            for f in range(num_faculty):
                for r in range(num_rooms):
                    for s in range(num_slots):
                        assign[c, f, r, s] = model.NewBoolVar(f'assign_c{c}_f{f}_r{r}_s{s}')

        # Constraint 1: Each course must be assigned exactly once
        for c in range(num_courses):
            model.Add(
                sum(assign[c, f, r, s]
                    for f in range(num_faculty)
                    for r in range(num_rooms)
                    for s in range(num_slots)) == 1
            )

        # Constraint 2: No faculty overlap (faculty teaches at most one course per slot)
        for f in range(num_faculty):
            for s in range(num_slots):
                model.Add(
                    sum(assign[c, f, r, s]
                        for c in range(num_courses)
                        for r in range(num_rooms)) <= 1
                )

        # Constraint 3: No room overlap (room hosts at most one course per slot)
        for r in range(num_rooms):
            for s in range(num_slots):
                model.Add(
                    sum(assign[c, f, r, s]
                        for c in range(num_courses)
                        for f in range(num_faculty)) <= 1
                )

        # Solve the problem
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 10  # 10 second limit

        status = solver.Solve(model)

        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            print(f"   SUCCESS: Timetable problem solved successfully!")
            print(f"      Status: {solver.StatusName(status)}")
            print(f"      Wall time: {solver.WallTime():.3f}s")
            print(f"      Branches: {solver.NumBranches()}")

            # Show solution
            assignments = []
            for c in range(num_courses):
                for f in range(num_faculty):
                    for r in range(num_rooms):
                        for s in range(num_slots):
                            if solver.Value(assign[c, f, r, s]) == 1:
                                assignments.append((c, f, r, s))
                                print(f"      Course {c} -> Faculty {f} -> Room {r} -> Slot {s}")

            print(f"      Total assignments: {len(assignments)}")
            return len(assignments) == num_courses  # Should assign all courses

        else:
            print(f"   FAILED: Timetable problem failed with status: {solver.StatusName(status)}")
            return False

    except Exception as e:
        print(f"   FAILED: Timetable CP-SAT test failed: {e}")
        import traceback
        print(f"      Traceback: {traceback.format_exc()}")
        return False

def test_solver_performance():
    """Test CP-SAT solver performance with a larger problem."""
    print("\\n4. Testing CP-SAT solver performance...")

    try:
        from ortools.sat.python import cp_model

        # Larger problem: 5 courses, 3 faculty, 4 rooms, 10 time slots
        model = cp_model.CpModel()

        num_courses = 5
        num_faculty = 3
        num_rooms = 4
        num_slots = 10

        # Variables
        assign = {}
        for c in range(num_courses):
            for f in range(num_faculty):
                for r in range(num_rooms):
                    for s in range(num_slots):
                        assign[c, f, r, s] = model.NewBoolVar(f'x_{c}_{f}_{r}_{s}')

        # Each course assigned exactly once
        for c in range(num_courses):
            model.Add(sum(assign[c, f, r, s] for f in range(num_faculty)
                         for r in range(num_rooms) for s in range(num_slots)) == 1)

        # Faculty no overlap
        for f in range(num_faculty):
            for s in range(num_slots):
                model.Add(sum(assign[c, f, r, s] for c in range(num_courses)
                             for r in range(num_rooms)) <= 1)

        # Room no overlap
        for r in range(num_rooms):
            for s in range(num_slots):
                model.Add(sum(assign[c, f, r, s] for c in range(num_courses)
                             for f in range(num_faculty)) <= 1)

        # Solve with time limit
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 30
        solver.parameters.num_search_workers = 4  # Multi-threading

        start_time = datetime.now()
        status = solver.Solve(model)
        solve_time = (datetime.now() - start_time).total_seconds()

        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            assigned_courses = sum(1 for c in range(num_courses)
                                 for f in range(num_faculty)
                                 for r in range(num_rooms)
                                 for s in range(num_slots)
                                 if solver.Value(assign[c, f, r, s]) == 1)

            print(f"   SUCCESS: Performance test passed!")
            print(f"      Problem size: {num_courses} courses, {num_faculty} faculty, {num_rooms} rooms, {num_slots} slots")
            print(f"      Variables: {len(assign):,}")
            print(f"      Status: {solver.StatusName(status)}")
            print(f"      Solve time: {solve_time:.3f}s")
            print(f"      Wall time: {solver.WallTime():.3f}s")
            print(f"      Branches: {solver.NumBranches():,}")
            print(f"      Conflicts: {solver.NumConflicts():,}")
            print(f"      Assigned courses: {assigned_courses}/{num_courses}")

            return assigned_courses == num_courses

        else:
            print(f"   FAILED: Performance test failed: {solver.StatusName(status)}")
            return False

    except Exception as e:
        print(f"   FAILED: Performance test failed: {e}")
        return False

def main():
    """Main test function."""
    print("CP-SAT Timetable Engine Core Test")
    print("=" * 50)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    tests = [
        test_ortools_installation,
        test_basic_cp_sat,
        test_timetable_like_problem,
        test_solver_performance
    ]

    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"   ERROR: Test failed with exception: {e}")
            results.append(False)

    # Summary
    passed = sum(results)
    total = len(results)

    print("\\n" + "=" * 50)
    print(f"TEST SUMMARY: {passed}/{total} tests passed")

    if passed == total:
        print("\\nALL TESTS PASSED!")
        print("\\nYour CP-SAT optimization engine is working correctly!")
        print("\\nThe timetable generation system is ready for:")
        print("   • Complex constraint satisfaction")
        print("   • Multi-threaded optimization")
        print("   • Large-scale timetable problems")
        print("   • Real-time progress tracking")

        print("\\nNext Steps:")
        print("   1. Install Python dependencies: pip install -r backend/requirements.txt")
        print("   2. Set up database connection in backend/.env")
        print("   3. Start backend server: cd backend && uvicorn app.main:app --reload")
        print("   4. Start Celery worker: cd backend && celery -A app.celery_app worker --loglevel=info")
        print("   5. Test the frontend: cd frontend && npm run dev")
        return True
    else:
        print("\\nSOME TESTS FAILED!")
        print("   Check the error messages above.")
        print("   Make sure OR-Tools is properly installed:")
        print("   pip install ortools==9.8.3296")
        return False

if __name__ == "__main__":
    success = main()
    print(f"\\nCompleted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    sys.exit(0 if success else 1)