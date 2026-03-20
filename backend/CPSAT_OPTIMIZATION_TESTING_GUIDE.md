# CP-SAT Timetable Optimization Testing Guide

This comprehensive testing guide covers the CP-SAT optimization engine and timetable generation system implementation in Phase 6.

## Overview

The timetable generation system uses Google OR-Tools CP-SAT (Constraint Programming with Satisfiability) solver to create optimal timetables while satisfying all hard constraints and optimizing soft constraints for quality improvement.

## Prerequisites

### 1. System Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Verify OR-Tools installation
python -c "from ortools.sat.python import cp_model; print('OR-Tools installed successfully')"

# Start PostgreSQL and Redis
# Ensure database schema is applied with all tables
alembic upgrade head

# Start the FastAPI server
uvicorn app.main:app --reload
```

### 2. Test Data Requirements

Before testing, ensure you have the following data in your database:
- At least 1 Institution
- At least 2 Departments
- At least 5 Faculty members
- At least 10 Courses
- At least 5 Classrooms
- At least 3 Student Batches
- At least 40 Time Slots (5 days × 8 periods)

## Core Components Testing

### 1. Constraint System Testing

#### Test Case 1.1: Hard Constraints Validation
```bash
# Test constraint definitions
curl -X GET "http://localhost:8000/api/v1/timetables/constraints/info"
```

**Expected Response**: Information about all 8 hard constraints:
- HC001: Faculty No Overlap
- HC002: Batch No Overlap
- HC003: Room No Overlap
- HC004: Faculty Availability
- HC005: Room Capacity
- HC006: Room Features
- HC007: Course Assignment
- HC008: Time Slot Validity

#### Test Case 1.2: Constraint Configuration
```python
# Test constraint configuration
from app.core.constraints import TimetableConstraintConfig, HardConstraints

config = TimetableConstraintConfig(
    time_limit_seconds=300,
    enable_soft_constraints=True,
    max_constraint_violations=0
)

# Verify all constraints are defined
hard_constraints = HardConstraints.get_all_constraints()
assert len(hard_constraints) == 8
```

### 2. Optimization Engine Testing

#### Test Case 2.1: CP-SAT Model Creation
```python
# Test optimization engine initialization
from app.core.optimization import create_timetable_engine
from app.core.constraints import TimetableConstraintConfig

config = TimetableConstraintConfig()
engine = create_timetable_engine(config)

assert engine is not None
assert engine.config.time_limit_seconds == 300  # Default 5 minutes
```

#### Test Case 2.2: Problem Data Loading
```bash
# Test with minimal dataset
curl -X POST "http://localhost:8000/api/v1/timetables/generate" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "semester": "Test Semester 2024",
  "optimization_mode": "fast",
  "time_limit_minutes": 2,
  "enable_soft_constraints": false
}'
```

**Expected Behavior**: Engine should load all necessary data and validate problem feasibility.

### 3. Timetable Generation Testing

#### Test Case 3.1: Basic Generation (Fast Mode)
```bash
curl -X POST "http://localhost:8000/api/v1/timetables/generate" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "semester": "Fall 2024",
  "optimization_mode": "fast",
  "time_limit_minutes": 1,
  "enable_soft_constraints": false,
  "max_solutions": 1
}'
```

**Expected Response**: Timetable with status "completed", assignment_rate > 0%, generation_time < 60 seconds.

#### Test Case 3.2: Quality Generation (Balanced Mode)
```bash
curl -X POST "http://localhost:8000/api/v1/timetables/generate" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "semester": "Fall 2024",
  "optimization_mode": "balanced",
  "time_limit_minutes": 5,
  "enable_soft_constraints": true,
  "max_solutions": 3
}'
```

**Expected Response**: Higher assignment_rate, lower penalty_score, comprehensive solver statistics.

#### Test Case 3.3: Premium Generation (Quality Mode)
```bash
curl -X POST "http://localhost:8000/api/v1/timetables/generate" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "semester": "Fall 2024",
  "optimization_mode": "quality",
  "time_limit_minutes": 10,
  "enable_soft_constraints": true,
  "soft_constraint_weights": {
    "SC005": 80,
    "SC006": 70,
    "SC007": 90
  }
}'
```

**Expected Response**: Best assignment_rate and penalty_score, detailed constraint analysis.

## Hard Constraints Testing

### HC001: Faculty No Overlap Testing
```python
# Test that no faculty teaches multiple courses simultaneously
def test_faculty_no_overlap(timetable_response):
    assignments = timetable_response["assignments"]

    # Group by faculty and time slot
    faculty_slots = {}
    for assignment in assignments:
        key = (assignment["faculty_id"], assignment["slot_id"])
        if key in faculty_slots:
            faculty_slots[key].append(assignment)
        else:
            faculty_slots[key] = [assignment]

    # Check no faculty has multiple assignments in same slot
    for key, slot_assignments in faculty_slots.items():
        assert len(slot_assignments) == 1, f"Faculty overlap violation: {key}"
