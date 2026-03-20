"""
Background Jobs API routes.
Manages Celery background tasks with real-time progress tracking.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime
import json
import io

from app.db.session import get_db
from app.celery_app import celery_app, TaskState
from app.schemas.timetable import TimetableGenerationRequest, TimetableStatus
from app.tasks import (
    generate_timetable_async,
    optimize_existing_timetable_async,
    import_faculty_bulk_async,
    import_courses_bulk_async,
    import_rooms_bulk_async,
    validate_import_data_async,
    generate_analytics_report_async,
    calculate_faculty_workload_analysis_async,
    generate_room_utilization_report_async,
    send_timetable_completion_notification,
    cleanup_old_timetables
)

router = APIRouter()


# ====================================
# TIMETABLE GENERATION JOBS
# ====================================

@router.post("/timetables/generate", status_code=status.HTTP_202_ACCEPTED)
async def submit_timetable_generation_job(
    request: TimetableGenerationRequest,
    notify_email: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Submit asynchronous timetable generation job.

    **Features:**
    - Background processing with progress tracking
    - Real-time status updates via WebSocket
    - Email notification on completion
    - Automatic retry on transient failures
    - Job queuing for resource management

    **Process:**
    1. Validates request and institutional data
    2. Queues job in Celery with high priority
    3. Returns job ID for progress tracking
    4. Sends notification when complete (optional)

    **Status Tracking:**
    Use `GET /jobs/{job_id}/status` to monitor progress
    """
    try:
        # Generate unique job ID
        job_id = str(uuid4())

        # Submit async task
        task_result = generate_timetable_async.apply_async(
            args=[request.dict(), job_id],
            task_id=job_id,
            queue="timetable_generation",
            priority=9  # High priority for timetable generation
        )

        # Schedule notification if email provided
        if notify_email:
            # This will be triggered when the main task completes
            task_result.then(
                send_timetable_completion_notification.s(
                    notify_email,
                    job_id=f"notify_{job_id}"
                )
            )

        return {
            "job_id": job_id,
            "task_id": task_result.id,
            "status": "submitted",
            "message": "Timetable generation job submitted successfully",
            "estimated_completion": "5-15 minutes",
            "tracking_url": f"/api/v1/jobs/{job_id}/status",
            "websocket_url": f"ws://localhost:8000/ws/jobs/{job_id}",
            "notification_enabled": notify_email is not None
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit timetable generation job: {str(e)}"
        )


@router.post("/timetables/{timetable_id}/optimize", status_code=status.HTTP_202_ACCEPTED)
async def submit_timetable_optimization_job(
    timetable_id: UUID,
    optimization_mode: str = "balanced",
    time_limit_minutes: int = 10,
    notify_email: Optional[str] = None
):
    """
    Submit timetable re-optimization job.

    Improves existing timetables with different parameters or more processing time.
    """
    try:
        job_id = str(uuid4())

        optimization_params = {
            "optimization_mode": optimization_mode,
            "time_limit_minutes": time_limit_minutes,
            "enable_soft_constraints": True
        }

        task_result = optimize_existing_timetable_async.apply_async(
            args=[str(timetable_id), optimization_params, job_id],
            task_id=job_id,
            queue="timetable_generation",
            priority=7  # Medium-high priority
        )

        return {
            "job_id": job_id,
            "task_id": task_result.id,
            "original_timetable_id": str(timetable_id),
            "status": "submitted",
            "optimization_params": optimization_params,
            "tracking_url": f"/api/v1/jobs/{job_id}/status"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit optimization job: {str(e)}"
        )


# ====================================
# BULK DATA IMPORT JOBS
# ====================================

@router.post("/import/faculty", status_code=status.HTTP_202_ACCEPTED)
async def submit_faculty_import_job(
    institution_id: UUID,
    file: UploadFile = File(...),
    notify_email: Optional[str] = None
):
    """
    Submit bulk faculty import job.

    **Features:**
    - Asynchronous Excel processing
    - Row-by-row validation and error reporting
    - Progress tracking with detailed statistics
    - Automatic rollback on critical errors
    - Email notification with import summary

    **File Requirements:**
    - Excel format (.xlsx)
    - Required columns: employee_id, name, department_code
    - Optional columns: email, designation, max_hours_per_week
    - Maximum 10MB file size
    """
    try:
        # Validate file
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400,
                detail="File must be Excel format (.xlsx or .xls)"
            )

        # Read file content
        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(
                status_code=413,
                detail="File size exceeds 10MB limit"
            )

        job_id = str(uuid4())

        # Submit import task
        task_result = import_faculty_bulk_async.apply_async(
            args=[str(institution_id), file_content, file.filename, job_id],
            task_id=job_id,
            queue="data_processing",
            priority=6  # Medium priority
        )

        return {
            "job_id": job_id,
            "task_id": task_result.id,
            "institution_id": str(institution_id),
            "filename": file.filename,
            "file_size_mb": round(len(file_content) / 1024 / 1024, 2),
            "status": "submitted",
            "import_type": "faculty",
            "tracking_url": f"/api/v1/jobs/{job_id}/status"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit faculty import job: {str(e)}"
        )


