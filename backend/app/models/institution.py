"""
Institution SQLAlchemy model.
Represents educational institutions using the system.
"""
from sqlalchemy import Column, String, TIMESTAMP, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base import Base


class Institution(Base):
    """
    Institution model representing educational institutions.

    An institution can be a university, college, or any educational organization
    that uses the timetable scheduling system.
    """
    __tablename__ = "institutions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    location = Column(JSONB)
    contact = Column(JSONB)
    settings = Column(JSONB, server_default=text("'{}'::jsonb"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))
    deleted_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    departments = relationship("Department", back_populates="institution", cascade="all, delete-orphan")
    users = relationship("User", back_populates="institution", cascade="all, delete-orphan")
    faculty = relationship("Faculty", back_populates="institution", cascade="all, delete-orphan")
    student_batches = relationship("StudentBatch", back_populates="institution", cascade="all, delete-orphan")
    courses = relationship("Course", back_populates="institution", cascade="all, delete-orphan")
    classrooms = relationship("Classroom", back_populates="institution", cascade="all, delete-orphan")
    predefined_slots = relationship("PredefinedSlot", back_populates="institution", cascade="all, delete-orphan")
    timetables = relationship("Timetable", back_populates="institution", cascade="all, delete-orphan")
    custom_constraints = relationship("CustomConstraint", back_populates="institution", cascade="all, delete-orphan")
    students = relationship("Student", back_populates="institution", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Institution {self.code}: {self.name}>"
