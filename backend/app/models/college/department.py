from sqlalchemy import Column, String, ForeignKey, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class CollegeDepartment(Base):
    __tablename__ = "college_departments"
    __table_args__ = (UniqueConstraint("run_id", "code"),)

    id      = Column(UUID(as_uuid=True), primary_key=True,
                     server_default=text("uuid_generate_v4()"))
    run_id  = Column(UUID(as_uuid=True),
                     ForeignKey("runs.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    code    = Column(String(20), nullable=False)
    name    = Column(String(255), nullable=False)
