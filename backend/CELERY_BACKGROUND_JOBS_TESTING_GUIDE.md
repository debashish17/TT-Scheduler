# Phase 7: Celery Background Jobs Testing Guide

Complete testing guide for asynchronous task processing, background jobs, and real-time progress tracking.

## Prerequisites

### 1. System Requirements
```bash
# Ensure Redis is installed and running
redis-server --version  # Should be 5.0+

# Start Redis if not running
redis-server

# Verify Redis connection
redis-cli ping  # Should return PONG
```

### 2. Install Dependencies
```bash
# Ensure all Celery-related packages are installed
pip install celery[redis]==5.3.6
pip install redis==5.0.1
pip install flower==2.0.1  # Optional: Web monitoring

# Verify installation
celery --version
```

### 3. Environment Setup
```bash
# Update .env file with Redis configuration
echo "REDIS_URL=redis://localhost:6379/0" >> .env
echo "CELERY_BROKER_URL=redis://localhost:6379/0" >> .env
echo "CELERY_RESULT_BACKEND=redis://localhost:6379/0" >> .env

# Optional: Email configuration for notifications
echo "SMTP_ENABLED=false" >> .env
```

## Starting the System

### 1. Start Redis Server
```bash
# Option 1: Default configuration
redis-server

# Option 2: With custom config
redis-server /path/to/redis.conf

# Verify Redis is running
redis-cli ping
```

### 2. Start FastAPI Server
```bash
# Terminal 1: Start the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Start Celery Workers
```bash
# Terminal 2: Start all Celery workers
chmod +x scripts/start_celery.sh
./scripts/start_celery.sh

# Or start workers individually for debugging:
celery -A app.celery_app worker --loglevel=info --queues=timetable_generation
```

### 4. Start Flower Monitoring (Optional)
```bash
# Terminal 3: Start Flower web interface
celery -A app.celery_app flower --port=5555

# Access at: http://localhost:5555
```

## Core Functionality Testing

### 1. Asynchronous Timetable Generation

#### Test 1.1: Submit Generation Job
```bash
# Submit async timetable generation
curl -X POST "http://localhost:8000/api/v1/jobs/timetables/generate" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "semester": "Fall 2024",
  "optimization_mode": "balanced",
  "time_limit_minutes": 5,
  "enable_soft_constraints": true
}'
```

**Expected Response**:
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "submitted",
  "message": "Timetable generation job submitted successfully",
  "estimated_completion": "5-15 minutes",
  "tracking_url": "/api/v1/jobs/550e8400-.../status",
  "websocket_url": "ws://localhost:8000/ws/jobs/550e8400-...",
  "notification_enabled": false
}
```

#### Test 1.2: Track Job Progress
```bash
# Get real-time job status
JOB_ID="550e8400-e29b-41d4-a716-446655440000"
curl "http://localhost:8000/api/v1/jobs/${JOB_ID}/status"
```

**Expected Progress States**:
1. **PENDING**: Job queued
   ```json
   {
     "job_id": "...",
     "status": "PENDING",
     "progress_percentage": 0.0,
     "message": "Job is queued and waiting to start"
   }
   ```

2. **PROGRESS**: Job running
   ```json
   {
     "job_id": "...",
     "status": "PROGRESS",
     "progress_percentage": 62.5,
     "current_step": 5,
     "total_steps": 8,
     "current_step_name": "Running CP-SAT optimization"
   }
   ```

3. **SUCCESS**: Job completed
   ```json
   {
     "job_id": "...",
     "status": "SUCCESS",
     "progress_percentage": 100.0,
     "result": {
       "timetable_id": "...",
       "assignment_count": 120,
       "assignment_rate": 95.2,
       "generation_time": 142.5
     }
   }
   ```

#### Test 1.3: Monitor with Polling Script
```bash
# Create polling script
cat > monitor_job.sh << 'EOF'
#!/bin/bash
JOB_ID=$1
while true; do
    STATUS=$(curl -s "http://localhost:8000/api/v1/jobs/${JOB_ID}/status" | jq -r '.status')
    PROGRESS=$(curl -s "http://localhost:8000/api/v1/jobs/${JOB_ID}/status" | jq -r '.progress_percentage')
    echo "Status: $STATUS | Progress: $PROGRESS%"

    if [ "$STATUS" = "SUCCESS" ] || [ "$STATUS" = "FAILURE" ]; then
        break
    fi
    sleep 2
done
EOF

chmod +x monitor_job.sh
./monitor_job.sh YOUR_JOB_ID
```

