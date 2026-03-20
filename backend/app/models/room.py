"""
Classroom SQLAlchemy model.
Represents physical classrooms/rooms.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Integer, Enum, ARRAY, Text, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


class RoomType(str, enum.Enum):
    """Room type enumeration."""
    LECTURE_HALL = "lecture_hall"
    COMPUTER_LAB = "computer_lab"
    PHYSICS_LAB = "physics_lab"
    CHEMISTRY_LAB = "chemistry_lab"
    SEMINAR_ROOM = "seminar_room"
    AUDITORIUM = "auditorium"
    TUTORIAL_ROOM = "tutorial_room"


class Classroom(Base):
    """
    Classroom model representing physical rooms.

    Classrooms have capacity limits and features (projector, computers, etc.).
    """
    __tablename__ = "classrooms"
    __table_args__ = (
        UniqueConstraint('institution_id', 'room_number', name='uq_classroom_institution_number'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    room_number = Column(String(20), nullable=False)
    building = Column(String(100))
    capacity = Column(Integer, nullable=False, index=True)
    room_type = Column(Enum(RoomType, name="room_type", create_type=False), nullable=False, server_default=text("'lecture_hall'"))
    features = Column(ARRAY(Text), server_default=text("ARRAY[]::TEXT[]"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))
    deleted_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    institution = relationship("Institution", back_populates="classrooms")
    timetable_entries = relationship("TimetableEntry", back_populates="classroom")

    def __repr__(self):
        return f"<Classroom {self.room_number} ({self.capacity} capacity)>"
