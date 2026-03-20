"""
Pydantic schemas for timetable generation and optimization.
Defines request/response models for the timetable API endpoints.
"""
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field, validator
from app.schemas.common import BaseCreateSchema, BaseResponseSchema
from app.core.constraints import ConstraintViolation


class TimetableStatus(str, Enum):
    """Status of timetable generation."""
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class OptimizationMode(str, Enum):
    """Optimization modes for timetable generation."""
    FAST = "fast"          # Prioritize speed over quality
    BALANCED = "balanced"  # Balance between speed and quality
    QUALITY = "quality"    # Prioritize quality over speed


class SolutionFormat(str, Enum):
    """Output format for timetable solutions."""
    DETAILED = "detailed"  # Full assignment details
    GRID = "grid"         # Traditional timetable grid format
    COMPACT = "compact"   # Minimal format for storage


# Request Schemas
class TimetableGenerationRequest(BaseCreateSchema):
    """Request schema for timetable generation."""

    institution_id: UUID = Field(..., description="Institution for which to generate timetable")
    semester: str = Field(..., description="Semester identifier (e.g., 'Fall 2024')")

    # Optional filters
    department_ids: Optional[List[UUID]] = Field(None, description="Specific departments to include")
    faculty_ids: Optional[List[UUID]] = Field(None, description="Specific faculty to include")
    batch_ids: Optional[List[UUID]] = Field(None, description="Specific batches to include")

    # Generation parameters
    optimization_mode: OptimizationMode = Field(OptimizationMode.BALANCED, description="Optimization strategy")
    time_limit_minutes: int = Field(5, ge=1, le=60, description="Maximum optimization time in minutes")
    solution_format: SolutionFormat = Field(SolutionFormat.DETAILED, description="Output format")

    # Constraint configuration
    enable_soft_constraints: bool = Field(True, description="Include soft constraint optimization")
    soft_constraint_weights: Optional[Dict[str, int]] = Field(None, description="Custom weights for soft constraints")

    # Advanced options
    max_solutions: int = Field(1, ge=1, le=10, description="Number of alternative solutions to generate")
    seed: Optional[int] = Field(None, description="Random seed for reproducible results")

    @validator('semester')
    def validate_semester(cls, v):
        """Validate semester format."""
        if not v or len(v.strip()) < 3:
            raise ValueError("Semester must be at least 3 characters long")
        return v.strip()


class TimetableAssignment(BaseModel):
    """Individual assignment in a timetable."""

    course_id: UUID
    course_code: str
    course_name: str

    faculty_id: UUID
    faculty_name: str
    faculty_employee_id: str

    batch_id: UUID
    batch_name: str
    expected_students: int

    room_id: UUID
    room_number: str
    room_building: Optional[str] = None

    slot_id: UUID
    day_of_week: int  # 0=Monday, 1=Tuesday, etc.
    period_number: int
    start_time: str   # e.g., "09:00"
    end_time: str     # e.g., "10:00"

    # Additional metadata
    duration_minutes: int
    course_type: Optional[str] = None  # theory, lab, tutorial
    required_features: List[str] = []


