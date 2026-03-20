"""
Classroom/Room Pydantic schemas.
Request/response schemas for classroom management.
"""
from typing import Optional, List
from uuid import UUID
from pydantic import Field, validator
from app.schemas.common import BaseCreateSchema, BaseUpdateSchema, BaseResponseSchema


class RoomCreate(BaseCreateSchema):
    """Schema for creating a new classroom."""
    institution_id: UUID = Field(..., description="ID of the institution")
    room_number: str = Field(..., min_length=1, max_length=20, description="Room number or identifier")
    building: Optional[str] = Field(None, max_length=100, description="Building name")
    capacity: int = Field(..., ge=1, le=1000, description="Maximum occupancy")
    room_type: str = Field("lecture_hall", description="Type of room")
    features: List[str] = Field(default_factory=list, description="Available features/equipment")

    @validator('room_number')
    def validate_room_number(cls, v):
        """Validate room number format."""
        # Allow alphanumeric, spaces, hyphens, dots
        allowed = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -.')
        if not all(c in allowed for c in v):
            raise ValueError('Room number can only contain letters, numbers, spaces, hyphens, and dots')
        return v.strip()

    @validator('room_type')
    def validate_room_type(cls, v):
        """Validate room type."""
        allowed_types = [
            'lecture_hall', 'computer_lab', 'physics_lab', 'chemistry_lab',
            'seminar_room', 'auditorium', 'tutorial_room'
        ]
        if v not in allowed_types:
            raise ValueError(f'Room type must be one of: {", ".join(allowed_types)}')
        return v

    @validator('features')
    def validate_features(cls, v):
        """Validate room features."""
        if v:
            allowed_features = [
                'projector', 'whiteboard', 'computer', 'internet', 'audio_system',
                'microphone', 'air_conditioning', 'laboratory_equipment', 'smart_board'
            ]
            cleaned = list({f.strip().lower() for f in v if f and f.strip()})
            invalid = [f for f in cleaned if f not in allowed_features]
            if invalid:
                raise ValueError(f'Invalid features: {", ".join(invalid)}')
            return cleaned
        return []

    class Config:
        schema_extra = {
            "example": {
                "institution_id": "550e8400-e29b-41d4-a716-446655440000",
                "room_number": "CS-101",
                "building": "Computer Science Building",
                "capacity": 50,
                "room_type": "computer_lab",
                "features": ["projector", "computer", "internet", "air_conditioning"]
            }
        }


class RoomUpdate(BaseUpdateSchema):
    """Schema for updating a classroom."""
    room_number: Optional[str] = Field(None, min_length=1, max_length=20)
    building: Optional[str] = Field(None, max_length=100)
    capacity: Optional[int] = Field(None, ge=1, le=1000)
    room_type: Optional[str] = None
    features: Optional[List[str]] = None

    @validator('room_type')
    def validate_room_type(cls, v):
        """Validate room type."""
        if v:
            allowed_types = [
                'lecture_hall', 'computer_lab', 'physics_lab', 'chemistry_lab',
                'seminar_room', 'auditorium', 'tutorial_room'
            ]
            if v not in allowed_types:
                raise ValueError(f'Room type must be one of: {", ".join(allowed_types)}')
        return v

    @validator('features')
    def validate_features(cls, v):
        """Validate room features."""
        if v:
            allowed_features = [
                'projector', 'whiteboard', 'computer', 'internet', 'audio_system',
                'microphone', 'air_conditioning', 'laboratory_equipment', 'smart_board'
            ]
            cleaned = list({f.strip().lower() for f in v if f and f.strip()})
            invalid = [f for f in cleaned if f not in allowed_features]
            if invalid:
                raise ValueError(f'Invalid features: {", ".join(invalid)}')
            return cleaned
        return v


class RoomResponse(BaseResponseSchema):
    """Schema for room response."""
    institution_id: UUID
    room_number: str
    building: Optional[str] = None
    capacity: int
    room_type: str
    features: List[str]

    # Related data
    institution_name: Optional[str] = Field(None, description="Institution name")

    # Computed fields
    utilization_rate: Optional[float] = Field(None, description="Current utilization percentage")
    total_bookings: Optional[int] = Field(None, description="Total scheduled classes")
    available_slots: Optional[int] = Field(None, description="Available time slots")


class RoomList(BaseResponseSchema):
    """Schema for room list response."""
    room_number: str
    building: Optional[str] = None
    capacity: int
    room_type: str
    utilization_rate: float = 0.0


class RoomAvailability(BaseResponseSchema):
    """Schema for room availability."""
    room_number: str
    capacity: int
    room_type: str
    features: List[str]
    available_slots: List[dict] = Field(default_factory=list)
    conflicting_slots: List[dict] = Field(default_factory=list)


class RoomBooking(BaseCreateSchema):
    """Schema for room booking."""
    room_id: UUID = Field(..., description="ID of the room")
    course_id: UUID = Field(..., description="ID of the course")
    faculty_id: UUID = Field(..., description="ID of the faculty")
    batch_id: UUID = Field(..., description="ID of the batch")
    slot_id: UUID = Field(..., description="ID of the time slot")
    booking_date: str = Field(..., description="Date of booking (YYYY-MM-DD)")
    notes: Optional[str] = Field(None, description="Additional notes")
