"""
Faculty SQLAlchemy model.
Represents faculty members who teach courses.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Integer, ARRAY, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class Faculty(Base):
    """
    Faculty model representing teaching staff.

    Faculty members are assigned to departments and teach courses.
    They have workload limits and subject expertise.
    """
    __tablename__ = "faculty"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    designation = Column(String(50))
    max_hours_per_week = Column(Integer, default=18, server_default=text("18"))
    subjects_can_teach = Column(ARRAY(Text), server_default=text("ARRAY[]::TEXT[]"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))
    deleted_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    user = relationship("User", back_populates="faculty_profile")
    institution = relationship("Institution", back_populates="faculty")
    department = relationship("Department", back_populates="faculty")

    # Course relationships
    assigned_courses = relationship("Course", foreign_keys="Course.assigned_faculty_id", back_populates="assigned_faculty")
    sections = relationship("CourseSection", back_populates="assigned_faculty")

    # Timetable relationships
    timetable_entries = relationship("TimetableEntry", foreign_keys="TimetableEntry.faculty_id", back_populates="faculty")
    substituted_entries = relationship("TimetableEntry", foreign_keys="TimetableEntry.original_faculty_id", back_populates="original_faculty")

    # Preference relationship
    preferences = relationship("FacultyPreference", back_populates="faculty", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Faculty {self.employee_id}: {self.name}>"
