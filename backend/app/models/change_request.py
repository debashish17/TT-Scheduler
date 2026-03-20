"""
ChangeRequest SQLAlchemy model.
Represents requests for timetable modifications.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Date, Text, Enum, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


class RequestType(str, enum.Enum):
    """Change request type enumeration."""
    CANCEL = "cancel"
    SWAP = "swap"
    LEAVE = "leave"
    BLOCK_SLOT = "block_slot"


class RequestStatus(str, enum.Enum):
    """Change request status enumeration."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ChangeRequest(Base):
    """
    ChangeRequest model for timetable modification requests.

    Faculty and admins can request changes to the timetable.
    """
    __tablename__ = "change_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    request_type = Column(Enum(RequestType, name="request_type", create_type=False), nullable=False, index=True)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    timetable_id = Column(UUID(as_uuid=True), ForeignKey("timetables.id", ondelete="CASCADE"), nullable=True, index=True)
    request_data = Column(JSONB, nullable=False)
    reason = Column(Text)
    date_from = Column(Date)
    date_to = Column(Date)
    status = Column(Enum(RequestStatus, name="request_status", create_type=False), nullable=False, server_default=text("'pending'"), index=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_comment = Column(Text)
    reviewed_at = Column(TIMESTAMP, nullable=True)
    conflicts = Column(JSONB, server_default=text("'[]'::jsonb"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))

    # Relationships
    requester = relationship("User", foreign_keys=[requested_by], back_populates="change_requests")
    reviewer = relationship("User", foreign_keys=[reviewed_by], back_populates="reviewed_requests")
    timetable = relationship("Timetable", back_populates="change_requests")

    def __repr__(self):
        return f"<ChangeRequest {self.request_type.value} by {self.requested_by} ({self.status.value})>"