### 2. Bulk Data Import Jobs

#### Test 2.1: Submit Faculty Import
```bash
# Test async faculty import
curl -X POST "http://localhost:8000/api/v1/jobs/import/faculty" \
-F "institution_id=YOUR_INSTITUTION_ID" \
-F "file=@test_faculty_data.xlsx"
```

**Expected Response**:
```json
{
  "job_id": "...",
  "institution_id": "...",
  "filename": "test_faculty_data.xlsx",
  "file_size_mb": 0.25,
  "status": "submitted",
  "import_type": "faculty",
  "tracking_url": "/api/v1/jobs/.../status"
}
```

#### Test 2.2: Validate Before Import
```bash
# Validate Excel data without importing
curl -X POST "http://localhost:8000/api/v1/jobs/import/validate" \
-F "import_type=faculty" \
-F "file=@test_faculty_data.xlsx"
```

**Expected Response**:
```json
{
  "job_id": "...",
  "import_type": "faculty",
  "filename": "test_faculty_data.xlsx",
  "status": "submitted",
  "operation": "validation_only"
}
```

**Check Validation Results**:
```bash
# Get validation results
curl "http://localhost:8000/api/v1/jobs/${JOB_ID}/status"
```

**Expected Result**:
```json
{
  "status": "SUCCESS",
  "result": {
    "is_valid": true,
    "total_rows": 25,
    "structure_errors": [],
    "content_errors": [],
    "warnings": ["Row 5: Email format unusual but valid"],
    "validation_summary": {
      "structure_valid": true,
      "content_valid": true,
      "error_count": 0,
      "warning_count": 1
    }
  }
}
```

### 3. Analytics Report Generation

#### Test 3.1: Submit Analytics Report Job
```bash
# Generate comprehensive analytics report
curl -X POST "http://localhost:8000/api/v1/jobs/analytics/report" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "report_type": "comprehensive",
  "period_days": 30,
  "include_trends": true
}'
```

#### Test 3.2: Faculty Workload Analysis
```bash
# Analyze faculty workload distribution
curl -X POST "http://localhost:8000/api/v1/jobs/analytics/faculty-workload" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "semester": "Fall 2024"
}'
```

#### Test 3.3: Room Utilization Report
```bash
# Generate room utilization report
curl -X POST "http://localhost:8000/api/v1/jobs/analytics/room-utilization" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "period_days": 30
}'
```

## Job Management Testing

### 1. List Running Jobs
```bash
# Get all active jobs
curl "http://localhost:8000/api/v1/jobs?limit=20"
```

**Expected Response**:
```json
{
  "jobs": [
    {
      "job_id": "...",
      "task_name": "app.tasks.timetable_generation.generate_timetable_async",
      "status": "STARTED",
      "worker": "timetable@hostname",
      "started_at": "2024-03-19T10:15:30",
      "job_type": "timetable"
    }
  ],
  "total": 3,
  "active_workers": 4,
  "queue_summary": {
    "active": 3,
    "scheduled": 2,
    "reserved": 5
  }
}
```

### 2. Filter Jobs by Status
```bash
# Get only successful jobs
curl "http://localhost:8000/api/v1/jobs?status_filter=SUCCESS&limit=10"

# Get only failed jobs
curl "http://localhost:8000/api/v1/jobs?status_filter=FAILURE&limit=10"
```

### 3. Cancel Running Job
```bash
# Cancel a job (terminate if running)
curl -X DELETE "http://localhost:8000/api/v1/jobs/${JOB_ID}"
```

**Expected Response**:
```json
{
  "job_id": "...",
  "status": "cancelled",
  "previous_status": "PROGRESS",
  "message": "Job cancellation requested"
}
```

### 4. Retry Failed Job
```bash
# Retry a failed job
curl -X POST "http://localhost:8000/api/v1/jobs/${JOB_ID}/retry"
```

## Performance and Load Testing

