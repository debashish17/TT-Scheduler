"""
Courses API routes.
Manage academic courses.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models import Course

router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
def list_courses(
    department_id: UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List courses."""
    query = db.query(Course).filter(Course.deleted_at.is_(None))
    
    if department_id:
        query = query.filter(Course.department_id == department_id)
    
    courses = query.offset(skip).limit(limit).all()
    
    return {
        "total": len(courses),
        "courses": courses
    }


@router.get("/{course_id}", status_code=status.HTTP_200_OK)
def get_course(course_id: UUID, db: Session = Depends(get_db)):
    """Get a specific course."""
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.deleted_at.is_(None)
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return course


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_course(
    institution_id: UUID,
    department_id: UUID,
    code: str,
    name: str,
    hours_per_week: int,
    course_type: str = "theory",
    db: Session = Depends(get_db)
):
    """Create a new course."""
    from app.models.course import CourseType
    
    course = Course(
        institution_id=institution_id,
        department_id=department_id,
        code=code,
        name=name,
        course_type=CourseType(course_type),
        hours_per_week=hours_per_week
    )
    
    db.add(course)
    db.commit()
    db.refresh(course)
    
    return course
