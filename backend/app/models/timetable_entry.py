"""
TimetableEntry SQLAlchemy model.
Represents individual class assignments in a timetable.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Integer, Boolean, Enum, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


class EntryStatus(str, enum.Enum):
    """Timetable entry status enumeration."""
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"


class TimetableEntry(Base):
    """
    TimetableEntry model representing individual class assignments.

    Each entry represents one class session in the timetable.
    """
    __tablename__ = "timetable_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    timetable_id = Column(UUID(as_uuid=True), ForeignKey("timetables.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id = Column(UUID(as_uuid=True), ForeignKey("course_sections.id", ondelete="SET NULL"), nullable=True)
    slot_id = Column(UUID(as_uuid=True), ForeignKey("predefined_slots.id", ondelete="CASCADE"), nullable=False, index=True)
    faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False, index=True)
    classroom_id = Column(UUID(as_uuid=True), ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("student_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False, index=True)  # 0=Monday, 6=Sunday
    time_slot = Column(String(20), nullable=False)
    status = Column(Enum(EntryStatus, name="entry_status", create_type=False), nullable=False, server_default=text("'scheduled'"))
    is_substitute = Column(Boolean, default=False, server_default=text("FALSE"))
    original_faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))

    # Relationships
    timetable = relationship("Timetable", back_populates="entries")
    course = relationship("Course", back_populates="timetable_entries")
    section = relationship("CourseSection", back_populates="timetable_entries")
    slot = relationship("PredefinedSlot", back_populates="timetable_entries")
    faculty = relationship("Faculty", foreign_keys=[faculty_id], back_populates="timetable_entries")
    original_faculty = relationship("Faculty", foreign_keys=[original_faculty_id], back_populates="substituted_entries")
    classroom = relationship("Classroom", back_populates="timetable_entries")
    batch = relationship("StudentBatch", back_populates="timetable_entries")
    issue_reports = relationship("IssueReport", back_populates="related_entry")

    def __repr__(self):
        return f"<TimetableEntry {self.course_id} on Day {self.day_of_week} at {self.time_slot}>"
