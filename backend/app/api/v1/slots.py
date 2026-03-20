"""
Predefined Slots API routes.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models import PredefinedSlot

router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
def list_slots(
    institution_id: UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List predefined time slots."""
    query = db.query(PredefinedSlot)
    
    if institution_id:
        query = query.filter(PredefinedSlot.institution_id == institution_id)
    
    slots = query.offset(skip).limit(limit).all()
    
    return {"total": len(slots), "slots": slots}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_slot(
    institution_id: UUID,
    slot_code: str,
    timings: dict,
    duration_minutes: int,
    slot_type: str = "theory",
    db: Session = Depends(get_db)
):
    """Create a new time slot."""
    from app.models.slot import SlotType
    
    slot = PredefinedSlot(
        institution_id=institution_id,
        slot_code=slot_code,
        slot_type=SlotType(slot_type),
        timings=timings,
        duration_minutes=duration_minutes
    )
    
    db.add(slot)
    db.commit()
    db.refresh(slot)
    
    return slot
