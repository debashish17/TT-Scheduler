"""
Faculty Pydantic schemas.
Request/response schemas for faculty management.
"""
from typing import Optional, List
from uuid import UUID
from pydantic import Field, validator, EmailStr
from app.schemas.common import BaseCreateSchema, BaseUpdateSchema, BaseResponseSchema


class FacultyCreate(BaseCreateSchema):
    """Schema for creating a new faculty member."""
    institution_id: UUID = Field(..., description="ID of the institution")
    department_id: UUID = Field(..., description="ID of the department")
    employee_id: str = Field(..., min_length=2, max_length=50, description="Unique employee ID")
    name: str = Field(..., min_length=2, max_length=255, description="Faculty member's full name")
    email: Optional[EmailStr] = Field(None, description="Faculty email address")
    designation: Optional[str] = Field(None, max_length=50, description="Faculty designation (e.g., Professor, Associate Professor)")
    max_hours_per_week: int = Field(18, ge=1, le=60, description="Maximum teaching hours per week")
    subjects_can_teach: List[str] = Field(default_factory=list, description="List of subjects the faculty can teach")

    @validator('employee_id')
    def validate_employee_id(cls, v):
        """Validate employee ID format."""
        if not v.replace('_', '').replace('-', '').replace('.', '').isalnum():
            raise ValueError('Employee ID must contain only alphanumeric characters, underscores, hyphens, or dots')
        return v.upper()

    @validator('designation')
    def validate_designation(cls, v):
        """Validate faculty designation."""
        if v:
            allowed_designations = [
                'Professor', 'Associate Professor', 'Assistant Professor',
                'Lecturer', 'Senior Lecturer', 'Instructor', 'Teaching Assistant',
                'Visiting Professor', 'Adjunct Professor', 'Emeritus Professor'
            ]
            if v not in allowed_designations:
                raise ValueError(f'Designation must be one of: {", ".join(allowed_designations)}')
        return v

    @validator('subjects_can_teach')
    def validate_subjects(cls, v):
        """Validate subjects list."""
        if v:
            # Remove duplicates and empty strings
            cleaned = list({s.strip() for s in v if s and s.strip()})
            return cleaned
        return []

    class Config:
        schema_extra = {
            "example": {
                "institution_id": "550e8400-e29b-41d4-a716-446655440000",
                "department_id": "550e8400-e29b-41d4-a716-446655440001",
                "employee_id": "FAC001",
                "name": "Dr. John Smith",
                "email": "john.smith@university.edu",
                "designation": "Associate Professor",
                "max_hours_per_week": 20,
                "subjects_can_teach": ["Computer Science", "Data Structures", "Algorithms"]
            }
        }


class FacultyUpdate(BaseUpdateSchema):
    """Schema for updating a faculty member."""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    designation: Optional[str] = Field(None, max_length=50)
    max_hours_per_week: Optional[int] = Field(None, ge=1, le=60)
    subjects_can_teach: Optional[List[str]] = None

    @validator('designation')
    def validate_designation(cls, v):
        """Validate faculty designation."""
        if v:
            allowed_designations = [
                'Professor', 'Associate Professor', 'Assistant Professor',
                'Lecturer', 'Senior Lecturer', 'Instructor', 'Teaching Assistant',
                'Visiting Professor', 'Adjunct Professor', 'Emeritus Professor'
            ]
            if v not in allowed_designations:
                raise ValueError(f'Designation must be one of: {", ".join(allowed_designations)}')
        return v

    @validator('subjects_can_teach')
    def validate_subjects(cls, v):
        """Validate subjects list."""
        if v:
            cleaned = list({s.strip() for s in v if s and s.strip()})
            return cleaned
        return v


class FacultyResponse(BaseResponseSchema):
    """Schema for faculty response."""
    institution_id: UUID
    department_id: UUID
    employee_id: str
    name: str
    email: Optional[str] = None
    designation: Optional[str] = None
    max_hours_per_week: int
    subjects_can_teach: List[str]

    # Related data
    department_name: Optional[str] = Field(None, description="Department name")
    department_code: Optional[str] = Field(None, description="Department code")
    institution_name: Optional[str] = Field(None, description="Institution name")

    # Computed fields
    current_workload: Optional[int] = Field(None, description="Current teaching hours assigned")
    available_hours: Optional[int] = Field(None, description="Available hours for teaching")
    courses_assigned: Optional[int] = Field(None, description="Number of courses currently assigned")


class FacultyList(BaseResponseSchema):
    """Schema for faculty list response."""
    employee_id: str
    name: str
    designation: Optional[str] = None
    department_code: str
    current_workload: int = 0
    max_hours_per_week: int = 18


class FacultyStats(BaseResponseSchema):
    """Schema for faculty statistics."""
    employee_id: str
    name: str
    designation: Optional[str] = None
    total_courses: int = 0
    total_hours: int = 0
    utilization_percentage: float = 0.0
    subjects_teaching: List[str] = []


class FacultyWorkload(BaseResponseSchema):
    """Schema for faculty workload details."""
    employee_id: str
    name: str
    max_hours_per_week: int
    assigned_hours: int
    available_hours: int
    courses: List[dict] = Field(default_factory=list, description="List of assigned courses with hours")
    overload: bool = Field(False, description="True if assigned hours exceed max hours")
    utilization_percentage: float = 0.0