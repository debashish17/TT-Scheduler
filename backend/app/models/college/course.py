from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey,
    UniqueConstraint, CheckConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class CollegeCourse(Base):
    __tablename__ = "college_courses"
    __table_args__ = (
        UniqueConstraint("run_id", "code"),
        CheckConstraint("year BETWEEN 1 AND 5"),
        CheckConstraint("credits BETWEEN 1 AND 6"),
        CheckConstraint("lectures_per_week BETWEEN 1 AND 10"),
        CheckConstraint("enrolled_students BETWEEN 1 AND 1000"),
    )

    id                          = Column(UUID(as_uuid=True), primary_key=True,
                                         server_default=text("uuid_generate_v4()"))
    run_id                      = Column(UUID(as_uuid=True),
                                         ForeignKey("runs.id", ondelete="CASCADE"),
                                         nullable=False, index=True)
    department_id               = Column(UUID(as_uuid=True),
                                         ForeignKey("college_departments.id", ondelete="CASCADE"),
                                         nullable=False, index=True)
    code                        = Column(String(50), nullable=False)
    name                        = Column(String(255), nullable=False)
    year                        = Column(Integer, nullable=False)
    credits                     = Column(Integer, nullable=False)
    lectures_per_week           = Column(Integer, nullable=False)
    has_lab                     = Column(Boolean, nullable=False, default=False)
    required_lecture_room_type  = Column(String(50), nullable=False, default="classroom")
    required_lab_room_type      = Column(String(50), nullable=True)
    enrolled_students           = Column(Integer, nullable=False)
    is_elective                 = Column(Boolean, nullable=False, default=False)
