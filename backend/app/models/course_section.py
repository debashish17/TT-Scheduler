"""
CourseSection SQLAlchemy model.
Represents multiple sections of the same course.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Integer, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class CourseSection(Base):
    """
    CourseSection model for multi-section courses.

    When a course has more students than room capacity,
    it's split into multiple sections.
    """
    __tablename__ = "course_sections"
    __table_args__ = (
        UniqueConstraint('course_id', 'section_name', name='uq_section_course_name'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    section_name = Column(String(10), nullable=False)
    max_students = Column(Integer, nullable=False)
    assigned_faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))

    # Relationships
    course = relationship("Course", back_populates="sections")
    assigned_faculty = relationship("Faculty", back_populates="sections")
    timetable_entries = relationship("TimetableEntry", back_populates="section")

    def __repr__(self):
        return f"<CourseSection {self.section_name} of Course {self.course_id}>"