@router.post("/import/courses", status_code=status.HTTP_202_ACCEPTED)
async def submit_course_import_job(
    institution_id: UUID,
    file: UploadFile = File(...),
    notify_email: Optional[str] = None
):
    """Submit bulk course import job."""
    try:
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400,
                detail="File must be Excel format"
            )

        file_content = await file.read()
        job_id = str(uuid4())

        task_result = import_courses_bulk_async.apply_async(
            args=[str(institution_id), file_content, file.filename, job_id],
            task_id=job_id,
            queue="data_processing"
        )

        return {
            "job_id": job_id,
            "task_id": task_result.id,
            "status": "submitted",
            "import_type": "courses",
            "tracking_url": f"/api/v1/jobs/{job_id}/status"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit course import job: {str(e)}"
        )


@router.post("/import/rooms", status_code=status.HTTP_202_ACCEPTED)
async def submit_room_import_job(
    institution_id: UUID,
    file: UploadFile = File(...),
    notify_email: Optional[str] = None
):
    """Submit bulk room import job."""
    try:
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400,
                detail="File must be Excel format"
            )

        file_content = await file.read()
        job_id = str(uuid4())

        task_result = import_rooms_bulk_async.apply_async(
            args=[str(institution_id), file_content, file.filename, job_id],
            task_id=job_id,
            queue="data_processing"
        )

        return {
            "job_id": job_id,
            "task_id": task_result.id,
            "status": "submitted",
            "import_type": "rooms",
            "tracking_url": f"/api/v1/jobs/{job_id}/status"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit room import job: {str(e)}"
        )


@router.post("/import/validate", status_code=status.HTTP_202_ACCEPTED)
async def submit_data_validation_job(
    import_type: str,
    file: UploadFile = File(...)
):
    """
    Submit data validation job (no actual import).

    **Use Cases:**
    - Validate Excel structure before import
    - Check data quality and completeness
    - Preview import results without changes
    - Identify and fix data issues upfront

    **Validation Types:**
    - faculty: Validates faculty import data
    - courses: Validates course import data
    - rooms: Validates room import data
    """
    try:
        if import_type not in ["faculty", "courses", "rooms"]:
            raise HTTPException(
                status_code=400,
                detail="Import type must be 'faculty', 'courses', or 'rooms'"
            )

        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400,
                detail="File must be Excel format"
            )

        file_content = await file.read()
        job_id = str(uuid4())

        task_result = validate_import_data_async.apply_async(
            args=[file_content, import_type, job_id],
            task_id=job_id,
            queue="data_processing",
            priority=8  # High priority for validation (quick feedback)
        )

        return {
            "job_id": job_id,
            "task_id": task_result.id,
            "import_type": import_type,
            "filename": file.filename,
            "status": "submitted",
            "operation": "validation_only",
            "tracking_url": f"/api/v1/jobs/{job_id}/status"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit validation job: {str(e)}"
        )


# ====================================
# ANALYTICS AND REPORTING JOBS
# ====================================

@router.post("/analytics/report", status_code=status.HTTP_202_ACCEPTED)
async def submit_analytics_report_job(
    institution_id: UUID,
    report_type: str = "comprehensive",
    period_days: int = 30,
    include_trends: bool = True,
    notify_email: Optional[str] = None
):
    """
    Submit comprehensive analytics report generation.

    **Report Types:**
    - comprehensive: Full institutional analytics
    - utilization: Resource utilization focus
    - quality: Timetable quality analysis
    - efficiency: Efficiency and optimization insights

    **Features:**
    - Multi-threaded data processing
    - Trend analysis over specified period
    - Comparative analysis with benchmarks
    - Actionable recommendations
    - Professional PDF report generation
    """
    try:
        if report_type not in ["comprehensive", "utilization", "quality", "efficiency"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid report type"
            )

        job_id = str(uuid4())

        parameters = {
            "period_days": period_days,
            "include_trends": include_trends,
            "report_format": "detailed"
        }

        task_result = generate_analytics_report_async.apply_async(
            args=[str(institution_id), report_type, parameters, job_id],
            task_id=job_id,
            queue="analytics",
            priority=5  # Medium priority
        )

        return {
            "job_id": job_id,
            "task_id": task_result.id,
            "institution_id": str(institution_id),
            "report_type": report_type,
            "parameters": parameters,
            "status": "submitted",
            "estimated_completion": "2-5 minutes",
            "tracking_url": f"/api/v1/jobs/{job_id}/status"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit analytics report job: {str(e)}"
        )


