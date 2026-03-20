"""
IssueReport SQLAlchemy model.
Represents issues and problems reported by users.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Text, Enum, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


class IssueCategory(str, enum.Enum):
    """Issue category enumeration."""
    ROOM_LOCKED = "room_locked"
    FACULTY_ABSENT = "faculty_absent"
    EQUIPMENT_ISSUE = "equipment_issue"
    TIMETABLE_ERROR = "timetable_error"
    OTHER = "other"


class IssueStatus(str, enum.Enum):
    """Issue status enumeration."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class IssueReport(Base):
    """
    IssueReport model for tracking problems.

    Users can report issues with classes, rooms, or the timetable.
    """
    __tablename__ = "issue_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    reported_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(Enum(IssueCategory, name="issue_category", create_type=False), nullable=False, index=True)
    description = Column(Text, nullable=False)
    related_entry_id = Column(UUID(as_uuid=True), ForeignKey("timetable_entries.id", ondelete="SET NULL"), nullable=True)
    status = Column(Enum(IssueStatus, name="issue_status", create_type=False), nullable=False, server_default=text("'open'"), index=True)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    resolution_notes = Column(Text)
    resolved_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))

    # Relationships
    reporter = relationship("User", foreign_keys=[reported_by], back_populates="reported_issues")
    assignee = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_issues")
    related_entry = relationship("TimetableEntry", back_populates="issue_reports")

    def __repr__(self):
        return f"<IssueReport {self.category.value} by {self.reported_by} ({self.status.value})>"
