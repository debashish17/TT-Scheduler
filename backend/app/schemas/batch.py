"""
Student Batch Pydantic schemas.
Request/response schemas for student batch management.
"""
from typing import Optional
from uuid import UUID
from pydantic import Field, validator
from app.schemas.common import BaseCreateSchema, BaseUpdateSchema, BaseResponseSchema


class StudentBatchCreate(BaseCreateSchema):
    """Schema for creating a new student batch."""
    institution_id: UUID = Field(..., description="ID of the institution")
    department_id: UUID = Field(..., description="ID of the department")
    batch_name: str = Field(..., min_length=2, max_length=50, description="Unique batch name")
    year: int = Field(..., ge=1, le=6, description="Academic year (1-6)")
    semester: int = Field(..., ge=1, le=12, description="Semester number (1-12)")
    student_count: int = Field(0, ge=0, le=200, description="Number of students in the batch")

    @validator('batch_name')
    def validate_batch_name(cls, v):
        """Validate batch name format."""
        # Allow letters, numbers, spaces, hyphens, and underscores
        allowed_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_')
        if not all(c in allowed_chars for c in v):
            raise ValueError('Batch name can only contain letters, numbers, spaces, hyphens, and underscores')
        return v.strip()

    @validator('year')
    def validate_year(cls, v):
        """Validate academic year."""
        if not (1 <= v <= 6):
            raise ValueError('Academic year must be between 1 and 6')
        return v

    @validator('semester')
    def validate_semester(cls, v):
        """Validate semester number."""
        if not (1 <= v <= 12):
            raise ValueError('Semester must be between 1 and 12')
        return v

    class Config:
        schema_extra = {
            "example": {
                "institution_id": "550e8400-e29b-41d4-a716-446655440000",
                "department_id": "550e8400-e29b-41d4-a716-446655440001",
                "batch_name": "CSE-2024-A",
                "year": 2,
                "semester": 3,
                "student_count": 45
            }
        }


class StudentBatchUpdate(BaseUpdateSchema):
    """Schema for updating a student batch."""
    batch_name: Optional[str] = Field(None, min_length=2, max_length=50)
    year: Optional[int] = Field(None, ge=1, le=6)
    semester: Optional[int] = Field(None, ge=1, le=12)
    student_count: Optional[int] = Field(None, ge=0, le=200)

    @validator('batch_name')
    def validate_batch_name(cls, v):
        """Validate batch name format."""
        if v:
            allowed_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_')
            if not all(c in allowed_chars for c in v):
                raise ValueError('Batch name can only contain letters, numbers, spaces, hyphens, and underscores')
            return v.strip()
        return v

    @validator('year')
    def validate_year(cls, v):
        """Validate academic year."""
        if v is not None and not (1 <= v <= 6):
            raise ValueError('Academic year must be between 1 and 6')
        return v

    @validator('semester')
    def validate_semester(cls, v):
        """Validate semester number."""
        if v is not None and not (1 <= v <= 12):
            raise ValueError('Semester must be between 1 and 12')
        return v


class StudentBatchResponse(BaseResponseSchema):
    """Schema for student batch response."""
    institution_id: UUID
    department_id: UUID
    batch_name: str
    year: int
    semester: int
    student_count: int

    # Related data
    department_name: Optional[str] = Field(None, description="Department name")
    department_code: Optional[str] = Field(None, description="Department code")
    institution_name: Optional[str] = Field(None, description="Institution name")

    # Computed fields
    total_courses: Optional[int] = Field(None, description="Number of courses assigned to this batch")
    active_courses: Optional[int] = Field(None, description="Number of currently active courses")
    completed_courses: Optional[int] = Field(None, description="Number of completed courses")

    # Academic info
    academic_level: Optional[str] = Field(None, description="Academic level (Freshman, Sophomore, etc.)")
    graduation_year: Optional[int] = Field(None, description="Expected graduation year")


class StudentBatchList(BaseResponseSchema):
    """Schema for student batch list response."""
    batch_name: str
    year: int
    semester: int
    student_count: int
    department_code: str
    total_courses: int = 0


class StudentBatchStats(BaseResponseSchema):
    """Schema for student batch statistics."""
    batch_name: str
    year: int
    semester: int
    student_count: int
    courses_enrolled: int = 0
    total_credit_hours: float = 0.0
    theory_courses: int = 0
    lab_courses: int = 0
    tutorial_courses: int = 0
    average_class_size: float = 0.0


class StudentBatchTimetable(BaseResponseSchema):
    """Schema for student batch timetable view."""
    batch_name: str
    year: int
    semester: int
    total_classes_per_week: int = 0
    classes_by_day: dict = Field(default_factory=dict, description="Classes organized by day")
    faculty_list: list = Field(default_factory=list, description="List of faculty teaching this batch")


class StudentBatchEnrollment(BaseCreateSchema):
    """Schema for batch enrollment operations."""
    batch_id: UUID = Field(..., description="ID of the batch")
    course_id: UUID = Field(..., description="ID of the course")
    section_name: Optional[str] = Field(None, description="Specific section name if applicable")