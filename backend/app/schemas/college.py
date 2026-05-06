"""Wizard request shape for college timetables."""
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class CollegeCourseIn(BaseModel):
    code: str
    name: str
    department: str
    year: int = 1
    credits: int = Field(default=3, ge=1, le=6)
    lectures_per_week: int = Field(default=3, ge=1)
    has_lab: bool = False
    required_lecture_room_type: str = "classroom"
    required_lab_room_type: Optional[str] = None
    enrolled_students: int = Field(default=30, ge=1)
    is_elective: bool = False
    faculty_codes: List[str] = []


class CollegeFacultyIn(BaseModel):
    code: str
    name: str
    department: str = ""
    courses_can_teach: List[str] = []
    max_hours_per_week: int = Field(default=18, ge=1, le=40)


class CollegeRoomIn(BaseModel):
    name: str
    capacity: int = Field(default=40, ge=1)
    room_type: str = "classroom"


class CollegeDepartmentIn(BaseModel):
    code: str
    name: str


class CollegeHardConstraintsIn(BaseModel):
    lunch_period_index: int = Field(default=-1)
    max_consecutive_periods: int = Field(default=3, ge=1, le=10)
    max_periods_per_day_per_faculty: int = Field(default=6, ge=1, le=15)


class CollegeSoftConstraintIn(BaseModel):
    type: str
    target: str
    when: Optional[str] = None
    weight: int = Field(default=3, ge=1, le=10)


class CollegeGenerateRequest(BaseModel):
    institution_name: str = "My College"
    name: Optional[str] = None
    parent_run_id: Optional[UUID] = None
    semester: int = Field(default=1, ge=1, le=8)
    departments: List[CollegeDepartmentIn] = []
    course_offerings: List[CollegeCourseIn]
    faculty: List[CollegeFacultyIn]
    rooms: List[CollegeRoomIn]
    working_days: List[str] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    periods_per_day: int = Field(default=7, ge=1, le=15)
    period_duration_minutes: int = Field(default=60, ge=15, le=180)
    start_time: str = "08:00"
    constraints: CollegeHardConstraintsIn = Field(default_factory=CollegeHardConstraintsIn)
    soft_constraints: List[CollegeSoftConstraintIn] = []
