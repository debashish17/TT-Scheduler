"""Wizard request shape for school timetables — mirrors current frontend payload."""
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class SchoolSubjectIn(BaseModel):
    name: str
    code: str
    periods_per_week: int = Field(default=3, ge=1, le=15)
    target_classes: List[str] = []


class SchoolTeacherIn(BaseModel):
    name: str
    subjects: List[str] = []


class SchoolClassIn(BaseModel):
    name: str
    size: int = Field(default=30, ge=1, le=500)


class SchoolRoomIn(BaseModel):
    name: str
    capacity: int = Field(default=40, ge=1, le=1000)


class SchoolHardConstraintsIn(BaseModel):
    max_consecutive_periods: int = Field(default=3, ge=1, le=10)
    lunch_after_period: int = Field(default=0, ge=0)
    max_periods_per_day_per_teacher: int = Field(default=8, ge=1, le=15)


class SchoolSoftConstraintIn(BaseModel):
    type: str
    target: str
    when: Optional[str] = None
    weight: int = Field(default=3, ge=1, le=10)


class SchoolGenerateRequest(BaseModel):
    institution_name: str = "My School"
    name: Optional[str] = None
    parent_run_id: Optional[UUID] = None
    subjects: List[SchoolSubjectIn]
    teachers: List[SchoolTeacherIn] = []
    classes: List[SchoolClassIn]
    rooms: List[SchoolRoomIn]
    working_days: List[str] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    periods_per_day: int = Field(default=7, ge=1, le=15)
    period_duration_minutes: int = Field(default=45, ge=15, le=180)
    lunch_duration_minutes: int = Field(default=0, ge=0, le=120)
    start_time: str = "08:00"
    constraints: SchoolHardConstraintsIn = Field(default_factory=SchoolHardConstraintsIn)
    soft_constraints: List[SchoolSoftConstraintIn] = []
    # Optional override for the solver's auto-tiered time budget. Auto-Fix
    # retries pass a larger value so time stops being the limiting factor.
    solve_time_limit_seconds: Optional[float] = None
