"""
User SQLAlchemy model.
Represents system users with different roles.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Boolean, Enum, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


class UserRole(str, enum.Enum):
    """User role enumeration."""
    SUPER_ADMIN = "super_admin"
    DEPT_ADMIN = "dept_admin"
    FACULTY = "faculty"
    STUDENT = "student"


class User(Base):
    """
    User model representing system users.

    Users can be super admins, department admins, faculty members, or students.
    """
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for now (no auth yet)
    role = Column(Enum(UserRole, name="user_role", create_type=False), nullable=False, default=UserRole.SUPER_ADMIN, index=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, server_default=text("TRUE"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))
    deleted_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    institution = relationship("Institution", back_populates="users")
    department = relationship("Department", back_populates="users")
    faculty_profile = relationship("Faculty", back_populates="user", uselist=False)
    student_profile = relationship("Student", back_populates="user", uselist=False)

    # Timetable relationships
    created_timetables = relationship("Timetable", foreign_keys="Timetable.created_by", back_populates="creator")
    approved_timetables = relationship("Timetable", foreign_keys="Timetable.approved_by", back_populates="approver")

    # Request relationships
    change_requests = relationship("ChangeRequest", foreign_keys="ChangeRequest.requested_by", back_populates="requester")
    reviewed_requests = relationship("ChangeRequest", foreign_keys="ChangeRequest.reviewed_by", back_populates="reviewer")

    # Other relationships
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    reported_issues = relationship("IssueReport", foreign_keys="IssueReport.reported_by", back_populates="reporter")
    assigned_issues = relationship("IssueReport", foreign_keys="IssueReport.assigned_to", back_populates="assignee")

    def __repr__(self):
        return f"<User {self.email} ({self.role.value})>"
