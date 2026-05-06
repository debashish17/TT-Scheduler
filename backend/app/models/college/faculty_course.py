from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class CollegeFacultyCourse(Base):
    __tablename__ = "college_faculty_courses"

    faculty_id = Column(UUID(as_uuid=True),
                        ForeignKey("college_faculty.id", ondelete="CASCADE"),
                        primary_key=True)
    course_id  = Column(UUID(as_uuid=True),
                        ForeignKey("college_courses.id", ondelete="CASCADE"),
                        primary_key=True, index=True)
