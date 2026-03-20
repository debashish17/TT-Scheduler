"""
StudentBatch SQLAlchemy model.
Represents student groups/batches/sections.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Integer, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class StudentBatch(Base):
    """
    StudentBatch model representing groups of students.

    A batch is a group of students who typically have the same schedule.
    Example: "CSE-3rd Year-A" or "ME-2023-Batch"
    """
    __tablename__ = "student_batches"
    __table_args__ = (
        UniqueConstraint('institution_id', 'batch_name', name='uq_batch_institution_name'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_name = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    semester = Column(Integer, nullable=False)
    student_count = Column(Integer, default=0, server_default=text("0"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))
    deleted_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    institution = relationship("Institution", back_populates="student_batches")
    department = relationship("Department", back_populates="student_batches")
    courses = relationship("Course", back_populates="assigned_batch")
    students = relationship("Student", back_populates="batch", cascade="all, delete-orphan")
    timetable_entries = relationship("TimetableEntry", back_populates="batch")

    def __repr__(self):
        return f"<StudentBatch {self.batch_name} (Year {self.year}, Sem {self.semester})>"