class TimetableGrid(BaseModel):
    """Grid-based timetable representation."""

    days: List[str] = Field(default_factory=lambda: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    periods: List[Dict[str, Any]]  # Period definitions with times

    # Grid data: grid[day][period] = assignment or null
    grid: Dict[str, Dict[str, Optional[TimetableAssignment]]]

    # Metadata
    total_assignments: int
    empty_slots: int
    utilization_percentage: float


class OptimizationResult(BaseModel):
    """Result of timetable optimization."""

    success: bool
    generation_time: float  # seconds

    # Solution data (if successful)
    timetable_data: Optional[Dict[str, Any]] = None
    penalty_score: Optional[int] = None

    # Quality metrics
    hard_constraints_satisfied: bool = True
    constraint_violations: List[ConstraintViolation] = []

    # Solver statistics
    solver_statistics: Optional[Dict[str, Any]] = None

    # Error information (if failed)
    error_message: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None


class TimetableGenerationStatus(BaseModel):
    """Status information for ongoing timetable generation."""

    job_id: str
    status: TimetableStatus
    progress_percentage: float = Field(0.0, ge=0.0, le=100.0)

    # Timing information
    started_at: datetime
    estimated_completion: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Progress details
    current_step: Optional[str] = None
    steps_completed: int = 0
    total_steps: int = 0

    # Results (when completed)
    result: Optional[OptimizationResult] = None

    # Error information (if failed)
    error_message: Optional[str] = None


# Response Schemas
class TimetableResponse(BaseResponseSchema):
    """Complete timetable response."""

    institution_id: UUID
    semester: str
    status: TimetableStatus

    # Generation metadata
    generated_at: datetime
    generation_time: float
    optimization_mode: OptimizationMode

    # Solution data
    assignments: List[TimetableAssignment] = []
    grid_view: Optional[TimetableGrid] = None

    # Quality metrics
    total_courses: int
    assigned_courses: int
    assignment_rate: float  # percentage of courses successfully assigned

    penalty_score: Optional[int] = None
    constraint_violations: List[ConstraintViolation] = []

    # Statistics
    faculty_utilization: Dict[str, float] = {}  # faculty_id -> utilization %
    room_utilization: Dict[str, float] = {}     # room_id -> utilization %

    solver_statistics: Optional[Dict[str, Any]] = None

    @validator('assignment_rate')
    def validate_assignment_rate(cls, v, values):
        """Calculate assignment rate from courses."""
        if 'total_courses' in values and values['total_courses'] > 0:
            assigned = values.get('assigned_courses', 0)
            return round((assigned / values['total_courses']) * 100, 2)
        return 0.0


class TimetableComparisonRequest(BaseModel):
    """Request for comparing multiple timetable solutions."""

    timetable_ids: List[UUID] = Field(..., min_items=2, max_items=5, description="Timetable IDs to compare")
    comparison_criteria: List[str] = Field(
        default=["penalty_score", "assignment_rate", "faculty_utilization", "constraint_violations"],
        description="Criteria for comparison"
    )


class TimetableComparison(BaseModel):
    """Comparison result between multiple timetables."""

    timetables: List[TimetableResponse]

    # Comparison metrics
    best_overall: UUID  # ID of best timetable overall
    best_by_criteria: Dict[str, UUID]  # criteria -> best timetable ID

    # Detailed comparison
    comparison_matrix: Dict[str, Dict[str, Any]]  # timetable_id -> metrics

    # Recommendations
    recommended_choice: UUID
    recommendation_reason: str


class TimetableExportRequest(BaseModel):
    """Request for exporting timetable data."""

    timetable_id: UUID
    export_format: str = Field("excel", description="Export format: excel, pdf, csv")
    include_metadata: bool = Field(True, description="Include generation metadata")

    # Format-specific options
    excel_options: Optional[Dict[str, Any]] = Field(None, description="Excel-specific export options")
    pdf_options: Optional[Dict[str, Any]] = Field(None, description="PDF-specific export options")


# Analytics Schemas
class TimetableAnalytics(BaseModel):
    """Analytics data for timetable performance."""

    institution_id: UUID
    semester: str
    analysis_date: datetime

    # Utilization metrics
    overall_room_utilization: float
    overall_faculty_utilization: float
    peak_usage_periods: List[str]

    # Efficiency metrics
    average_gap_time: float  # minutes of gaps in schedules
    consecutive_classes_percentage: float
    lunch_break_compliance: float

    # Constraint satisfaction
    hard_constraint_satisfaction: float  # should be 100%
    soft_constraint_satisfaction: float
    most_violated_constraints: List[str]

    # Recommendations
    optimization_suggestions: List[str]
    bottleneck_resources: List[str]  # rooms, faculty, or time slots causing issues


class BatchTimetableView(BaseModel):
    """Timetable view specific to a student batch."""

    batch_id: UUID
    batch_name: str
    semester: str

    # Weekly schedule
    weekly_schedule: TimetableGrid

    # Batch-specific metrics
    total_hours_per_week: int
    average_gap_time: float
    longest_day_hours: int
    days_with_classes: int

    # Course distribution
    course_distribution: Dict[str, int]  # course_type -> count
    faculty_diversity: int  # number of different faculty teaching this batch