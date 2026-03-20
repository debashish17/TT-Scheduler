"""
Base CRUD service class.
Provides common database operations for all entities.
"""
from typing import Type, TypeVar, Generic, Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from fastapi import HTTPException, status

from app.db.base import Base

# Type variables for generic CRUD operations
ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseService(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base service class with common CRUD operations.

    This class provides:
    - Create, Read, Update, Delete operations
    - Soft delete support
    - Pagination
    - Search and filtering
    - Error handling
    """

    def __init__(self, model: Type[ModelType]):
        """Initialize with SQLAlchemy model class."""
        self.model = model

    def get_by_id(
        self,
        db: Session,
        id: UUID,
        include_deleted: bool = False
    ) -> Optional[ModelType]:
        """Get a single record by ID."""
        query = db.query(self.model).filter(self.model.id == id)

        # Exclude soft-deleted records unless specifically requested
        if hasattr(self.model, 'deleted_at') and not include_deleted:
            query = query.filter(self.model.deleted_at.is_(None))

        return query.first()

    def get_multi(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None,
        include_deleted: bool = False,
        order_by: Optional[str] = None
    ) -> List[ModelType]:
        """Get multiple records with pagination and filtering."""
        query = db.query(self.model)

        # Apply soft delete filter
        if hasattr(self.model, 'deleted_at') and not include_deleted:
            query = query.filter(self.model.deleted_at.is_(None))

        # Apply custom filters
        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field) and value is not None:
                    query = query.filter(getattr(self.model, field) == value)

        # Apply ordering
        if order_by:
            if hasattr(self.model, order_by):
                query = query.order_by(getattr(self.model, order_by).desc())
        elif hasattr(self.model, 'created_at'):
            query = query.order_by(self.model.created_at.desc())

        return query.offset(skip).limit(limit).all()

    def count(
        self,
        db: Session,
        filters: Optional[Dict[str, Any]] = None,
        include_deleted: bool = False
    ) -> int:
        """Count records matching the filters."""
        query = db.query(self.model)

        # Apply soft delete filter
        if hasattr(self.model, 'deleted_at') and not include_deleted:
            query = query.filter(self.model.deleted_at.is_(None))

        # Apply custom filters
        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field) and value is not None:
                    query = query.filter(getattr(self.model, field) == value)

        return query.count()

    def create(
        self,
        db: Session,
        obj_in: CreateSchemaType,
        commit: bool = True
    ) -> ModelType:
        """Create a new record."""
        try:
            # Convert Pydantic model to dict
            obj_data = obj_in.model_dump(exclude_unset=True)

            # Create SQLAlchemy model instance
            db_obj = self.model(**obj_data)

            db.add(db_obj)

            if commit:
                db.commit()
                db.refresh(db_obj)

            return db_obj

        except IntegrityError as e:
            db.rollback()
            # Handle common constraint violations
            if "unique constraint" in str(e).lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A record with this information already exists"
                )
            elif "foreign key constraint" in str(e).lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Referenced record does not exist"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Database constraint violation"
                )

    def update(
        self,
        db: Session,
        id: UUID,
        obj_in: UpdateSchemaType,
        commit: bool = True
    ) -> Optional[ModelType]:
        """Update an existing record."""
        # Get existing record
        db_obj = self.get_by_id(db, id)
        if not db_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.model.__name__} not found"
            )

        try:
            # Get update data (only set fields)
            update_data = obj_in.model_dump(exclude_unset=True)

            # Apply updates
            for field, value in update_data.items():
                if hasattr(db_obj, field):
                    setattr(db_obj, field, value)

            # Update timestamp if available
            if hasattr(db_obj, 'updated_at'):
                db_obj.updated_at = datetime.utcnow()

            if commit:
                db.commit()
                db.refresh(db_obj)

            return db_obj

        except IntegrityError as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Database constraint violation"
            )

    def delete(
        self,
        db: Session,
        id: UUID,
        soft: bool = True,
        commit: bool = True
    ) -> bool:
        """Delete a record (soft or hard delete)."""
        # Get existing record
        db_obj = self.get_by_id(db, id)
        if not db_obj:
            return False

        try:
            if soft and hasattr(db_obj, 'deleted_at'):
                # Soft delete
                db_obj.deleted_at = datetime.utcnow()
                if hasattr(db_obj, 'updated_at'):
                    db_obj.updated_at = datetime.utcnow()
            else:
                # Hard delete
                db.delete(db_obj)

            if commit:
                db.commit()

            return True

        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error deleting record"
            )

    def get_or_404(
        self,
        db: Session,
        id: UUID,
        include_deleted: bool = False
    ) -> ModelType:
        """Get record by ID or raise 404 exception."""
        obj = self.get_by_id(db, id, include_deleted)
        if not obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.model.__name__} not found"
            )
        return obj