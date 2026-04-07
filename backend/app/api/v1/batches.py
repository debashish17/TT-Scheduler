"""
Student Batches API routes.
"""
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models import StudentBatch, User
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
def list_batches(
    department_id: UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List student batches."""
    query = db.query(StudentBatch).filter(StudentBatch.deleted_at.is_(None))
    
    if department_id:
        query = query.filter(StudentBatch.department_id == department_id)
        
    if current_user.institution_id:
        query = query.filter(StudentBatch.institution_id == current_user.institution_id)
    
    batches = query.offset(skip).limit(limit).all()
    
    return {"total": len(batches), "batches": batches}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_batch(
    department_id: UUID,
    batch_name: str,
    year: int,
    semester: int,
    student_count: int = 0,
    institution_id: UUID = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new student batch."""
    
    target_institution = current_user.institution_id or institution_id
    if not target_institution:
         raise HTTPException(
             status_code=400, 
             detail="No institution associated with current user, and no institution_id provided."
         )
         
    batch = StudentBatch(
        institution_id=target_institution,
        department_id=department_id,
        batch_name=batch_name,
        year=year,
        semester=semester,
        student_count=student_count
    )
    
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    return batch
