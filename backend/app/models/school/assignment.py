from sqlalchemy import Column, Integer, ForeignKey, CheckConstraint, Index, text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class SchoolAssignment(Base):
    __tablename__ = "school_assignments"
    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6"),
        CheckConstraint("period BETWEEN 1 AND 15"),
        Index("uq_school_room_slot",    "run_id", "day_of_week", "period", "room_id",    unique=True),
        Index("uq_school_teacher_slot", "run_id", "day_of_week", "period", "teacher_id", unique=True),
        Index("uq_school_class_slot",   "run_id", "day_of_week", "period", "class_id",   unique=True),
        Index("idx_school_assignments_run_day", "run_id", "day_of_week"),
    )

    id           = Column(UUID(as_uuid=True), primary_key=True,
                          server_default=text("uuid_generate_v4()"))
    run_id       = Column(UUID(as_uuid=True),
                          ForeignKey("runs.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    day_of_week  = Column(Integer, nullable=False)
    period       = Column(Integer, nullable=False)
    subject_id   = Column(UUID(as_uuid=True),
                          ForeignKey("school_subjects.id", ondelete="CASCADE"),
                          nullable=False)
    teacher_id   = Column(UUID(as_uuid=True),
                          ForeignKey("school_teachers.id", ondelete="CASCADE"),
                          nullable=False)
    class_id     = Column(UUID(as_uuid=True),
                          ForeignKey("school_classes.id", ondelete="CASCADE"),
                          nullable=False)
    room_id      = Column(UUID(as_uuid=True),
                          ForeignKey("school_rooms.id", ondelete="CASCADE"),
                          nullable=False)
