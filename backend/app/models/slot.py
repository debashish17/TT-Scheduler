"""
PredefinedSlot SQLAlchemy model.
Represents time slot definitions.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Integer, Enum, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


class SlotType(str, enum.Enum):
    """Slot type enumeration."""
    THEORY = "theory"
    LAB = "lab"


class PredefinedSlot(Base):
    """
    PredefinedSlot model representing time slots.

    Slots define when classes can be scheduled (e.g., Mon 9:00-10:00).
    """
    __tablename__ = "predefined_slots"
    __table_args__ = (
        UniqueConstraint('institution_id', 'slot_code', name='uq_slot_institution_code'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    slot_code = Column(String(10), nullable=False)
    slot_type = Column(Enum(SlotType, name="slot_type", create_type=False), nullable=False, server_default=text("'theory'"), index=True)
    timings = Column(JSONB, nullable=False)  # Array of {day, start, end}
    duration_minutes = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))

    # Relationships
    institution = relationship("Institution", back_populates="predefined_slots")
    timetable_entries = relationship("TimetableEntry", back_populates="slot")

    def __repr__(self):
        return f"<PredefinedSlot {self.slot_code} ({self.slot_type.value})>"
