"""
AuditLog SQLAlchemy model.
Represents system activity audit trail.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
from app.db.base import Base


class AuditLog(Base):
    """
    AuditLog model for tracking system actions.

    Maintains a complete audit trail of all significant actions.
    """
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    old_value = Column(JSONB)
    new_value = Column(JSONB)
    ip_address = Column(INET)
    user_agent = Column(Text)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"), index=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    def __repr__(self):
        return f"<AuditLog {self.action} on {self.entity_type} {self.entity_id}>"
