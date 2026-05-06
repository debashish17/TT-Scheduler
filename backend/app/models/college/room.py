from sqlalchemy import (
    Column, String, Integer, ForeignKey, UniqueConstraint, CheckConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class CollegeRoom(Base):
    __tablename__ = "college_rooms"
    __table_args__ = (
        UniqueConstraint("run_id", "name"),
        CheckConstraint("capacity BETWEEN 1 AND 1000"),
    )

    id         = Column(UUID(as_uuid=True), primary_key=True,
                        server_default=text("uuid_generate_v4()"))
    run_id     = Column(UUID(as_uuid=True),
                        ForeignKey("runs.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    name       = Column(String(100), nullable=False)
    capacity   = Column(Integer, nullable=False)
    room_type  = Column(String(50), nullable=False, default="classroom", index=True)
