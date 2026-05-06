"""
Authentication API routes.
Integrated with Supabase Auth — backend mirrors auth.users into our `users` table.
"""
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.shared.user import User

router = APIRouter()


@router.get("/me")
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """
    Return the currently authenticated user's profile.
    Triggers a lazy-sync that creates the row in `users` on first access.
    """
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
    }
