"""
Classrooms API routes.
"""
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models import Classroom, User
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
def list_rooms(
    institution_id: UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List classrooms."""
    query = db.query(Classroom).filter(Classroom.deleted_at.is_(None))
    
    target_institution = current_user.institution_id or institution_id
    if target_institution:
        query = query.filter(Classroom.institution_id == target_institution)
    
    rooms = query.offset(skip).limit(limit).all()
    
    return {"total": len(rooms), "rooms": rooms}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_room(
    room_number: str,
    capacity: int,
    building: str = None,
    room_type: str = "lecture_hall",
    institution_id: UUID = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new classroom."""
    from app.models.room import RoomType
    
    target_institution = current_user.institution_id or institution_id
    if not target_institution:
         raise HTTPException(
             status_code=400, 
             detail="No institution associated with current user, and no institution_id provided."
         )
         
    room = Classroom(
        institution_id=target_institution,
        room_number=room_number,
        building=building,
        capacity=capacity,
        room_type=RoomType(room_type)
    )
    
    db.add(room)
    db.commit()
    db.refresh(room)
    
    return room
