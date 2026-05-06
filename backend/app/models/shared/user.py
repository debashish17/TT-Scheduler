"""User model — auth profile mirror of Supabase auth.users."""
from sqlalchemy import Column, String, TIMESTAMP, text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id          = Column(UUID(as_uuid=True), primary_key=True)
    email       = Column(String(255), unique=True, nullable=False, index=True)
    full_name   = Column(String(255), nullable=True)
    created_at  = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at  = Column(TIMESTAMP, server_default=text("NOW()"))
