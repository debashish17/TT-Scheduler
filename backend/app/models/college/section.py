from sqlalchemy import Column, String, ForeignKey, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class CollegeSection(Base):
    __tablename__ = "college_sections"
    __table_args__ = (UniqueConstraint("run_id", "course_id", "name"),)

    id         = Column(UUID(as_uuid=True), primary_key=True,
                        server_default=text("uuid_generate_v4()"))
    run_id     = Column(UUID(as_uuid=True),
                        ForeignKey("runs.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    course_id  = Column(UUID(as_uuid=True),
                        ForeignKey("college_courses.id", ondelete="CASCADE"),
                        nullable=False)
    name       = Column(String(50), nullable=False)
