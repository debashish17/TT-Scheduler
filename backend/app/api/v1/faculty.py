"""
Faculty API routes.
Manage faculty members with Excel import/export capabilities.
"""
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import io

from app.db.session import get_db
from app.models import User
from app.api.deps import get_current_user
from app.schemas.faculty import FacultyCreate, FacultyUpdate, FacultyResponse, FacultyList
from app.schemas.import_schemas import ImportResultResponse, ImportTemplate
from app.services.faculty_service import faculty_service
from app.services.import_service import import_service

router = APIRouter()


@router.get("/", response_model=List[FacultyList])
def list_faculty(
    department_id: Optional[UUID] = Query(None, description="Filter by department ID"),
    institution_id: Optional[UUID] = Query(None, description="Filter by institution ID"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    q: Optional[str] = Query(None, description="Search by name or employee ID"),
    db: Session = Depends(get_db)
):
    """
    List faculty members with filtering and search.

    - **department_id**: Filter by specific department
    - **institution_id**: Filter by institution
    - **q**: Search by faculty name or employee ID
    - **skip/limit**: Pagination parameters
    """
    filters = {}
    if department_id:
        filters['department_id'] = department_id
    if institution_id:
        filters['institution_id'] = institution_id

    if q:
        # Search functionality - implement in service
        faculty_list = faculty_service.search(db, q, skip, limit)
    else:
        faculty_list = faculty_service.get_multi(db, skip, limit, filters)

    result = []
    for faculty in faculty_list:
        # Load department code efficiently
        department_code = ""
        if faculty.department:
            department_code = faculty.department.code

        # Calculate current workload
        workload_info = faculty_service.get_workload(db, faculty.id)
        current_workload = workload_info["assigned_hours"] if workload_info else 0

        result.append(FacultyList(
            id=faculty.id,
            created_at=faculty.created_at,
            updated_at=faculty.updated_at,
            employee_id=faculty.employee_id,
            name=faculty.name,
            designation=faculty.designation,
            department_code=department_code,
            current_workload=current_workload,
            max_hours_per_week=faculty.max_hours_per_week
        ))

    return result


@router.get("/{faculty_id}", response_model=FacultyResponse)
def get_faculty(
    faculty_id: UUID,
    include_workload: bool = Query(False, description="Include current workload calculation"),
    db: Session = Depends(get_db)
):
    """
    Get a specific faculty member by ID.

    - **faculty_id**: UUID of the faculty member
    - **include_workload**: Calculate and include current teaching workload
    """
    faculty = faculty_service.get_or_404(db, faculty_id)

    # Calculate workload if requested
    current_workload = None
    available_hours = None
    courses_assigned = None

    if include_workload:
        workload_info = faculty_service.get_workload(db, faculty_id)
        if workload_info:
            current_workload = workload_info["assigned_hours"]
            available_hours = workload_info["available_hours"]
            courses_assigned = workload_info["courses_count"]

    return FacultyResponse(
        id=faculty.id,
        created_at=faculty.created_at,
        updated_at=faculty.updated_at,
        institution_id=faculty.institution_id,
        department_id=faculty.department_id,
        employee_id=faculty.employee_id,
        name=faculty.name,
        email=faculty.email,
        designation=faculty.designation,
        max_hours_per_week=faculty.max_hours_per_week,
        subjects_can_teach=faculty.subjects_can_teach,
        current_workload=current_workload,
        available_hours=available_hours,
        courses_assigned=courses_assigned
    )


@router.post("/", response_model=FacultyResponse, status_code=status.HTTP_201_CREATED)
def create_faculty(
    faculty_in: FacultyCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new faculty member.

    Validates all input data using Pydantic schemas and checks for:
    - Unique employee ID within institution
    - Valid department and institution references
    - Email format validation
    - Designation from allowed list
    """
    # Validate unique employee_id within institution
    if not faculty_service.validate_employee_id_unique(
        db,
        faculty_in.employee_id,
        faculty_in.institution_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee ID '{faculty_in.employee_id}' already exists in this institution"
        )

    faculty = faculty_service.create(db, faculty_in)

    return FacultyResponse(
        id=faculty.id,
        created_at=faculty.created_at,
        updated_at=faculty.updated_at,
        institution_id=faculty.institution_id,
        department_id=faculty.department_id,
        employee_id=faculty.employee_id,
        name=faculty.name,
        email=faculty.email,
        designation=faculty.designation,
        max_hours_per_week=faculty.max_hours_per_week,
        subjects_can_teach=faculty.subjects_can_teach
    )


@router.put("/{faculty_id}", response_model=FacultyResponse)
def update_faculty(
    faculty_id: UUID,
    faculty_update: FacultyUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing faculty member.

    Only provided fields will be updated. All fields are optional.
    """
    faculty = faculty_service.update(db, faculty_id, faculty_update)

    return FacultyResponse(
        id=faculty.id,
        created_at=faculty.created_at,
        updated_at=faculty.updated_at,
        institution_id=faculty.institution_id,
        department_id=faculty.department_id,
        employee_id=faculty.employee_id,
        name=faculty.name,
        email=faculty.email,
        designation=faculty.designation,
        max_hours_per_week=faculty.max_hours_per_week,
        subjects_can_teach=faculty.subjects_can_teach
    )


@router.delete("/{faculty_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faculty(
    faculty_id: UUID,
    hard_delete: bool = Query(False, description="Perform hard delete instead of soft delete"),
    db: Session = Depends(get_db)
):
    """
    Delete a faculty member.

    By default, performs soft delete. Use hard_delete=true for permanent deletion.
    """
    success = faculty_service.delete(db, faculty_id, soft=not hard_delete)
    if not success:
        raise HTTPException(status_code=404, detail="Faculty not found")
    return None


# ====================================
# EXCEL IMPORT/EXPORT ENDPOINTS
# ====================================

@router.post("/import", response_model=ImportResultResponse)
async def import_faculty_excel(
    institution_id: UUID = Query(..., description="Institution ID for import"),
    file: UploadFile = File(..., description="Excel file with faculty data"),
    db: Session = Depends(get_db)
):
    """
    Import faculty from Excel file.

    **File Requirements:**
    - Format: .xlsx or .xls
    - Max size: 10MB
    - Required columns: employee_id, name, department_code
    - Optional columns: email, designation, max_hours_per_week, subjects_can_teach

    **Process:**
    1. Validates file format and structure
    2. Checks for duplicate employee IDs
    3. Validates department codes exist
    4. Creates faculty records with proper validation
    5. Returns detailed results with any errors

    **Example Excel Structure:**
    | employee_id | name | email | department_code | designation | max_hours_per_week | subjects_can_teach |
    |-------------|------|-------|-----------------|-------------|-------------------|-------------------|
    | FAC001 | Dr. Smith | smith@edu | CSE | Professor | 20 | CS, Algorithms |
    """
    # Validate file size (10MB limit)
    if hasattr(file, 'size') and file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum size is 10MB."
        )

    # Validate institution exists
    from app.services.institution_service import institution_service
    institution = institution_service.get_by_id(db, institution_id)
    if not institution:
        raise HTTPException(
            status_code=404,
            detail=f"Institution with ID {institution_id} not found"
        )

    try:
        # Perform import
        result = await import_service.import_faculty_excel(db, file, institution_id)

        # Convert to response format
        return ImportResultResponse(
            total_processed=result.total_processed,
            successful=result.successful,
            failed=result.failed,
            success_rate=result.to_dict()['success_rate'],
            created_records=len(result.created_records),
            errors=[
                {"row": err["row"], "error": err["error"], "data": err["data"]}
                for err in result.errors
            ],
            warnings=[
                {"row": warn["row"], "warning": warn["warning"], "data": warn["data"]}
                for warn in result.warnings
            ],
            has_errors=len(result.errors) > 0,
            has_warnings=len(result.warnings) > 0
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Import failed: {str(e)}"
        )


@router.get("/import/template", response_class=StreamingResponse)
def download_faculty_template():
    """
    Download Excel template for faculty import.

    **Template Features:**
    - Pre-formatted headers with descriptions
    - Sample data rows for reference
    - Data validation dropdowns (e.g., for designation)
    - Instructions sheet with import guidelines
    - Proper column formatting

    **Usage:**
    1. Download this template
    2. Fill in your faculty data
    3. Upload using the import endpoint
    """
    try:
        # Generate template
        template_file = import_service.generate_faculty_template()

        # Return as downloadable file
        return StreamingResponse(
            io.BytesIO(template_file.getvalue()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=faculty_import_template.xlsx"
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating template: {str(e)}"
        )


@router.get("/import/template/info", response_model=ImportTemplate)
def get_template_info():
    """
    Get information about the faculty import template.

    Returns metadata about required/optional columns, validations, etc.
    """
    return ImportTemplate(
        entity_type="faculty",
        required_columns=["employee_id", "name", "department_code"],
        optional_columns=["email", "designation", "max_hours_per_week", "subjects_can_teach"],
        sample_data_rows=2,
        has_validations=True,
        instructions_included=True
    )


@router.get("/export", response_class=StreamingResponse)
def export_faculty_excel(
    institution_id: Optional[UUID] = Query(None, description="Filter by institution"),
    department_id: Optional[UUID] = Query(None, description="Filter by department"),
    db: Session = Depends(get_db)
):
    """
    Export faculty data to Excel file.

    **Features:**
    - Exports all faculty matching filters
    - Includes all faculty details
    - Formatted Excel with headers
    - Ready for re-import if needed

    **Filters:**
    - institution_id: Export only faculty from specific institution
    - department_id: Export only faculty from specific department
    """
    try:
        # Build filters for faculty query
        filters = {}
        if institution_id:
            filters['institution_id'] = institution_id
        if department_id:
            filters['department_id'] = department_id

        # Get faculty data
        faculty_list = faculty_service.get_multi(db, skip=0, limit=10000, filters=filters)

        if not faculty_list:
            raise HTTPException(
                status_code=404,
                detail="No faculty found matching the specified criteria"
            )

        # Generate export file
        export_file = import_service.export_faculty_excel(db, faculty_list)

        # Generate filename with timestamp
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"faculty_export_{timestamp}.xlsx"

        # Return as downloadable file
        return StreamingResponse(
            io.BytesIO(export_file.getvalue()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Export failed: {str(e)}"
        )


# ====================================
# WORKLOAD AND STATISTICS
# ====================================

@router.get("/{faculty_id}/workload")
def get_faculty_workload(
    faculty_id: UUID,
    semester: Optional[str] = Query(None, description="Specific semester"),
    db: Session = Depends(get_db)
):
    """
    Get detailed workload information for a faculty member.

    Returns current course assignments, total hours, and availability.
    """
    workload_info = faculty_service.get_workload(db, faculty_id)

    if not workload_info:
        raise HTTPException(
            status_code=404,
            detail="Faculty not found or workload calculation failed"
        )

    return workload_info


@router.get("/stats/department/{department_id}")
def get_department_faculty_stats(
    department_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get faculty statistics for a department.

    Returns counts, workload distribution, and other departmental metrics.
    """
    from sqlalchemy import func
    from app.models import Department

    # Verify department exists
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.deleted_at.is_(None)
    ).first()

    if not department:
        raise HTTPException(
            status_code=404,
            detail="Department not found"
        )

    # Get all faculty in department
    faculty_list = faculty_service.get_by_department(db, department_id, skip=0, limit=1000)

    # Calculate statistics
    total_faculty = len(faculty_list)
    active_faculty = total_faculty  # All non-deleted faculty are considered active

    workloads = []
    overloaded_count = 0
    underutilized_count = 0

    for faculty in faculty_list:
        workload_info = faculty_service.get_workload(db, faculty.id)
        if workload_info:
            utilization = workload_info["utilization_percentage"]
            workloads.append(utilization)

            if workload_info["overloaded"]:
                overloaded_count += 1
            elif utilization < 50:  # Consider less than 50% as underutilized
                underutilized_count += 1

    # Calculate average workload
    average_workload = sum(workloads) / len(workloads) if workloads else 0.0

    return {
        "department_id": str(department_id),
        "department_name": department.name,
        "department_code": department.code,
        "total_faculty": total_faculty,
        "active_faculty": active_faculty,
        "average_workload": round(average_workload, 2),
        "overloaded_faculty": overloaded_count,
        "underutilized_faculty": underutilized_count,
        "faculty_distribution": {
            "underutilized": underutilized_count,
            "normal": total_faculty - overloaded_count - underutilized_count,
            "overloaded": overloaded_count
        }
    }