```

### HC002: Batch No Overlap Testing
```python
# Test that no batch attends multiple courses simultaneously
def test_batch_no_overlap(timetable_response):
    assignments = timetable_response["assignments"]

    batch_slots = {}
    for assignment in assignments:
        key = (assignment["batch_id"], assignment["slot_id"])
        if key in batch_slots:
            batch_slots[key].append(assignment)
        else:
            batch_slots[key] = [assignment]

    for key, slot_assignments in batch_slots.items():
        assert len(slot_assignments) == 1, f"Batch overlap violation: {key}"
```

### HC003: Room No Overlap Testing
```python
# Test that no room hosts multiple courses simultaneously
def test_room_no_overlap(timetable_response):
    assignments = timetable_response["assignments"]

    room_slots = {}
    for assignment in assignments:
        key = (assignment["room_id"], assignment["slot_id"])
        if key in room_slots:
            room_slots[key].append(assignment)
        else:
            room_slots[key] = [assignment]

    for key, slot_assignments in room_slots.items():
        assert len(slot_assignments) == 1, f"Room overlap violation: {key}"
```

### HC005: Room Capacity Testing
```bash
# Test room capacity constraints
curl -X GET "http://localhost:8000/api/v1/timetables/{TIMETABLE_ID}" \
  | jq '.assignments[] | select(.expected_students > .room_capacity)'
```

**Expected Result**: Empty array (no capacity violations).

## Soft Constraints Testing

### Workload Balance Testing
```bash
# Get faculty utilization statistics
curl -X GET "http://localhost:8000/api/v1/timetables/{TIMETABLE_ID}/analytics"
```

**Verify**: `overall_faculty_utilization` should be between 60-90% for optimal balance.

### Gap Minimization Testing
```bash
# Get batch-specific timetable
curl -X GET "http://localhost:8000/api/v1/timetables/{TIMETABLE_ID}/batches/{BATCH_ID}"
```

**Verify**: `average_gap_time` should be minimized (< 30 minutes between classes).

## Performance Testing

### 1. Small Dataset Performance
- **Data**: 5 courses, 3 faculty, 2 rooms, 1 batch
- **Expected**: Solution in < 10 seconds
- **Quality**: 100% assignment rate

### 2. Medium Dataset Performance
- **Data**: 50 courses, 20 faculty, 15 rooms, 10 batches
- **Expected**: Solution in < 2 minutes
- **Quality**: > 95% assignment rate

### 3. Large Dataset Performance
- **Data**: 200+ courses, 50+ faculty, 30+ rooms, 20+ batches
- **Expected**: Solution in < 10 minutes
- **Quality**: > 90% assignment rate with penalty_score < 500

```bash
# Performance test script
for dataset in small medium large; do
  echo "Testing $dataset dataset..."
  start_time=$(date +%s)

  curl -X POST "http://localhost:8000/api/v1/timetables/generate" \
    -H "Content-Type: application/json" \
    -d @"test_data/${dataset}_dataset.json" \
    -o "results/${dataset}_result.json"

  end_time=$(date +%s)
  duration=$((end_time - start_time))
  echo "$dataset dataset completed in ${duration} seconds"
