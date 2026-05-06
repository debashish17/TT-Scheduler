from sqlalchemy import Column, Integer, Time, ForeignKey, CheckConstraint, String
from sqlalchemy.dialects.postgresql import UUID, ARRAY

from app.db.base import Base


class CollegeTimeConfig(Base):
    __tablename__ = "college_time_config"
    __table_args__ = (
        CheckConstraint("periods_per_day BETWEEN 1 AND 15"),
        CheckConstraint("period_duration_minutes BETWEEN 15 AND 180"),
        CheckConstraint("semester BETWEEN 1 AND 8"),
    )

    run_id                   = Column(UUID(as_uuid=True),
                                      ForeignKey("runs.id", ondelete="CASCADE"),
                                      primary_key=True)
    working_days             = Column(ARRAY(String), nullable=False)
    periods_per_day          = Column(Integer, nullable=False)
    period_duration_minutes  = Column(Integer, nullable=False)
    start_time               = Column(Time, nullable=False)
    semester                 = Column(Integer, nullable=False)
