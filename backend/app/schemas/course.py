"""
Course Pydantic schemas.
Request/response schemas for course management.
"""
from typing import Optional, List
from uuid import UUID
from decimal import Decimal
from pydantic import Field, validator
from app.schemas.common import BaseCreateSchema, BaseUpdateSchema, BaseResponseSchema


class CourseCreate(BaseCreateSchema):
    """Schema for creating a new course."""
    institution_id: UUID = Field(..., description="ID of the institution")
    department_id: UUID = Field(..., description="ID of the department")
    code: str = Field(..., min_length=2, max_length=20, description="Unique course code")
    name: str = Field(..., min_length=3, max_length=255, description="Course name")
    course_type: str = Field("theory", description="Type of course (theory, lab, tutorial)")
    theory_credits: Optional[Decimal] = Field(0.0, ge=0, le=10, description="Theory credit hours")
    lab_credits: Optional[Decimal] = Field(0.0, ge=0, le=10, description="Lab credit hours")
    hours_per_week: int = Field(..., ge=1, le=20, description="Total hours per week")
    assigned_faculty_id: Optional[UUID] = Field(None, description="ID of assigned faculty member")
    assigned_batch_id: Optional[UUID] = Field(None, description="ID of assigned student batch")
    expected_students: int = Field(0, ge=0, le=500, description="Expected number of students")
    required_features: List[str] = Field(default_factory=list, description="Required room features")

    @validator('code')
    def validate_code(cls, v):
        """Validate course code format."""
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Course code must contain only alphanumeric characters, underscores, or hyphens')
        return v.upper()

    @validator('course_type')
    def validate_course_type(cls, v):
        """Validate course type."""
        allowed_types = ['theory', 'lab', 'tutorial']
        if v.lower() not in allowed_types:
            raise ValueError(f'Course type must be one of: {", ".join(allowed_types)}')
        return v.lower()

    @validator('required_features')
    def validate_features(cls, v):
        """Validate required features."""
        if v:
            # Remove duplicates and empty strings
            cleaned = list({f.strip().lower() for f in v if f and f.strip()})
            allowed_features = [
                'projector', 'whiteboard', 'computer', 'internet', 'audio_system',
                'microphone', 'air_conditioning', 'laboratory_equipment', 'smart_board'
            ]
            invalid_features = [f for f in cleaned if f not in allowed_features]
            if invalid_features:
                raise ValueError(f'Invalid features: {", ".join(invalid_features)}. Allowed: {", ".join(allowed_features)}')
            return cleaned
        return []

    @validator('hours_per_week')
    def validate_hours_consistency(cls, v, values):
        """Validate hours consistency with credits."""
        if 'theory_credits' in values and 'lab_credits' in values:
            total_credits = float(values.get('theory_credits', 0)) + float(values.get('lab_credits', 0))
            # Rough validation: hours should be reasonable for credits
            if total_credits > 0 and (v < total_credits or v > total_credits * 3):
                raise ValueError(f'Hours per week ({v}) seems inconsistent with total credits ({total_credits})')
        return v

    class Config:
        schema_extra = {
            "example": {
                "institution_id": "550e8400-e29b-41d4-a716-446655440000",
                "department_id": "550e8400-e29b-41d4-a716-446655440001",
                "code": "CS101",
                "name": "Introduction to Computer Science",
                "course_type": "theory",
                "theory_credits": 3.0,
                "lab_credits": 1.0,
                "hours_per_week": 4,
                "assigned_faculty_id": "550e8400-e29b-41d4-a716-446655440002",
                "assigned_batch_id": "550e8400-e29b-41d4-a716-446655440003",
                "expected_students": 45,
                "required_features": ["projector", "whiteboard", "computer"]
            }
        }


class CourseUpdate(BaseUpdateSchema):
    """Schema for updating a course."""
    name: Optional[str] = Field(None, min_length=3, max_length=255)
    course_type: Optional[str] = None
    theory_credits: Optional[Decimal] = Field(None, ge=0, le=10)
    lab_credits: Optional[Decimal] = Field(None, ge=0, le=10)
    hours_per_week: Optional[int] = Field(None, ge=1, le=20)
    assigned_faculty_id: Optional[UUID] = None
    assigned_batch_id: Optional[UUID] = None
    expected_students: Optional[int] = Field(None, ge=0, le=500)
    required_features: Optional[List[str]] = None

    @validator('course_type')
    def validate_course_type(cls, v):
        """Validate course type."""
        if v:
            allowed_types = ['theory', 'lab', 'tutorial']
            if v.lower() not in allowed_types:
                raise ValueError(f'Course type must be one of: {", ".join(allowed_types)}')
            return v.lower()
        return v

    @validator('required_features')
    def validate_features(cls, v):
        """Validate required features."""
        if v:
            cleaned = list({f.strip().lower() for f in v if f and f.strip()})
            allowed_features = [
                'projector', 'whiteboard', 'computer', 'internet', 'audio_system',
                'microphone', 'air_conditioning', 'laboratory_equipment', 'smart_board'
            ]
            invalid_features = [f for f in cleaned if f not in allowed_features]
            if invalid_features:
                raise ValueError(f'Invalid features: {", ".join(invalid_features)}')
            return cleaned
        return v


class CourseResponse(BaseResponseSchema):
    """Schema for course response."""
    institution_id: UUID
    department_id: UUID
    code: str
    name: str
    course_type: str
    theory_credits: Decimal
    lab_credits: Decimal
    hours_per_week: int
    assigned_faculty_id: Optional[UUID] = None
    assigned_batch_id: Optional[UUID] = None
    expected_students: int
    required_features: List[str]

    # Related data
    department_name: Optional[str] = Field(None, description="Department name")
    department_code: Optional[str] = Field(None, description="Department code")
    faculty_name: Optional[str] = Field(None, description="Assigned faculty name")
    faculty_employee_id: Optional[str] = Field(None, description="Faculty employee ID")
    batch_name: Optional[str] = Field(None, description="Assigned batch name")

    # Computed fields
    total_credits: Optional[Decimal] = Field(None, description="Total credits (theory + lab)")
    sections_count: Optional[int] = Field(None, description="Number of sections")
    enrollment_status: Optional[str] = Field(None, description="Enrollment status (open, closed, full)")


class CourseList(BaseResponseSchema):
    """Schema for course list response."""
    code: str
    name: str
    course_type: str
    hours_per_week: int
    department_code: str
    faculty_name: Optional[str] = None
    expected_students: int = 0


class CourseStats(BaseResponseSchema):
    """Schema for course statistics."""
    code: str
    name: str
    course_type: str
    total_credits: Decimal
    hours_per_week: int
    sections: int = 0
    enrolled_students: int = 0
    capacity_utilization: float = 0.0
    faculty_assigned: bool = False


class CourseSection(BaseResponseSchema):
    """Schema for course section."""
    section_name: str
    max_students: int
    assigned_faculty_id: Optional[UUID] = None
    faculty_name: Optional[str] = None
    current_enrollment: int = 0


class CourseWithSections(CourseResponse):
    """Schema for course with sections."""
    sections: List[CourseSection] = Field(default_factory=list)


class CourseAssignment(BaseResponseSchema):
    """Schema for course assignment details."""
    code: str
    name: str
    hours_per_week: int
    faculty_id: UUID
    faculty_name: str
    batch_id: UUID
    batch_name: str
    room_requirements: List[str] = []