"""Cross-product run history."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.shared.user import User
from app.repositories import run_repo

router = APIRouter()


@router.get("/")
def list_runs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"runs": run_repo.list_all_runs(db, user_id=user.id)}
