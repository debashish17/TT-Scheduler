"""
Course SQLAlchemy model.
Represents academic courses offered.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Integer, Enum, ARRAY, Text, DECIMAL, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


class CourseType(str, enum.Enum):
    """Course type enumeration."""
    THEORY = "theory"
    LAB = "lab"
    TUTORIAL = "tutorial"


class Course(Base):
    """
    Course model representing academic courses.

    Courses are taught by faculty to student batches.
    They can be theory, lab, or tutorial type.
    """
    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint('institution_id', 'code', name='uq_course_institution_code'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(20), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    course_type = Column(Enum(CourseType, name="course_type", create_type=False), nullable=False, server_default=text("'theory'"))
    theory_credits = Column(DECIMAL(3, 1), default=0, server_default=text("0"))
    lab_credits = Column(DECIMAL(3, 1), default=0, server_default=text("0"))
    hours_per_week = Column(Integer, nullable=False)
    assigned_faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_batch_id = Column(UUID(as_uuid=True), ForeignKey("student_batches.id", ondelete="SET NULL"), nullable=True, index=True)
    expected_students = Column(Integer, default=0, server_default=text("0"))
    required_features = Column(ARRAY(Text), server_default=text("ARRAY[]::TEXT[]"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))
    deleted_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    institution = relationship("Institution", back_populates="courses")
    department = relationship("Department", back_populates="courses")
    assigned_faculty = relationship("Faculty", foreign_keys=[assigned_faculty_id], back_populates="assigned_courses")
    assigned_batch = relationship("StudentBatch", back_populates="courses")
    sections = relationship("CourseSection", back_populates="course", cascade="all, delete-orphan")
    timetable_entries = relationship("TimetableEntry", back_populates="course")

    def __repr__(self):
        return f"<Course {self.code}: {self.name} ({self.course_type.value})>"
