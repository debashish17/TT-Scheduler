"""
Institution service layer.
Business logic for institution management.
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import Institution, Department, Faculty, Student
from app.schemas.institution import InstitutionCreate, InstitutionUpdate, InstitutionStats
from app.services.base_service import BaseService


class InstitutionService(BaseService[Institution, InstitutionCreate, InstitutionUpdate]):
    """Institution-specific business logic."""

    def __init__(self):
        super().__init__(Institution)

    def get_by_code(self, db: Session, code: str) -> Optional[Institution]:
        """Get institution by unique code."""
        return db.query(Institution).filter(
            Institution.code == code.upper(),
            Institution.deleted_at.is_(None)
        ).first()

    def get_stats(self, db: Session, institution_id: UUID) -> Optional[InstitutionStats]:
        """Get comprehensive statistics for an institution."""
        institution = self.get_by_id(db, institution_id)
        if not institution:
            return None

        # Count departments
        departments_count = db.query(func.count(Department.id)).filter(
            Department.institution_id == institution_id,
            Department.deleted_at.is_(None)
        ).scalar()

        # Count faculty
        faculty_count = db.query(func.count(Faculty.id)).filter(
            Faculty.institution_id == institution_id,
            Faculty.deleted_at.is_(None)
        ).scalar()

        # Count students
        students_count = db.query(func.count(Student.id)).filter(
            Student.institution_id == institution_id,
            Student.deleted_at.is_(None)
        ).scalar()

        # TODO: Add courses count and active timetables count when those models are ready

        return InstitutionStats(
            id=institution.id,
            created_at=institution.created_at,
            updated_at=institution.updated_at,
            code=institution.code,
            name=institution.name,
            departments=departments_count or 0,
            faculty=faculty_count or 0,
            students=students_count or 0,
            courses=0,  # TODO: Implement when courses are ready
            active_timetables=0,  # TODO: Implement when timetables are ready
            last_timetable_generated=None  # TODO: Implement
        )

    def search(
        self,
        db: Session,
        query: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Institution]:
        """Search institutions by name or code."""
        return db.query(Institution).filter(
            db.or_(
                Institution.name.ilike(f"%{query}%"),
                Institution.code.ilike(f"%{query}%")
            ),
            Institution.deleted_at.is_(None)
        ).offset(skip).limit(limit).all()

    def get_by_type(
        self,
        db: Session,
        institution_type: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Institution]:
        """Get institutions by type."""
        return db.query(Institution).filter(
            Institution.type == institution_type,
            Institution.deleted_at.is_(None)
        ).offset(skip).limit(limit).all()

    def validate_code_unique(self, db: Session, code: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if institution code is unique."""
        query = db.query(Institution).filter(Institution.code == code.upper())

        if exclude_id:
            query = query.filter(Institution.id != exclude_id)

        existing = query.first()
        return existing is None

    def get_with_counts(self, db: Session, institution_id: UUID) -> Optional[Dict[str, Any]]:
        """Get institution with related entity counts."""
        institution = self.get_by_id(db, institution_id)
        if not institution:
            return None

        # Get counts using subqueries for efficiency
        departments_count = db.query(func.count(Department.id)).filter(
            Department.institution_id == institution_id,
            Department.deleted_at.is_(None)
        ).scalar() or 0

        faculty_count = db.query(func.count(Faculty.id)).filter(
            Faculty.institution_id == institution_id,
            Faculty.deleted_at.is_(None)
        ).scalar() or 0

        students_count = db.query(func.count(Student.id)).filter(
            Student.institution_id == institution_id,
            Student.deleted_at.is_(None)
        ).scalar() or 0

        return {
            "id": institution.id,
            "code": institution.code,
            "name": institution.name,
            "type": institution.type,
            "location": institution.location,
            "contact": institution.contact,
            "settings": institution.settings,
            "created_at": institution.created_at,
            "updated_at": institution.updated_at,
            "total_departments": departments_count,
            "total_faculty": faculty_count,
            "total_students": students_count
        }


# Create a singleton instance
institution_service = InstitutionService()