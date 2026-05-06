from sqlalchemy import (
    Column, String, Integer, ForeignKey, UniqueConstraint, CheckConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class SchoolClass(Base):
    __tablename__ = "school_classes"
    __table_args__ = (
        UniqueConstraint("run_id", "name"),
        CheckConstraint("size BETWEEN 1 AND 500"),
    )

    id      = Column(UUID(as_uuid=True), primary_key=True,
                     server_default=text("uuid_generate_v4()"))
    run_id  = Column(UUID(as_uuid=True),
                     ForeignKey("runs.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    name    = Column(String(50), nullable=False)
    size    = Column(Integer, nullable=False)
