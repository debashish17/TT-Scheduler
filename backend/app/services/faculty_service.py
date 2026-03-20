"""
Faculty service layer.
Business logic for faculty management.
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models import Faculty, Department, Course
from app.schemas.faculty import FacultyCreate, FacultyUpdate
from app.services.base_service import BaseService


class FacultyService(BaseService[Faculty, FacultyCreate, FacultyUpdate]):
    """Faculty-specific business logic."""

    def __init__(self):
        super().__init__(Faculty)

    def get_by_employee_id(
        self,
        db: Session,
        employee_id: str,
        institution_id: Optional[UUID] = None
    ) -> Optional[Faculty]:
        """Get faculty by employee ID."""
        query = db.query(Faculty).filter(
            Faculty.employee_id == employee_id.upper(),
            Faculty.deleted_at.is_(None)
        )

        if institution_id:
            query = query.filter(Faculty.institution_id == institution_id)

        return query.first()

    def get_by_department(
        self,
        db: Session,
        department_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[Faculty]:
        """Get all faculty in a department."""
        return self.get_multi(
            db, skip, limit,
            filters={"department_id": department_id}
        )

    def search(
        self,
        db: Session,
        query: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Faculty]:
        """Search faculty by name or employee ID."""
        search_term = f"%{query}%"

        return db.query(Faculty).filter(
            or_(
                Faculty.name.ilike(search_term),
                Faculty.employee_id.ilike(search_term),
                Faculty.email.ilike(search_term)
            ),
            Faculty.deleted_at.is_(None)
        ).offset(skip).limit(limit).all()

    def get_workload(self, db: Session, faculty_id: UUID) -> Dict[str, Any]:
        """Calculate current workload for faculty."""
        faculty = self.get_by_id(db, faculty_id)
        if not faculty:
            return None

        # Count assigned courses and total hours
        assigned_courses = db.query(Course).filter(
            Course.assigned_faculty_id == faculty_id,
            Course.deleted_at.is_(None)
        ).all()

        total_hours = sum(course.hours_per_week for course in assigned_courses)
        available_hours = faculty.max_hours_per_week - total_hours
        utilization = (total_hours / faculty.max_hours_per_week * 100) if faculty.max_hours_per_week > 0 else 0

        return {
            "faculty_id": str(faculty_id),
            "employee_id": faculty.employee_id,
            "name": faculty.name,
            "max_hours_per_week": faculty.max_hours_per_week,
            "assigned_hours": total_hours,
            "available_hours": max(0, available_hours),
            "courses_count": len(assigned_courses),
            "courses": [
                {
                    "id": str(course.id),
                    "code": course.code,
                    "name": course.name,
                    "hours_per_week": course.hours_per_week
                }
                for course in assigned_courses
            ],
            "overloaded": total_hours > faculty.max_hours_per_week,
            "utilization_percentage": round(utilization, 2)
        }

    def validate_employee_id_unique(
        self,
        db: Session,
        employee_id: str,
        institution_id: UUID,
        exclude_id: Optional[UUID] = None
    ) -> bool:
        """Check if employee ID is unique within institution."""
        query = db.query(Faculty).filter(
            Faculty.employee_id == employee_id.upper(),
            Faculty.institution_id == institution_id,
            Faculty.deleted_at.is_(None)
        )

        if exclude_id:
            query = query.filter(Faculty.id != exclude_id)

        existing = query.first()
        return existing is None


# Create singleton instance
faculty_service = FacultyService()