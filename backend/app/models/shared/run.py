"""Run — the unit of work. One row per successful generation."""
import enum
from sqlalchemy import (
    Column, String, TIMESTAMP, ForeignKey, Enum, Numeric, text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base

# Import User so that the 'users' table is registered in the same metadata
# as Run, allowing FK resolution in tests and Alembic without a live DB.
from app.models.shared.user import User  # noqa: F401


class RunKind(str, enum.Enum):
    SCHOOL = "school"
    COLLEGE = "college"


class RunStatus(str, enum.Enum):
    OPTIMAL = "optimal"
    FEASIBLE = "feasible"
    FAILED = "failed"


class Run(Base):
    __tablename__ = "runs"

    id                  = Column(UUID(as_uuid=True), primary_key=True,
                                 server_default=text("uuid_generate_v4()"))
    user_id             = Column(UUID(as_uuid=True),
                                 ForeignKey("users.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    kind                = Column(Enum(RunKind, name="run_kind",
                                      values_callable=lambda x: [e.value for e in x]),
                                 nullable=False, index=True)
    parent_run_id       = Column(UUID(as_uuid=True),
                                 ForeignKey("runs.id", ondelete="SET NULL"),
                                 nullable=True, index=True)
    name                = Column(String(255), nullable=False)
    status              = Column(Enum(RunStatus, name="run_status",
                                      values_callable=lambda x: [e.value for e in x]),
                                 nullable=False)
    solver              = Column(String(50), nullable=False)
    solve_time_seconds  = Column(Numeric(8, 3), nullable=True)
    created_at          = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at          = Column(TIMESTAMP, server_default=text("NOW()"))
