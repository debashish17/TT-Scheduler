"""
Student Batches API routes.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models import StudentBatch

router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
def list_batches(
    department_id: UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List student batches."""
    query = db.query(StudentBatch).filter(StudentBatch.deleted_at.is_(None))
    
    if department_id:
        query = query.filter(StudentBatch.department_id == department_id)
    
    batches = query.offset(skip).limit(limit).all()
    
    return {"total": len(batches), "batches": batches}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_batch(
    institution_id: UUID,
    department_id: UUID,
    batch_name: str,
    year: int,
    semester: int,
    student_count: int = 0,
    db: Session = Depends(get_db)
):
    """Create a new student batch."""
    batch = StudentBatch(
        institution_id=institution_id,
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
