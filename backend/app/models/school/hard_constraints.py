from sqlalchemy import Column, Integer, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class SchoolHardConstraints(Base):
    __tablename__ = "school_hard_constraints"
    __table_args__ = (
        CheckConstraint("max_consecutive_periods BETWEEN 1 AND 10"),
        CheckConstraint("max_periods_per_day_per_teacher BETWEEN 1 AND 15"),
    )

    run_id                          = Column(UUID(as_uuid=True),
                                             ForeignKey("runs.id", ondelete="CASCADE"),
                                             primary_key=True)
    max_consecutive_periods         = Column(Integer, nullable=False)
    max_periods_per_day_per_teacher = Column(Integer, nullable=False)
