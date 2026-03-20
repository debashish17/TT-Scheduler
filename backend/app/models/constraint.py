"""
CustomConstraint SQLAlchemy model.
Represents institution-specific constraints.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Integer, Boolean, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base import Base


class CustomConstraint(Base):
    """
    CustomConstraint model for institution-specific rules.

    Allows institutions to define custom scheduling constraints
    beyond the 8 hard constraints.
    """
    __tablename__ = "custom_constraints"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    constraint_type = Column(String(50), nullable=False)
    parameters = Column(JSONB, server_default=text("'{}'::jsonb"))
    priority = Column(Integer, default=1, server_default=text("1"))
    is_active = Column(Boolean, default=True, server_default=text("TRUE"), index=True)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))

    # Relationships
    institution = relationship("Institution", back_populates="custom_constraints")

    def __repr__(self):
        return f"<CustomConstraint {self.name} (Priority: {self.priority})>"