done
```

## Quality Metrics Testing

### 1. Assignment Rate Testing
```bash
# Check assignment rates across different modes
for mode in fast balanced quality; do
  echo "Testing $mode mode..."
  result=$(curl -s -X POST "http://localhost:8000/api/v1/timetables/generate" \
    -H "Content-Type: application/json" \
    -d "{\"institution_id\": \"$INST_ID\", \"semester\": \"Test\", \"optimization_mode\": \"$mode\"}")

  assignment_rate=$(echo $result | jq '.assignment_rate')
  echo "$mode mode assignment rate: $assignment_rate%"
done
```

### 2. Constraint Violation Analysis
```bash
# Analyze constraint violations
curl -X GET "http://localhost:8000/api/v1/timetables/{TIMETABLE_ID}" \
  | jq '.constraint_violations[] | {constraint_id, description, penalty_score}'
```

### 3. Resource Utilization Analysis
```bash
# Faculty utilization distribution
curl -X GET "http://localhost:8000/api/v1/timetables/{TIMETABLE_ID}" \
  | jq '.faculty_utilization | to_entries[] | {faculty_id: .key, utilization: .value}'

# Room utilization distribution
curl -X GET "http://localhost:8000/api/v1/timetables/{TIMETABLE_ID}" \
  | jq '.room_utilization | to_entries[] | {room_id: .key, utilization: .value}'
```

## Comparison and Analytics Testing

### 1. Timetable Comparison
```bash
# Generate multiple timetables for comparison
TIMETABLE_1=$(curl -s -X POST ... | jq -r '.id')
TIMETABLE_2=$(curl -s -X POST ... | jq -r '.id')
TIMETABLE_3=$(curl -s -X POST ... | jq -r '.id')

# Compare timetables
curl -X POST "http://localhost:8000/api/v1/timetables/compare" \
-H "Content-Type: application/json" \
-d "{
  \"timetable_ids\": [\"$TIMETABLE_1\", \"$TIMETABLE_2\", \"$TIMETABLE_3\"],
  \"comparison_criteria\": [\"penalty_score\", \"assignment_rate\", \"faculty_utilization\"]
}"
```

### 2. Analytics Generation
```bash
# Get comprehensive analytics
curl -X GET "http://localhost:8000/api/v1/timetables/{TIMETABLE_ID}/analytics"
```

**Verify Analytics Include**:
- Resource utilization metrics
- Schedule quality analysis
- Constraint satisfaction scores
- Optimization recommendations

## Export and Integration Testing

### 1. Excel Export Testing
```bash
# Test Excel export
curl -X POST "http://localhost:8000/api/v1/timetables/{TIMETABLE_ID}/export" \
-H "Content-Type: application/json" \
-d '{"export_format": "excel", "include_metadata": true}' \
-o "timetable_export.xlsx"

# Verify file integrity
file timetable_export.xlsx  # Should show Excel format
```

### 2. Grid View Testing
```bash
# Test grid view formatting
curl -X GET "http://localhost:8000/api/v1/timetables/{TIMETABLE_ID}?format_as_grid=true" \
  | jq '.grid_view | {days, total_assignments, utilization_percentage}'
```

### 3. Batch-Specific View Testing
```bash
# Test batch timetable view
curl -X GET "http://localhost:8000/api/v1/timetables/{TIMETABLE_ID}/batches/{BATCH_ID}" \
  | jq '{batch_name, total_hours_per_week, days_with_classes, faculty_diversity}'
```

## Error Handling Testing

### 1. Invalid Data Testing
```bash
# Test with missing required data
curl -X POST "http://localhost:8000/api/v1/timetables/generate" \
-H "Content-Type: application/json" \
-d '{"institution_id": "nonexistent", "semester": ""}'
```

**Expected**: 400 Bad Request with descriptive error message.

### 2. Infeasible Problem Testing
```bash
# Test with impossible constraints (e.g., more courses than time slots)
curl -X POST "http://localhost:8000/api/v1/timetables/generate" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "semester": "Infeasible Test",
  "time_limit_minutes": 1
}'
```

**Expected**: Timetable with status "completed" but low assignment_rate and explanation.

### 3. Timeout Testing
```bash
# Test with very short time limit
curl -X POST "http://localhost:8000/api/v1/timetables/generate" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "semester": "Timeout Test",
  "time_limit_minutes": 0.1
}'
```

**Expected**: Partial solution or timeout message with best solution found.

## Integration Testing

### 1. End-to-End Workflow
```bash
#!/bin/bash
# Complete timetable generation workflow test

