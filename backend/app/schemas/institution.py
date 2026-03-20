"""
Institution Pydantic schemas.
Request/response schemas for institution management.
"""
from typing import Optional, Dict, Any, List
from pydantic import Field, validator
from app.schemas.common import BaseCreateSchema, BaseUpdateSchema, BaseResponseSchema


class InstitutionCreate(BaseCreateSchema):
    """Schema for creating a new institution."""
    code: str = Field(..., min_length=2, max_length=20, description="Unique institution code")
    name: str = Field(..., min_length=3, max_length=255, description="Institution name")
    type: str = Field(..., min_length=3, max_length=50, description="Type of institution (e.g., University, College)")
    location: Optional[Dict[str, Any]] = Field(None, description="Location details in JSON format")
    contact: Optional[Dict[str, Any]] = Field(None, description="Contact information in JSON format")
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Institution-specific settings")

    @validator('code')
    def validate_code(cls, v):
        """Validate institution code format."""
        if not v.isalnum() and '_' not in v and '-' not in v:
            raise ValueError('Code must contain only alphanumeric characters, underscores, or hyphens')
        return v.upper()

    @validator('type')
    def validate_type(cls, v):
        """Validate institution type."""
        allowed_types = [
            'University', 'College', 'Institute', 'School',
            'Academy', 'Polytechnic', 'Community College'
        ]
        if v not in allowed_types:
            raise ValueError(f'Type must be one of: {", ".join(allowed_types)}')
        return v

    class Config:
        schema_extra = {
            "example": {
                "code": "MIT",
                "name": "Massachusetts Institute of Technology",
                "type": "University",
                "location": {
                    "address": "77 Massachusetts Ave",
                    "city": "Cambridge",
                    "state": "MA",
                    "country": "USA",
                    "zip_code": "02139"
                },
                "contact": {
                    "phone": "+1-617-253-1000",
                    "email": "info@mit.edu",
                    "website": "https://web.mit.edu"
                },
                "settings": {
                    "academic_year_start": "September",
                    "default_class_duration": 60,
                    "max_classes_per_day": 8
                }
            }
        }


class InstitutionUpdate(BaseUpdateSchema):
    """Schema for updating an institution."""
    code: Optional[str] = Field(None, min_length=2, max_length=20)
    name: Optional[str] = Field(None, min_length=3, max_length=255)
    type: Optional[str] = Field(None, min_length=3, max_length=50)
    location: Optional[Dict[str, Any]] = None
    contact: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None

    @validator('code')
    def validate_code(cls, v):
        """Validate institution code format."""
        if v and (not v.isalnum() and '_' not in v and '-' not in v):
            raise ValueError('Code must contain only alphanumeric characters, underscores, or hyphens')
        return v.upper() if v else None


class InstitutionResponse(BaseResponseSchema):
    """Schema for institution response."""
    code: str
    name: str
    type: str
    location: Optional[Dict[str, Any]] = None
    contact: Optional[Dict[str, Any]] = None
    settings: Dict[str, Any] = {}

    # Computed fields
    total_departments: Optional[int] = Field(None, description="Number of departments")
    total_faculty: Optional[int] = Field(None, description="Number of faculty members")
    total_students: Optional[int] = Field(None, description="Number of students")


class InstitutionList(BaseResponseSchema):
    """Schema for institution list response."""
    code: str
    name: str
    type: str
    total_departments: Optional[int] = 0
    total_faculty: Optional[int] = 0


class InstitutionStats(BaseResponseSchema):
    """Schema for institution statistics."""
    code: str
    name: str
    departments: int = 0
    faculty: int = 0
    courses: int = 0
    students: int = 0
    active_timetables: int = 0
    last_timetable_generated: Optional[str] = None