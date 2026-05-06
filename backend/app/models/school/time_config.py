from sqlalchemy import Column, Integer, Time, ForeignKey, CheckConstraint, String
from sqlalchemy.dialects.postgresql import UUID, ARRAY

from app.db.base import Base


class SchoolTimeConfig(Base):
    __tablename__ = "school_time_config"
    __table_args__ = (
        CheckConstraint("periods_per_day BETWEEN 1 AND 15"),
        CheckConstraint("period_duration_minutes BETWEEN 15 AND 180"),
    )

    run_id                   = Column(UUID(as_uuid=True),
                                      ForeignKey("runs.id", ondelete="CASCADE"),
                                      primary_key=True)
    working_days             = Column(ARRAY(String), nullable=False)
    periods_per_day          = Column(Integer, nullable=False)
    period_duration_minutes  = Column(Integer, nullable=False)
    start_time               = Column(Time, nullable=False)
    lunch_after_period       = Column(Integer, nullable=False, default=0)
    lunch_duration_minutes   = Column(Integer, nullable=False, default=0)
