"""Soft constraints — same shape for both school and college."""
from sqlalchemy import Column, String, Integer, ForeignKey, CheckConstraint, text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class RunSoftConstraint(Base):
    __tablename__ = "run_soft_constraints"
    __table_args__ = (CheckConstraint("weight BETWEEN 1 AND 10"),)

    id          = Column(UUID(as_uuid=True), primary_key=True,
                         server_default=text("uuid_generate_v4()"))
    run_id      = Column(UUID(as_uuid=True),
                         ForeignKey("runs.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    type        = Column(String(50), nullable=False)
    target      = Column(String(255), nullable=False)
    when_value  = Column(String(50), nullable=True)
    weight      = Column(Integer, nullable=False)
