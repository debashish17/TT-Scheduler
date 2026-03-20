"""
Classrooms API routes.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models import Classroom

router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
def list_rooms(
    institution_id: UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List classrooms."""
    query = db.query(Classroom).filter(Classroom.deleted_at.is_(None))
    
    if institution_id:
        query = query.filter(Classroom.institution_id == institution_id)
    
    rooms = query.offset(skip).limit(limit).all()
    
    return {"total": len(rooms), "rooms": rooms}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_room(
    institution_id: UUID,
    room_number: str,
    capacity: int,
    building: str = None,
    room_type: str = "lecture_hall",
    db: Session = Depends(get_db)
):
    """Create a new classroom."""
    from app.models.room import RoomType
    
    room = Classroom(
        institution_id=institution_id,
        room_number=room_number,
        building=building,
        capacity=capacity,
        room_type=RoomType(room_type)
    )
    
    db.add(room)
    db.commit()
    db.refresh(room)
    
    return room
