"""
FacultyPreference SQLAlchemy model.
Represents faculty scheduling preferences.
"""
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base import Base


class FacultyPreference(Base):
    """
    FacultyPreference model for faculty scheduling preferences.

    Faculty can specify preferred days, times, or constraints
    for their schedule.
    """
    __tablename__ = "faculty_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False, index=True)
    semester = Column(String(50), nullable=False, index=True)
    preference_type = Column(String(50), nullable=False)
    preference_data = Column(JSONB, nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"))

    # Relationships
    faculty = relationship("Faculty", back_populates="preferences")

    def __repr__(self):
        return f"<FacultyPreference {self.preference_type} for Faculty {self.faculty_id}>"
