from sqlalchemy import (
    Column, String, Integer, ForeignKey, UniqueConstraint, CheckConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class CollegeFaculty(Base):
    __tablename__ = "college_faculty"
    __table_args__ = (
        UniqueConstraint("run_id", "code"),
        CheckConstraint("max_hours_per_week BETWEEN 1 AND 40"),
    )

    id                  = Column(UUID(as_uuid=True), primary_key=True,
                                 server_default=text("uuid_generate_v4()"))
    run_id              = Column(UUID(as_uuid=True),
                                 ForeignKey("runs.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    department_id       = Column(UUID(as_uuid=True),
                                 ForeignKey("college_departments.id", ondelete="SET NULL"),
                                 nullable=True)
    code                = Column(String(50), nullable=False)
    name                = Column(String(255), nullable=False)
    max_hours_per_week  = Column(Integer, nullable=False)
