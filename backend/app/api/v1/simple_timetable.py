"""
Simple timetable generation API.
Single endpoint that accepts all problem data and returns a complete timetable.
No pre-existing database records required.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
import logging

from app.core.simple_solver import solve_timetable

logger = logging.getLogger(__name__)
router = APIRouter()


class SubjectIn(BaseModel):
    name: str
    code: str
    periods_per_week: int = Field(default=3, ge=1, le=15)


class TeacherIn(BaseModel):
    name: str
    subjects: List[str] = []   # list of subject codes; empty = can teach all


class ClassIn(BaseModel):
    name: str
    size: int = Field(default=30, ge=1, le=500)


class RoomIn(BaseModel):
    name: str
    capacity: int = Field(default=40, ge=1, le=1000)


class ConstraintsIn(BaseModel):
    max_consecutive_periods: int = Field(default=3, ge=1, le=10)
    lunch_after_period: int = Field(default=0, ge=0)       # 0 = no lunch break slot
    max_periods_per_day_per_teacher: int = Field(default=8, ge=1, le=15)


class SimpleTimetableRequest(BaseModel):
    institution_name: str = "My School"
    subjects: List[SubjectIn]
    teachers: List[TeacherIn] = []
    classes: List[ClassIn]
    rooms: List[RoomIn]
    working_days: List[str] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    periods_per_day: int = Field(default=7, ge=1, le=15)
    period_duration_minutes: int = Field(default=45, ge=15, le=180)
    start_time: str = "08:00"
    constraints: ConstraintsIn = Field(default_factory=ConstraintsIn)


@router.post("/generate-simple")
async def generate_simple_timetable(request: SimpleTimetableRequest):
    """
    Generate a school timetable from self-contained request data.

    No database setup needed. Just send subjects, teachers, classes, rooms
    and working schedule — get back a complete timetable.

    The CP-SAT solver ensures:
    - Each subject gets the correct number of periods per week
    - No teacher teaches two classes at the same time
    - No room is double-booked
    - No class has two subjects at the same time
    - Subjects are spread across the week (soft constraint)
    """
    if not request.subjects:
        raise HTTPException(status_code=400, detail="At least one subject is required")
    if not request.classes:
        raise HTTPException(status_code=400, detail="At least one class is required")
    if not request.rooms:
        raise HTTPException(status_code=400, detail="At least one room is required")
    if not request.working_days:
        raise HTTPException(status_code=400, detail="Working days must be specified")

    # If no teachers defined, create auto-teachers (one per subject)
    teachers_data = request.teachers
    if not teachers_data:
        teachers_data = [
            TeacherIn(name=f"Teacher ({s.name})", subjects=[s.code])
            for s in request.subjects
        ]

    # Check total periods required vs available
    total_required = sum(s.periods_per_week for s in request.subjects) * len(request.classes)
    total_available = len(request.working_days) * request.periods_per_day * len(request.rooms)

    if total_required > total_available:
        logger.warning(
            f"Tight schedule: {total_required} sessions needed, {total_available} room-periods available"
        )

    # Build problem dict for solver
    problem = {
        "institution_name": request.institution_name,
        "subjects": [s.model_dump() for s in request.subjects],
        "teachers": [t.model_dump() for t in teachers_data],
        "classes": [c.model_dump() for c in request.classes],
        "rooms": [r.model_dump() for r in request.rooms],
        "working_days": request.working_days,
        "periods_per_day": request.periods_per_day,
        "period_duration_minutes": request.period_duration_minutes,
        "start_time": request.start_time,
        "constraints": request.constraints.model_dump()
    }

    logger.info(
        f"Generating timetable for '{request.institution_name}': "
        f"{len(request.subjects)} subjects, {len(teachers_data)} teachers, "
        f"{len(request.classes)} classes, {len(request.rooms)} rooms"
    )

    result = solve_timetable(problem)

    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Timetable generation failed")
        )

    return result
