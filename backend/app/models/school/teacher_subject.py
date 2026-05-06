from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class SchoolTeacherSubject(Base):
    __tablename__ = "school_teacher_subjects"

    teacher_id = Column(UUID(as_uuid=True),
                        ForeignKey("school_teachers.id", ondelete="CASCADE"),
                        primary_key=True)
    subject_id = Column(UUID(as_uuid=True),
                        ForeignKey("school_subjects.id", ondelete="CASCADE"),
                        primary_key=True, index=True)
