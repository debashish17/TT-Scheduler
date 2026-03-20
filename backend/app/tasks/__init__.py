"""
Celery tasks module initialization.
Imports all task modules for Celery discovery.
"""
from app.tasks.timetable_generation import (
    generate_timetable_async,
    optimize_existing_timetable_async,
    cleanup_old_timetables
)

from app.tasks.data_import import (
    import_faculty_bulk_async,
    import_courses_bulk_async,
    import_rooms_bulk_async,
    validate_import_data_async
)

from app.tasks.analytics import (
    generate_analytics_report_async,
    calculate_faculty_workload_analysis_async,
    generate_room_utilization_report_async
)

from app.tasks.notifications import (
    send_timetable_completion_notification,
    send_import_completion_notification,
    send_system_alert,
    send_weekly_analytics_digest
)

__all__ = [
    # Timetable generation tasks
    "generate_timetable_async",
    "optimize_existing_timetable_async",
    "cleanup_old_timetables",

    # Data import tasks
    "import_faculty_bulk_async",
    "import_courses_bulk_async",
    "import_rooms_bulk_async",
    "validate_import_data_async",

    # Analytics tasks
    "generate_analytics_report_async",
    "calculate_faculty_workload_analysis_async",
    "generate_room_utilization_report_async",

    # Notification tasks
    "send_timetable_completion_notification",
    "send_import_completion_notification",
    "send_system_alert",
    "send_weekly_analytics_digest",
]