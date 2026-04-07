"""
Courses API routes.
Manage academic courses.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models import Course, User
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
def list_courses(
    department_id: UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List courses."""
    query = db.query(Course).filter(Course.deleted_at.is_(None))
    
    if department_id:
        query = query.filter(Course.department_id == department_id)
        
    if current_user.institution_id:
         query = query.filter(Course.institution_id == current_user.institution_id)
    
    courses = query.offset(skip).limit(limit).all()
    
    return {
        "total": len(courses),
        "courses": courses
    }


@router.get("/{course_id}", status_code=status.HTTP_200_OK)
def get_course(
    course_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific course."""
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.deleted_at.is_(None)
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    if current_user.institution_id and course.institution_id != current_user.institution_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this course")
    
    return course


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_course(
    department_id: UUID,
    code: str,
    name: str,
    hours_per_week: int,
    course_type: str = "theory",
    institution_id: UUID = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new course."""
    from app.models.course import CourseType
    
    target_institution = current_user.institution_id or institution_id
    if not target_institution:
         raise HTTPException(
             status_code=400, 
             detail="No institution associated with current user, and no institution_id provided."
         )
         
    # Optional: Verify the department belongs to the user's institution
    
    course = Course(
        institution_id=target_institution,
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
