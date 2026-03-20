"""
Celery application configuration for background tasks.
Handles asynchronous timetable generation and other long-running operations.
"""
from celery import Celery
from celery.signals import worker_ready, worker_shutdown
from kombu import Queue
import os
import logging

from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Celery app
celery_app = Celery(
    "timetable_scheduler",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.timetable_generation",
        "app.tasks.data_import",
        "app.tasks.analytics",
        "app.tasks.notifications"
    ]
)

# Celery configuration
celery_app.conf.update(
    # Task routing and queues
    task_routes={
        "app.tasks.timetable_generation.*": {"queue": "timetable_generation"},
        "app.tasks.data_import.*": {"queue": "data_processing"},
        "app.tasks.analytics.*": {"queue": "analytics"},
        "app.tasks.notifications.*": {"queue": "notifications"},
    },

    # Define queues
    task_queues=(
        Queue("timetable_generation", routing_key="timetable_generation"),
        Queue("data_processing", routing_key="data_processing"),
        Queue("analytics", routing_key="analytics"),
        Queue("notifications", routing_key="notifications"),
        Queue("celery", routing_key="celery"),  # Default queue
    ),

    # Task execution settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Result backend settings
    result_expires=7200,  # 2 hours
    result_persistent=True,

    # Task execution limits
    task_time_limit=3600,  # 1 hour hard limit
    task_soft_time_limit=3300,  # 55 minutes soft limit
    worker_prefetch_multiplier=1,  # Process one task at a time

    # Retry settings
    task_acks_late=True,
    worker_disable_rate_limits=False,

    # Monitoring and visibility
    task_track_started=True,
    task_send_sent_event=True,

    # Worker settings
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks
    worker_concurrency=4,  # Number of concurrent processes

    # Security
    task_always_eager=False,  # Set to True for testing without Redis
    task_eager_propagates=True,
)

# Queue priority configuration
celery_app.conf.task_default_queue = 'celery'
celery_app.conf.task_default_exchange = 'celery'
celery_app.conf.task_default_exchange_type = 'direct'
celery_app.conf.task_default_routing_key = 'celery'

# Enable events for monitoring
celery_app.conf.worker_send_task_events = True
celery_app.conf.task_send_sent_event = True


@worker_ready.connect
def worker_ready_handler(sender=None, **kwargs):
    """Handler called when worker is ready."""
    logger.info("Celery worker is ready and waiting for tasks")


@worker_shutdown.connect
def worker_shutdown_handler(sender=None, **kwargs):
    """Handler called when worker shuts down."""
    logger.info("Celery worker is shutting down")


# Task state constants
class TaskState:
    PENDING = "PENDING"
    RECEIVED = "RECEIVED"
    STARTED = "STARTED"
    PROGRESS = "PROGRESS"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    REVOKED = "REVOKED"
    RETRY = "RETRY"


# Progress tracking utilities
class ProgressTracker:
    """Utility class for tracking task progress."""

    def __init__(self, task, total_steps):
        self.task = task
        self.total_steps = total_steps
        self.current_step = 0

    def update(self, step_name, additional_data=None):
        """Update task progress."""
        self.current_step += 1
        progress = (self.current_step / self.total_steps) * 100

        meta = {
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "progress_percentage": round(progress, 2),
            "current_step_name": step_name,
            "status": "processing"
        }

        if additional_data:
            meta.update(additional_data)

        self.task.update_state(
            state=TaskState.PROGRESS,
            meta=meta
        )

        logger.info(f"Task progress: {progress:.1f}% - {step_name}")

    def complete(self, result_data):
        """Mark task as completed."""
        meta = {
            "current_step": self.total_steps,
            "total_steps": self.total_steps,
            "progress_percentage": 100.0,
            "current_step_name": "Completed",
            "status": "completed",
            "result": result_data
        }

        self.task.update_state(
            state=TaskState.SUCCESS,
            meta=meta
        )

        logger.info("Task completed successfully")


# Error handling utilities
def handle_task_error(task, error, step_name="Unknown"):
    """Handle task errors with proper logging and state updates."""
    error_msg = str(error)
    logger.error(f"Task failed at step '{step_name}': {error_msg}")

    meta = {
        "error": error_msg,
        "failed_step": step_name,
        "status": "failed"
    }

    task.update_state(
        state=TaskState.FAILURE,
        meta=meta
    )


# Task retry configuration
RETRY_CONFIG = {
    "autoretry_for": (Exception,),
    "retry_kwargs": {"max_retries": 3, "countdown": 60},
    "retry_backoff": True,
    "retry_jitter": True,
}


if __name__ == "__main__":
    # For development/testing
    celery_app.start()