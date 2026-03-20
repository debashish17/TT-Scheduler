"""
SQLAlchemy declarative base for all ORM models.
"""
from sqlalchemy.orm import declarative_base

# Create declarative base class
Base = declarative_base()

# Import all models here so Alembic can see them
# These imports ensure models are registered with SQLAlchemy metadata
from app.models.institution import Institution
from app.models.department import Department
from app.models.user import User
from app.models.faculty import Faculty
from app.models.student import Student
from app.models.batch import StudentBatch
from app.models.course import Course
from app.models.course_section import CourseSection
from app.models.room import Classroom
from app.models.slot import PredefinedSlot
from app.models.timetable import Timetable
from app.models.timetable_entry import TimetableEntry
from app.models.constraint import CustomConstraint
from app.models.preference import FacultyPreference
from app.models.change_request import ChangeRequest
from app.models.notification import Notification
from app.models.audit_log import AuditLog
from app.models.issue_report import IssueReport
