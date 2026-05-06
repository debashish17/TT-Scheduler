"""
Separate SQLAlchemy declarative base for models_new.

This base is intentionally isolated from app.db.base so that models_new models
do not collide with legacy models that share the same __tablename__ values.
Task 23 will delete the legacy models and merge this back into app.db.base.
"""
from sqlalchemy.orm import declarative_base

Base = declarative_base()
