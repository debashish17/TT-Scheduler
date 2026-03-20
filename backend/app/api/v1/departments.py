"""
Departments API routes.
Manage academic departments.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models import Department

router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
def list_departments(
    institution_id: UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List departments, optionally filtered by institution."""
    query = db.query(Department).filter(Department.deleted_at.is_(None))
    
    if institution_id:
        query = query.filter(Department.institution_id == institution_id)
    
    departments = query.offset(skip).limit(limit).all()
    
    return {
        "total": len(departments),
        "departments": departments
    }


@router.get("/{department_id}", status_code=status.HTTP_200_OK)
def get_department(department_id: UUID, db: Session = Depends(get_db)):
    """Get a specific department by ID."""
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.deleted_at.is_(None)
    ).first()
    
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    return department


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_department(
    institution_id: UUID,
    code: str,
    name: str,
    db: Session = Depends(get_db)
):
    """Create a new department."""
    department = Department(
        institution_id=institution_id,
        code=code,
        name=name
    )
    
    db.add(department)
    db.commit()
    db.refresh(department)
    
    return department
