"""
Timetable SQLAlchemy model.
Represents generated timetable versions.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Integer, Enum, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


class TimetableStatus(str, enum.Enum):
    """Timetable status enumeration."""
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class Timetable(Base):
    """
    Timetable model representing generated schedules.

    A timetable contains all class assignments for a semester.
    """
    __tablename__ = "timetables"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    semester = Column(String(50), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    status = Column(Enum(TimetableStatus, name="timetable_status", create_type=False), nullable=False, server_default=text("'draft'"), index=True)
    metrics = Column(JSONB, server_default=text("'{}'::jsonb"))
    generation_params = Column(JSONB, server_default=text("'{}'::jsonb"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(TIMESTAMP, nullable=True)
    version = Column(Integer, default=1, server_default=text("1"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))

    # Relationships
    institution = relationship("Institution", back_populates="timetables")
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_timetables")
    approver = relationship("User", foreign_keys=[approved_by], back_populates="approved_timetables")
    entries = relationship("TimetableEntry", back_populates="timetable", cascade="all, delete-orphan")
    change_requests = relationship("ChangeRequest", back_populates="timetable")

    def __repr__(self):
        return f"<Timetable {self.name} ({self.semester}) - {self.status.value}>"