### 1. Concurrent Job Submission
```bash
# Submit multiple jobs simultaneously
for i in {1..10}; do
    curl -X POST "http://localhost:8000/api/v1/jobs/timetables/generate" \
    -H "Content-Type: application/json" \
    -d '{
      "institution_id": "YOUR_INSTITUTION_ID",
      "semester": "Test Semester '$i'",
      "optimization_mode": "fast",
      "time_limit_minutes": 2
    }' &
done
wait

echo "All jobs submitted!"
```

### 2. Queue Load Testing
```bash
# Check queue lengths and worker capacity
celery -A app.celery_app inspect active_queues
celery -A app.celery_app inspect stats
```

### 3. Memory and CPU Monitoring
```bash
# Monitor worker resource usage
watch -n 1 'ps aux | grep celery | grep -v grep'

# Or use htop for better visualization
htop -p $(pgrep -f "celery worker" | tr '\n' ',' | sed 's/,$//')
```

## Error Handling Testing

### 1. Test Invalid Data Handling
```bash
# Submit job with invalid institution ID
curl -X POST "http://localhost:8000/api/v1/jobs/timetables/generate" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "00000000-0000-0000-0000-000000000000",
  "semester": "Fall 2024"
}'
```

**Expected**: Job should fail gracefully with descriptive error.

### 2. Test Timeout Handling
```bash
# Submit job with very short timeout
curl -X POST "http://localhost:8000/api/v1/jobs/timetables/generate" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "semester": "Fall 2024",
  "time_limit_minutes": 0.1
}'
```

**Expected**: Job should timeout gracefully and return partial results or explanation.

### 3. Test Large File Import
```bash
# Create a large test file (>10MB)
# Attempt import
curl -X POST "http://localhost:8000/api/v1/jobs/import/faculty" \
-F "institution_id=YOUR_INSTITUTION_ID" \
-F "file=@large_test_file.xlsx"
```

**Expected**: Should reject with 413 "File size exceeds limit" error.

## Monitoring with Flower

### 1. Access Flower Dashboard
```bash
# Open in browser
open http://localhost:5555

# Or access directly
curl "http://localhost:5555/api/workers"
```

### 2. Monitor Task Execution
- Navigate to "Tasks" tab in Flower
- View real-time task execution
- Check task success/failure rates
- Analyze task duration statistics

### 3. Check Worker Health
- Navigate to "Workers" tab
- Monitor CPU and memory usage per worker
- Check queue lengths
- View active/successful/failed task counts

## Redis Monitoring

### 1. Check Queue Status
```bash
# Connect to Redis CLI
redis-cli

# Check queue lengths
LLEN celery
LLEN timetable_generation
LLEN data_processing
LLEN analytics
LLEN notifications

# View pending tasks
LRANGE timetable_generation 0 -1

# Check task results
KEYS celery-task-meta-*
```

### 2. Monitor Redis Memory
```bash
# Check Redis memory usage
redis-cli info memory

# View all keys (careful in production!)
redis-cli DBSIZE
```

### 3. Clear Stale Data
```bash
# Clear Celery results older than 1 hour
celery -A app.celery_app purge

# Clear specific queue
redis-cli DEL timetable_generation
```

## Integration Testing Workflow

