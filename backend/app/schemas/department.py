"""
Department Pydantic schemas.
Request/response schemas for department management.
"""
from typing import Optional
from uuid import UUID
from pydantic import Field, validator
from app.schemas.common import BaseCreateSchema, BaseUpdateSchema, BaseResponseSchema


class DepartmentCreate(BaseCreateSchema):
    """Schema for creating a new department."""
    institution_id: UUID = Field(..., description="ID of the parent institution")
    code: str = Field(..., min_length=2, max_length=10, description="Department code")
    name: str = Field(..., min_length=3, max_length=255, description="Department name")

    @validator('code')
    def validate_code(cls, v):
        """Validate department code format."""
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Code must contain only alphanumeric characters, underscores, or hyphens')
        return v.upper()

    class Config:
        schema_extra = {
            "example": {
                "institution_id": "550e8400-e29b-41d4-a716-446655440000",
                "code": "CSE",
                "name": "Computer Science & Engineering"
            }
        }


class DepartmentUpdate(BaseUpdateSchema):
    """Schema for updating a department."""
    code: Optional[str] = Field(None, min_length=2, max_length=10)
    name: Optional[str] = Field(None, min_length=3, max_length=255)

    @validator('code')
    def validate_code(cls, v):
        """Validate department code format."""
        if v and not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Code must contain only alphanumeric characters, underscores, or hyphens')
        return v.upper() if v else None


class DepartmentResponse(BaseResponseSchema):
    """Schema for department response."""
    institution_id: UUID
    code: str
    name: str

    # Related data
    institution_name: Optional[str] = Field(None, description="Name of parent institution")
    institution_code: Optional[str] = Field(None, description="Code of parent institution")

    # Computed fields
    total_faculty: Optional[int] = Field(None, description="Number of faculty members")
    total_courses: Optional[int] = Field(None, description="Number of courses")
    total_batches: Optional[int] = Field(None, description="Number of student batches")


class DepartmentList(BaseResponseSchema):
    """Schema for department list response."""
    institution_id: UUID
    code: str
    name: str
    total_faculty: int = 0
    total_courses: int = 0


class DepartmentStats(BaseResponseSchema):
    """Schema for department statistics."""
    code: str
    name: str
    faculty_count: int = 0
    course_count: int = 0
    batch_count: int = 0
    theory_courses: int = 0
    lab_courses: int = 0
    tutorial_courses: int = 0
    active_faculty: int = 0