echo "1. Generate timetable..."
TIMETABLE_ID=$(curl -s -X POST "http://localhost:8000/api/v1/timetables/generate" \
  -H "Content-Type: application/json" \
  -d @test_generation_request.json | jq -r '.id')

echo "2. Verify generation: $TIMETABLE_ID"
curl -s "http://localhost:8000/api/v1/timetables/$TIMETABLE_ID" | jq '.status, .assignment_rate'

echo "3. Get analytics..."
curl -s "http://localhost:8000/api/v1/timetables/$TIMETABLE_ID/analytics" | jq '.overall_faculty_utilization'

echo "4. Export timetable..."
curl -X POST "http://localhost:8000/api/v1/timetables/$TIMETABLE_ID/export" \
  -d '{"export_format": "excel"}' -o "workflow_test.xlsx"

echo "5. Test batch view..."
BATCH_ID=$(curl -s "http://localhost:8000/api/v1/batches/" | jq -r '.batches[0].id')
curl -s "http://localhost:8000/api/v1/timetables/$TIMETABLE_ID/batches/$BATCH_ID" | jq '.total_hours_per_week'

echo "Workflow test completed successfully!"
```

## Success Criteria

### Functional Requirements ✅
- [ ] All 8 hard constraints are enforced (0 violations allowed)
- [ ] Soft constraints are optimized with weighted penalties
- [ ] Multiple optimization modes (fast/balanced/quality) work correctly
- [ ] Assignment rates: Fast mode >80%, Balanced mode >90%, Quality mode >95%
- [ ] Generation times: Fast <60s, Balanced <300s, Quality <600s

### Quality Requirements ✅
- [ ] Faculty utilization balanced within ±20% across all faculty
- [ ] Room utilization >70% during peak hours
- [ ] Student gaps minimized (<2 gaps per day per batch)
- [ ] Lunch break compliance >95%
- [ ] Consecutive sessions for multi-hour courses

### Performance Requirements ✅
- [ ] Small datasets (≤50 courses): <30 seconds
- [ ] Medium datasets (≤200 courses): <5 minutes
- [ ] Large datasets (≤500 courses): <15 minutes
- [ ] Memory usage <2GB for typical datasets

### Integration Requirements ✅
- [ ] Excel export includes all necessary sheets and formatting
- [ ] Grid view displays correctly for all screen sizes
- [ ] Batch-specific views show accurate metrics
- [ ] Analytics provide actionable insights
- [ ] Comparison functionality ranks solutions correctly

## Troubleshooting

### Common Issues

1. **"No feasible solution found"**
   - Check if there are enough rooms for all courses
   - Verify faculty availability matches course requirements
   - Ensure time slots cover required hours

2. **"Low assignment rate"**
   - Increase time limit for optimization
   - Check room capacity vs. expected students
   - Verify faculty qualifications for courses

3. **"High penalty score"**
   - Review soft constraint weights
   - Check faculty preferences and availability
   - Analyze room feature requirements

4. **"Solver timeout"**
   - Reduce problem size or increase time limit
   - Use "fast" mode for initial testing
   - Check for data quality issues

### Performance Optimization

1. **Data Preprocessing**:
   - Remove unnecessary constraints
   - Optimize data loading queries
   - Cache frequently used calculations

2. **Solver Tuning**:
   - Adjust search parameters
   - Use problem-specific heuristics
   - Enable parallel search workers

3. **Memory Management**:
   - Limit variable creation
   - Use efficient data structures
   - Implement garbage collection

---

**Next Steps**: After successful testing, proceed to Phase 7 (Celery Background Jobs) for asynchronous timetable generation using Redis task queues.