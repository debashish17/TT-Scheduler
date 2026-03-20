"""
Import-specific Pydantic schemas.
Schemas for bulk import operations and results.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ImportError(BaseModel):
    """Individual import error."""
    row: int = Field(..., description="Row number in Excel file")
    error: str = Field(..., description="Error message")
    data: Dict[str, Any] = Field(default_factory=dict, description="Row data that caused the error")


class ImportWarning(BaseModel):
    """Individual import warning."""
    row: int = Field(..., description="Row number in Excel file")
    warning: str = Field(..., description="Warning message")
    data: Dict[str, Any] = Field(default_factory=dict, description="Row data that caused the warning")


class ImportResultResponse(BaseModel):
    """Response schema for import operations."""
    total_processed: int = Field(..., description="Total number of rows processed")
    successful: int = Field(..., description="Number of successfully imported records")
    failed: int = Field(..., description="Number of failed imports")
    success_rate: float = Field(..., description="Success rate as percentage")
    created_records: int = Field(..., description="Number of records created in database")

    errors: List[ImportError] = Field(default_factory=list, description="List of import errors")
    warnings: List[ImportWarning] = Field(default_factory=list, description="List of import warnings")

    # Summary statistics
    has_errors: bool = Field(..., description="Whether there were any errors")
    has_warnings: bool = Field(..., description="Whether there were any warnings")

    class Config:
        schema_extra = {
            "example": {
                "total_processed": 100,
                "successful": 95,
                "failed": 5,
                "success_rate": 95.0,
                "created_records": 95,
                "errors": [
                    {
                        "row": 10,
                        "error": "Employee ID already exists",
                        "data": {"employee_id": "EMP001", "name": "John Doe"}
                    }
                ],
                "warnings": [
                    {
                        "row": 25,
                        "warning": "Faculty not found, course created without faculty",
                        "data": {"code": "CS101", "faculty_employee_id": "FAC999"}
                    }
                ],
                "has_errors": True,
                "has_warnings": True
            }
        }


class ImportTemplate(BaseModel):
    """Metadata about import template."""
    entity_type: str = Field(..., description="Entity type for this template")
    required_columns: List[str] = Field(..., description="Required column names")
    optional_columns: List[str] = Field(..., description="Optional column names")
    sample_data_rows: int = Field(..., description="Number of sample rows included")
    has_validations: bool = Field(..., description="Whether template includes data validations")
    instructions_included: bool = Field(..., description="Whether instructions sheet is included")