from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class SchoolSubjectClass(Base):
    __tablename__ = "school_subject_classes"

    subject_id = Column(UUID(as_uuid=True),
                        ForeignKey("school_subjects.id", ondelete="CASCADE"),
                        primary_key=True)
    class_id   = Column(UUID(as_uuid=True),
                        ForeignKey("school_classes.id", ondelete="CASCADE"),
                        primary_key=True, index=True)
