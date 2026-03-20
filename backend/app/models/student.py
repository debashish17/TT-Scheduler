"""
Student SQLAlchemy model.
Represents student records.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class Student(Base):
    """
    Student model representing enrolled students.

    Students belong to batches and view timetables.
    """
    __tablename__ = "students"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    batch_id = Column(UUID(as_uuid=True), ForeignKey("student_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))
    deleted_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    user = relationship("User", back_populates="student_profile")
    institution = relationship("Institution", back_populates="students")
    batch = relationship("StudentBatch", back_populates="students")

    def __repr__(self):
        return f"<Student {self.student_id}: {self.name}>"
