"""
Department SQLAlchemy model.
Represents academic departments within institutions.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class Department(Base):
    """
    Department model representing academic departments.

    Departments are organizational units within institutions
    (e.g., Computer Science, Mechanical Engineering).
    """
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint('institution_id', 'code', name='uq_department_institution_code'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(10), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))
    deleted_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    institution = relationship("Institution", back_populates="departments")
    users = relationship("User", back_populates="department")
    faculty = relationship("Faculty", back_populates="department", cascade="all, delete-orphan")
    student_batches = relationship("StudentBatch", back_populates="department", cascade="all, delete-orphan")
    courses = relationship("Course", back_populates="department", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Department {self.code}: {self.name}>"
