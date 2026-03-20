"""
Notification SQLAlchemy model.
Represents system notifications to users.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Boolean, Enum, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.user import UserRole


class Notification(Base):
    """
    Notification model for system notifications.

    Sends alerts to users about timetable changes, approvals, etc.
    """
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_type = Column(Enum(UserRole, name="user_role", create_type=False), nullable=False)
    notification_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    related_id = Column(UUID(as_uuid=True), nullable=True)
    is_read = Column(Boolean, default=False, server_default=text("FALSE"), index=True)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"), index=True)

    # Relationships
    user = relationship("User", back_populates="notifications")

    def __repr__(self):
        return f"<Notification for {self.user_id}: {self.title} ({'read' if self.is_read else 'unread'})>"
