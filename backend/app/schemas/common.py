"""
Common Pydantic schemas for the application.
Contains base classes and mixins used across all entities.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class TimestampMixin(BaseModel):
    """Mixin for models with timestamp fields."""
    created_at: datetime
    updated_at: datetime


class UUIDMixin(BaseModel):
    """Mixin for models with UUID primary keys."""
    id: UUID


class SoftDeleteMixin(BaseModel):
    """Mixin for models with soft delete support."""
    deleted_at: Optional[datetime] = None


class APIResponse(BaseModel):
    """Standard API response wrapper."""
    success: bool = True
    message: str = "Operation successful"
    data: Optional[dict] = None


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""
    total: int
    page: int = 1
    per_page: int = 100
    pages: int
    has_next: bool
    has_prev: bool


class ErrorResponse(BaseModel):
    """Standard error response."""
    success: bool = False
    error: str
    details: Optional[dict] = None


class BaseCreateSchema(BaseModel):
    """Base schema for create operations."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        use_enum_values=True,
    )


class BaseUpdateSchema(BaseModel):
    """Base schema for update operations."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        use_enum_values=True,
        extra='forbid'  # Prevent extra fields in updates
    )


class BaseResponseSchema(UUIDMixin, TimestampMixin):
    """Base schema for response operations."""
    model_config = ConfigDict(
        from_attributes=True,
        use_enum_values=True,
    )


class SearchFilters(BaseModel):
    """Common search and filter parameters."""
    q: Optional[str] = None  # Search query
    skip: int = 0
    limit: int = 100
    sort_by: Optional[str] = "created_at"
    sort_order: str = "desc"  # asc or desc
    active_only: bool = True  # Exclude soft-deleted records


class BulkResponse(BaseModel):
    """Response for bulk operations."""
    total_processed: int
    successful: int
    failed: int
    errors: list[dict] = []


class ValidationError(BaseModel):
    """Validation error detail."""
    field: str
    message: str
    invalid_value: Optional[str] = None