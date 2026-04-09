"""
Departments API routes.
Manage academic departments.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models import Department, User
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
def list_departments(
    institution_id: UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List departments, optionally filtered by institution. Enforces user's institution mapping if applicable."""
    query = db.query(Department).filter(Department.deleted_at.is_(None))
    
    # Restrict to user's institution if they have one
    target_institution = current_user.institution_id or institution_id
    if target_institution:
        query = query.filter(Department.institution_id == target_institution)
    
    departments = query.offset(skip).limit(limit).all()
    
    return {
        "total": len(departments),
        "departments": departments
    }


@router.get("/{department_id}", status_code=status.HTTP_200_OK)
def get_department(
    department_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific department by ID."""
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.deleted_at.is_(None)
    ).first()
    
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
        
    if current_user.institution_id and department.institution_id != current_user.institution_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this department")
    
    return department


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_department(
    code: str,
    name: str,
    institution_id: UUID = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new department under the currently logged-in user's institution."""
    
    target_institution = current_user.institution_id or institution_id
    if not target_institution:
         raise HTTPException(
             status_code=400, 
             detail="No institution associated with current user, and no institution_id provided."
         )
         
    department = Department(
        institution_id=target_institution,
        code=code,
        name=name
    )
    
    db.add(department)
    db.commit()
    db.refresh(department)
    
    return department
