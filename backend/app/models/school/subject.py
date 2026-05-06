from sqlalchemy import (
    Column, String, Integer, ForeignKey, UniqueConstraint, CheckConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class SchoolSubject(Base):
    __tablename__ = "school_subjects"
    __table_args__ = (
        UniqueConstraint("run_id", "code"),
        CheckConstraint("periods_per_week BETWEEN 1 AND 15"),
    )

    id                = Column(UUID(as_uuid=True), primary_key=True,
                               server_default=text("uuid_generate_v4()"))
    run_id            = Column(UUID(as_uuid=True),
                               ForeignKey("runs.id", ondelete="CASCADE"),
                               nullable=False, index=True)
    name              = Column(String(255), nullable=False)
    code              = Column(String(50), nullable=False)
    periods_per_week  = Column(Integer, nullable=False)
