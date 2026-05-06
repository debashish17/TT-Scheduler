from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.models.shared.user import User

# Initialize Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

# Use HTTPBearer for Swagger UI compatibility and token extraction
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates the Supabase JWT token and retrieves the current user.
    If the user has authenticated in Supabase but doesn't exist in our 
    local users table, it automatically creates a basic SUPER_ADMIN profile.
    """
    token = credentials.credentials
    try:
        # get_user() securely validates the JWT token against the Supabase backend
        response = supabase.auth.get_user(token)
        
        if not response or not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        supabase_user = response.user
        
        # 1. Check if the user already exists in the local database
        db_user = db.query(User).filter(User.id == supabase_user.id).first()
        
        # 2. Lazy Creation: If the user doesn't exist, create a minimal profile
        if not db_user:
            db_user = User(id=supabase_user.id, email=supabase_user.email)
            db.add(db_user)
            db.commit()
            db.refresh(db_user)

        return db_user
        
    except Exception as e:
        # Catch any errors (expired token, malformed token, db error, etc.)
        import logging
        logging.getLogger(__name__).error(f"Error in get_current_user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