### End-to-End Test Script
```bash
#!/bin/bash
# Complete async workflow test

echo "=== Phase 7 Integration Test ==="

# 1. Start services
echo "1. Starting Redis..."
redis-server --daemonize yes

echo "2. Starting Celery workers..."
./scripts/start_celery.sh

sleep 5

# 2. Submit timetable generation
echo "3. Submitting timetable generation job..."
JOB_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/v1/jobs/timetables/generate" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "semester": "Integration Test 2024",
  "optimization_mode": "fast",
  "time_limit_minutes": 2
}')

JOB_ID=$(echo $JOB_RESPONSE | jq -r '.job_id')
echo "Job ID: $JOB_ID"

# 3. Monitor progress
echo "4. Monitoring job progress..."
while true; do
    STATUS_RESPONSE=$(curl -s "http://localhost:8000/api/v1/jobs/${JOB_ID}/status")
    STATUS=$(echo $STATUS_RESPONSE | jq -r '.status')
    PROGRESS=$(echo $STATUS_RESPONSE | jq -r '.progress_percentage')

    echo "Status: $STATUS | Progress: $PROGRESS%"

    if [ "$STATUS" = "SUCCESS" ]; then
        echo "✓ Job completed successfully!"
        echo $STATUS_RESPONSE | jq '.result'
        break
    elif [ "$STATUS" = "FAILURE" ]; then
        echo "✗ Job failed!"
        echo $STATUS_RESPONSE | jq '.error'
        exit 1
    fi

    sleep 3
done

# 4. Submit analytics job
echo "5. Submitting analytics job..."
ANALYTICS_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/v1/jobs/analytics/report" \
-H "Content-Type: application/json" \
-d "{
  \"institution_id\": \"YOUR_INSTITUTION_ID\",
  \"report_type\": \"comprehensive\",
  \"period_days\": 7
}")

ANALYTICS_JOB_ID=$(echo $ANALYTICS_RESPONSE | jq -r '.job_id')
echo "Analytics Job ID: $ANALYTICS_JOB_ID"

# 5. Cleanup
echo "6. Integration test complete!"
echo "Jobs submitted and tracked successfully"

# Optional: Stop workers
read -p "Stop Celery workers? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ./scripts/stop_celery.sh
fi
```

## Performance Benchmarks

### Expected Performance Metrics

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Job submission | <100ms | API response time |
| Queue processing | <1s | Time from submit to worker pickup |
| Small timetable (50 courses) | 30-60s | Fast mode |
| Medium timetable (200 courses) | 2-5 min | Balanced mode |
| Large timetable (500 courses) | 5-15 min | Quality mode |
| Faculty import (100 records) | 10-30s | Excel processing |
| Analytics report | 1-3 min | Comprehensive report |
| Progress updates | Real-time | <2s latency |

## Troubleshooting

### Common Issues

#### 1. Workers Not Starting
```bash
# Check Redis connection
redis-cli ping

# Check for port conflicts
lsof -i :6379

# View Celery logs
tail -f logs/celery_*.log
```

#### 2. Jobs Stuck in PENDING
```bash
# Check if workers are running
celery -A app.celery_app inspect active

# Check queue routing
celery -A app.celery_app inspect active_queues

# Restart workers
./scripts/stop_celery.sh
./scripts/start_celery.sh
```

#### 3. Memory Issues
```bash
# Monitor worker memory
ps aux | grep celery | awk '{print $2, $4, $11}'

# Restart workers to clear memory
./scripts/stop_celery.sh
./scripts/start_celery.sh
```

#### 4. Task Failures
```bash
# View failed tasks in Flower
open http://localhost:5555/tasks?state=FAILURE

# Check worker logs
grep "ERROR" logs/celery_*.log
```

## Success Criteria

### Functional Requirements ✅
- [ ] Async timetable generation works end-to-end
- [ ] Real-time progress tracking updates correctly
- [ ] Bulk import jobs process successfully
- [ ] Analytics jobs generate reports
- [ ] Email notifications send (if configured)
- [ ] Job cancellation works properly
- [ ] Failed jobs can be retried

### Performance Requirements ✅
- [ ] Job submission latency <100ms
- [ ] Progress updates <2s latency
- [ ] Multiple concurrent jobs handled correctly
- [ ] Worker resource usage <80% CPU, <2GB RAM per worker
- [ ] Queue processing <5s from submit to start

### Reliability Requirements ✅
-[ ] Workers auto-restart on failure
- [ ] Tasks retry on transient failures
- [ ] Graceful shutdown preserves work
- [ ] No memory leaks after 100+ jobs
- [ ] Results persist for 2 hours

### Monitoring Requirements ✅
- [ ] Flower dashboard accessible
- [ ] Redis monitoring functional
- [ ] Worker health metrics available
- [ ] Job history tracked
- [ ] Error reporting comprehensive

---

**Next Steps**: After successful testing, proceed to frontend integration and WebSocket real-time updates implementation.

## Additional Resources

- Celery Documentation: https://docs.celeryproject.org/
- Redis Documentation: https://redis.io/docs/
- Flower Documentation: https://flower.readthedocs.io/
- FastAPI Background Tasks: https://fastapi.tiangolo.com/tutorial/background-tasks/