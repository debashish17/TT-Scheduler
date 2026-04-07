"""
Institutions API routes.
Manage educational institutions with proper validation and error handling.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.api.deps import get_current_user
from app.models.user import User
from app.db.session import get_db
from app.schemas.institution import (
    InstitutionCreate, InstitutionUpdate, InstitutionResponse,
    InstitutionList, InstitutionStats
)
from app.schemas.common import APIResponse, PaginatedResponse
from app.services.institution_service import institution_service

router = APIRouter()


@router.get("/", response_model=List[InstitutionList])
def list_institutions(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    q: Optional[str] = Query(None, description="Search query (name or code)"),
    institution_type: Optional[str] = Query(None, description="Filter by institution type"),
    db: Session = Depends(get_db)
):
    """
    List all institutions with filtering and pagination.

    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return (1-1000)
    - **q**: Search by name or code
    - **institution_type**: Filter by type (University, College, etc.)
    """
    if q:
        # Search mode
        institutions = institution_service.search(db, q, skip, limit)
    elif institution_type:
        # Filter by type
        institutions = institution_service.get_by_type(db, institution_type, skip, limit)
    else:
        # Normal list
        institutions = institution_service.get_multi(db, skip, limit)

    # Convert to list response format
    return [
        InstitutionList(
            id=inst.id,
            created_at=inst.created_at,
            updated_at=inst.updated_at,
            code=inst.code,
            name=inst.name,
            type=inst.type,
            total_departments=0,  # TODO: Add counts in service
            total_faculty=0
        )
        for inst in institutions
    ]


@router.get("/{institution_id}", response_model=InstitutionResponse)
def get_institution(
    institution_id: UUID,
    include_stats: bool = Query(False, description="Include department/faculty counts"),
    db: Session = Depends(get_db)
):
    """
    Get a specific institution by ID.

    - **institution_id**: UUID of the institution
    - **include_stats**: Whether to include related entity counts
    """
    if include_stats:
        institution_data = institution_service.get_with_counts(db, institution_id)
        if not institution_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Institution not found"
            )
        return InstitutionResponse(**institution_data)
    else:
        institution = institution_service.get_or_404(db, institution_id)
        return InstitutionResponse(
            id=institution.id,
            created_at=institution.created_at,
            updated_at=institution.updated_at,
            code=institution.code,
            name=institution.name,
            type=institution.type,
            location=institution.location,
            contact=institution.contact,
            settings=institution.settings
        )


@router.get("/{institution_id}/stats", response_model=InstitutionStats)
def get_institution_stats(
    institution_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get comprehensive statistics for an institution.

    Returns counts of departments, faculty, courses, students, and timetables.
    """
    stats = institution_service.get_stats(db, institution_id)
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institution not found"
        )
    return stats


@router.get("/code/{institution_code}", response_model=InstitutionResponse)
def get_institution_by_code(
    institution_code: str,
    db: Session = Depends(get_db)
):
    """
    Get institution by unique code.

    - **institution_code**: Institution code (case-insensitive)
    """
    institution = institution_service.get_by_code(db, institution_code)
    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institution not found"
        )

    return InstitutionResponse(
        id=institution.id,
        created_at=institution.created_at,
        updated_at=institution.updated_at,
        code=institution.code,
        name=institution.name,
        type=institution.type,
        location=institution.location,
        contact=institution.contact,
        settings=institution.settings
    )


@router.post("/", response_model=InstitutionResponse, status_code=status.HTTP_201_CREATED)
def create_institution(
    institution_in: InstitutionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new institution.

    Request body should contain:
    - **code**: Unique institution code (2-20 characters, alphanumeric + underscore/hyphen)
    - **name**: Institution name (3-255 characters)
    - **type**: Type (University, College, etc.)
    - **location**: Optional location details (JSON object)
    - **contact**: Optional contact information (JSON object)
    - **settings**: Optional institution-specific settings (JSON object)
    """
    # Check if code is unique
    if not institution_service.validate_code_unique(db, institution_in.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Institution code '{institution_in.code}' already exists"
        )

    # Create the institution
    institution = institution_service.create(db, institution_in)

    # Link the newly created institution to the user
    if current_user.institution_id is None:
        current_user.institution_id = institution.id
        db.commit()

    return InstitutionResponse(
        id=institution.id,
        created_at=institution.created_at,
        updated_at=institution.updated_at,
        code=institution.code,
        name=institution.name,
        type=institution.type,
        location=institution.location,
        contact=institution.contact,
        settings=institution.settings
    )


@router.put("/{institution_id}", response_model=InstitutionResponse)
def update_institution(
    institution_id: UUID,
    institution_update: InstitutionUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing institution.

    Only provided fields will be updated. All fields are optional.
    """
    # If updating code, check uniqueness
    if institution_update.code:
        if not institution_service.validate_code_unique(db, institution_update.code, exclude_id=institution_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Institution code '{institution_update.code}' already exists"
            )

    # Update the institution
    institution = institution_service.update(db, institution_id, institution_update)

    return InstitutionResponse(
        id=institution.id,
        created_at=institution.created_at,
        updated_at=institution.updated_at,
        code=institution.code,
        name=institution.name,
        type=institution.type,
        location=institution.location,
        contact=institution.contact,
        settings=institution.settings
    )


@router.delete("/{institution_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_institution(
    institution_id: UUID,
    hard_delete: bool = Query(False, description="Perform hard delete instead of soft delete"),
    db: Session = Depends(get_db)
):
    """
    Delete an institution.

    By default, performs soft delete (sets deleted_at timestamp).
    Use hard_delete=true for permanent deletion (use with caution).
    """
    success = institution_service.delete(db, institution_id, soft=not hard_delete)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institution not found"
        )
    return None


@router.post("/{institution_id}/restore", response_model=InstitutionResponse)
def restore_institution(
    institution_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Restore a soft-deleted institution.

    This endpoint can be used to recover accidentally deleted institutions.
    Only works for institutions that were soft-deleted.
    """
    institution = institution_service.restore(db, institution_id)
    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institution not found or already active"
        )

    return InstitutionResponse(
        id=institution.id,
        created_at=institution.created_at,
        updated_at=institution.updated_at,
        code=institution.code,
        name=institution.name,
        type=institution.type,
        location=institution.location,
        contact=institution.contact,
        settings=institution.settings
    )