"""
Authentication API routes.
Integrated with Supabase Auth.
"""
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/me")
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """
    Get the currently active logged-in user profile natively. 
    This triggers the lazy-sync to pull from Supabase Auth into local Postgres Users table.
    """
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "institution_id": str(current_user.institution_id) if current_user.institution_id else None
    }