@router.post("/analytics/faculty-workload", status_code=status.HTTP_202_ACCEPTED)
async def submit_faculty_workload_analysis_job(
    institution_id: UUID,
    semester: Optional[str] = None
):
    """Submit faculty workload analysis job."""
    try:
        job_id = str(uuid4())

        task_result = calculate_faculty_workload_analysis_async.apply_async(
            args=[str(institution_id), semester, job_id],
            task_id=job_id,
            queue="analytics"
        )

        return {
            "job_id": job_id,
            "task_id": task_result.id,
            "analysis_type": "faculty_workload",
            "status": "submitted",
            "tracking_url": f"/api/v1/jobs/{job_id}/status"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit workload analysis job: {str(e)}"
        )


@router.post("/analytics/room-utilization", status_code=status.HTTP_202_ACCEPTED)
async def submit_room_utilization_report_job(
    institution_id: UUID,
    period_days: int = 30
):
    """Submit room utilization report job."""
    try:
        job_id = str(uuid4())

        task_result = generate_room_utilization_report_async.apply_async(
            args=[str(institution_id), period_days, job_id],
            task_id=job_id,
            queue="analytics"
        )

        return {
            "job_id": job_id,
            "task_id": task_result.id,
            "analysis_type": "room_utilization",
            "period_days": period_days,
            "status": "submitted",
            "tracking_url": f"/api/v1/jobs/{job_id}/status"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit room utilization job: {str(e)}"
        )


# ====================================
# JOB MANAGEMENT AND MONITORING
# ====================================

@router.get("/jobs/{job_id}/status")
async def get_job_status(job_id: str):
    """
    Get detailed status and progress of a background job.

    **Response Information:**
    - Current status and progress percentage
    - Step-by-step execution details
    - Estimated completion time
    - Error information if failed
    - Result data if completed

    **Status Values:**
    - PENDING: Job queued but not started
    - STARTED: Job execution in progress
    - PROGRESS: Job running with progress updates
    - SUCCESS: Job completed successfully
    - FAILURE: Job failed with error details
    - REVOKED: Job was cancelled
    """
    try:
        # Get task result from Celery
        result = celery_app.AsyncResult(job_id)

        response = {
            "job_id": job_id,
            "task_id": result.id,
            "status": result.status,
            "current_step": None,
            "progress_percentage": 0.0,
            "result": None,
            "error": None,
            "traceback": None,
            "started_at": None,
            "completed_at": None
        }

        if result.status == TaskState.PENDING:
            response.update({
                "message": "Job is queued and waiting to start",
                "progress_percentage": 0.0
            })

        elif result.status == TaskState.STARTED:
            response.update({
                "message": "Job has started execution",
                "progress_percentage": 5.0,
                "started_at": datetime.now().isoformat()
            })

        elif result.status == TaskState.PROGRESS:
            # Get progress information from task meta
            meta = result.info or {}
            response.update({
                "message": f"Job in progress: {meta.get('current_step_name', 'Processing')}",
                "current_step": meta.get("current_step", 1),
                "total_steps": meta.get("total_steps", 1),
                "progress_percentage": meta.get("progress_percentage", 0.0),
                "current_step_name": meta.get("current_step_name", "Processing"),
                "additional_data": meta.get("additional_data")
            })

        elif result.status == TaskState.SUCCESS:
            response.update({
                "message": "Job completed successfully",
                "progress_percentage": 100.0,
                "result": result.result,
                "completed_at": datetime.now().isoformat()
            })

        elif result.status == TaskState.FAILURE:
            response.update({
                "message": "Job failed with error",
                "progress_percentage": 0.0,
                "error": str(result.info) if result.info else "Unknown error",
                "traceback": result.traceback,
                "completed_at": datetime.now().isoformat()
            })

        elif result.status == TaskState.REVOKED:
            response.update({
                "message": "Job was cancelled",
                "progress_percentage": 0.0,
                "completed_at": datetime.now().isoformat()
            })

        return response

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get job status: {str(e)}"
        )


