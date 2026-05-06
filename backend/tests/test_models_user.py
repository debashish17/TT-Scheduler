"""Tests that the User model is structured correctly."""
from sqlalchemy import inspect


def test_user_model_columns():
    from app.models.shared.user import User
    cols = {c.name for c in inspect(User).columns}
    assert cols == {"id", "email", "full_name", "created_at", "updated_at"}


def test_user_model_tablename():
    from app.models.shared.user import User
    assert User.__tablename__ == "users"


def test_user_email_is_unique():
    from app.models.shared.user import User
    email_col = inspect(User).columns["email"]
    assert email_col.unique is True
    assert email_col.nullable is False
