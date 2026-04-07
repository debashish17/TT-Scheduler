"""
Predefined Slots API routes.
"""
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models import PredefinedSlot, User
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
def list_slots(
    institution_id: UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List predefined time slots."""
    query = db.query(PredefinedSlot)
    
    target_institution = current_user.institution_id or institution_id
    if target_institution:
        query = query.filter(PredefinedSlot.institution_id == target_institution)
    
    slots = query.offset(skip).limit(limit).all()
    
    return {"total": len(slots), "slots": slots}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_slot(
    slot_code: str,
    timings: dict,
    duration_minutes: int,
    slot_type: str = "theory",
    institution_id: UUID = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new time slot."""
    from app.models.slot import SlotType
    
    target_institution = current_user.institution_id or institution_id
    if not target_institution:
         raise HTTPException(
             status_code=400, 
             detail="No institution associated with current user, and no institution_id provided."
         )
         
    slot = PredefinedSlot(
        institution_id=target_institution,
        slot_code=slot_code,
        slot_type=SlotType(slot_type),
        timings=timings,
        duration_minutes=duration_minutes
    )
    
    db.add(slot)
    db.commit()
    db.refresh(slot)
    
    return slot
