"""
SQLAlchemy models package.
Imports all ORM models for the application.
"""
from app.db.base import Base

# Core models
from app.models.institution import Institution
from app.models.department import Department
from app.models.user import User, UserRole

# People models
from app.models.faculty import Faculty
from app.models.student import Student

# Academic models
from app.models.batch import StudentBatch
from app.models.course import Course, CourseType
from app.models.course_section import CourseSection

# Resource models
from app.models.room import Classroom, RoomType
from app.models.slot import PredefinedSlot, SlotType

# Timetable models
from app.models.timetable import Timetable, TimetableStatus
from app.models.timetable_entry import TimetableEntry, EntryStatus

# Constraint and preference models
from app.models.constraint import CustomConstraint
from app.models.preference import FacultyPreference

# Workflow models
from app.models.change_request import ChangeRequest, RequestType, RequestStatus

# System models
from app.models.notification import Notification
from app.models.audit_log import AuditLog
from app.models.issue_report import IssueReport, IssueCategory, IssueStatus

__all__ = [
    "Base",
    # Core
    "Institution",
    "Department",
    "User",
    "UserRole",
    # People
    "Faculty",
    "Student",
    # Academic
    "StudentBatch",
    "Course",
    "CourseType",
    "CourseSection",
    # Resources
    "Classroom",
    "RoomType",
    "PredefinedSlot",
    "SlotType",
    # Timetable
    "Timetable",
    "TimetableStatus",
    "TimetableEntry",
    "EntryStatus",
    # Constraints
    "CustomConstraint",
    "FacultyPreference",
    # Workflow
    "ChangeRequest",
    "RequestType",
    "RequestStatus",
    # System
    "Notification",
    "AuditLog",
    "IssueReport",
    "IssueCategory",
    "IssueStatus",
]