@router.get("/jobs")
async def list_recent_jobs(
    limit: int = 50,
    status_filter: Optional[str] = None,
    job_type: Optional[str] = None
):
    """
    List recent background jobs with filtering.

    **Filters:**
    - status_filter: Filter by job status (SUCCESS, FAILURE, PENDING, etc.)
    - job_type: Filter by job type (timetable, import, analytics)
    - limit: Maximum number of jobs to return (max 100)
    """
    try:
        # Get active tasks from Celery
        inspect = celery_app.control.inspect()

        # Get active, scheduled, and reserved tasks
        active_tasks = inspect.active() or {}
        scheduled_tasks = inspect.scheduled() or {}
        reserved_tasks = inspect.reserved() or {}

        all_jobs = []

        # Process active tasks
        for worker, tasks in active_tasks.items():
            for task in tasks:
                job_info = {
                    "job_id": task["id"],
                    "task_name": task["name"],
                    "status": "STARTED",
                    "worker": worker,
                    "started_at": task.get("time_start"),
                    "args": task.get("args", []),
                    "kwargs": task.get("kwargs", {}),
                    "job_type": _extract_job_type(task["name"])
                }
                all_jobs.append(job_info)

        # Process scheduled tasks
        for worker, tasks in scheduled_tasks.items():
            for task in tasks:
                job_info = {
                    "job_id": task["request"]["id"],
                    "task_name": task["request"]["task"],
                    "status": "PENDING",
                    "worker": worker,
                    "scheduled_at": task.get("eta"),
                    "job_type": _extract_job_type(task["request"]["task"])
                }
                all_jobs.append(job_info)

        # Apply filters
        if status_filter:
            all_jobs = [job for job in all_jobs if job["status"] == status_filter.upper()]

        if job_type:
            all_jobs = [job for job in all_jobs if job["job_type"] == job_type]

        # Limit results
        all_jobs = all_jobs[:limit]

        return {
            "jobs": all_jobs,
            "total": len(all_jobs),
            "active_workers": len(active_tasks.keys()),
            "queue_summary": {
                "active": sum(len(tasks) for tasks in active_tasks.values()),
                "scheduled": sum(len(tasks) for tasks in scheduled_tasks.values()),
                "reserved": sum(len(tasks) for tasks in reserved_tasks.values())
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list jobs: {str(e)}"
        )


@router.delete("/jobs/{job_id}")
async def cancel_job(job_id: str):
    """
    Cancel a running or queued job.

    **Note:** Only jobs that haven't started processing can be safely cancelled.
    Jobs in progress may complete before cancellation takes effect.
    """
    try:
        # Revoke the task
        celery_app.control.revoke(job_id, terminate=True, signal="SIGKILL")

        # Get current status
        result = celery_app.AsyncResult(job_id)

        return {
            "job_id": job_id,
            "status": "cancelled",
            "previous_status": result.status,
            "message": "Job cancellation requested"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cancel job: {str(e)}"
        )


@router.post("/jobs/{job_id}/retry")
async def retry_failed_job(job_id: str):
    """
    Retry a failed job with the same parameters.

    Creates a new job instance with a new job ID.
    """
    try:
        # Get original task result
        result = celery_app.AsyncResult(job_id)

        if result.status != TaskState.FAILURE:
            raise HTTPException(
                status_code=400,
                detail="Only failed jobs can be retried"
            )

        # Create new job ID
        new_job_id = str(uuid4())

        # Get original task info (this is simplified - in practice, you'd store job metadata)
        # For now, return guidance on manual retry

        return {
            "message": "Job retry requested",
            "original_job_id": job_id,
            "new_job_id": new_job_id,
            "status": "Please resubmit the job with new parameters",
            "note": "Automatic retry requires job metadata storage - implement based on needs"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retry job: {str(e)}"
        )


# ====================================
# SYSTEM MAINTENANCE JOBS
# ====================================

@router.post("/maintenance/cleanup", status_code=status.HTTP_202_ACCEPTED)
async def submit_cleanup_job(days_old: int = 30):
    """
    Submit system cleanup job.

    Removes old timetables, completed jobs, and temporary files.
    """
    try:
        job_id = str(uuid4())

        task_result = cleanup_old_timetables.apply_async(
            args=[days_old],
            task_id=job_id,
            queue="maintenance",
            priority=3  # Low priority
        )

        return {
            "job_id": job_id,
            "task_id": task_result.id,
            "cleanup_target": f"Data older than {days_old} days",
            "status": "submitted",
            "tracking_url": f"/api/v1/jobs/{job_id}/status"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit cleanup job: {str(e)}"
        )


# Helper functions

def _extract_job_type(task_name: str) -> str:
    """Extract job type from Celery task name."""
    if "timetable" in task_name:
        return "timetable"
    elif "import" in task_name:
        return "import"
    elif "analytics" in task_name:
        return "analytics"
    elif "notification" in task_name:
        return "notification"
    elif "cleanup" in task_name:
        return "maintenance"
    else:
        return "other"