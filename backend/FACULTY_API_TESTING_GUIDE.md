# Faculty API Testing Guide

This guide provides comprehensive testing procedures for the Faculty API endpoints in the TT-Scheduler backend.

## Prerequisites

1. **Database Setup**: Ensure PostgreSQL is running with the schema applied
2. **Backend Server**: FastAPI server should be running on `http://localhost:8000`
3. **Test Data**: Have some institutions and departments created for testing

## API Endpoints Overview

### Base URL: `http://localhost:8000/api/v1/faculty`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List faculty with filtering and search |
| GET | `/{faculty_id}` | Get specific faculty by ID |
| POST | `/` | Create new faculty member |
| PUT | `/{faculty_id}` | Update existing faculty |
| DELETE | `/{faculty_id}` | Delete faculty (soft/hard) |
| POST | `/import` | Import faculty from Excel |
| GET | `/import/template` | Download import template |
| GET | `/import/template/info` | Get template information |
| GET | `/export` | Export faculty to Excel |
| GET | `/{faculty_id}/workload` | Get faculty workload details |
| GET | `/stats/department/{department_id}` | Get department statistics |

## Testing Procedures

### 1. Test Faculty Creation (POST /)

**Test Case 1.1: Valid Faculty Creation**
```bash
curl -X POST "http://localhost:8000/api/v1/faculty/" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "department_id": "YOUR_DEPARTMENT_ID",
  "employee_id": "FAC001",
  "name": "Dr. John Smith",
  "email": "john.smith@university.edu",
  "designation": "Professor",
  "max_hours_per_week": 20,
  "subjects_can_teach": ["Computer Science", "Algorithms"]
}'
```

**Expected Response**: 201 Created with faculty details

**Test Case 1.2: Duplicate Employee ID**
```bash
curl -X POST "http://localhost:8000/api/v1/faculty/" \
-H "Content-Type: application/json" \
-d '{
  "institution_id": "YOUR_INSTITUTION_ID",
  "department_id": "YOUR_DEPARTMENT_ID",
  "employee_id": "FAC001",
  "name": "Dr. Jane Doe",
  "email": "jane.doe@university.edu"
}'
```

**Expected Response**: 400 Bad Request with "Employee ID already exists" error

### 2. Test Faculty Listing (GET /)

**Test Case 2.1: List All Faculty**
```bash
curl "http://localhost:8000/api/v1/faculty/"
```

**Test Case 2.2: Filter by Department**
```bash
curl "http://localhost:8000/api/v1/faculty/?department_id=YOUR_DEPARTMENT_ID"
```

**Test Case 2.3: Search Faculty**
```bash
curl "http://localhost:8000/api/v1/faculty/?q=John"
```

**Test Case 2.4: Pagination**
```bash
curl "http://localhost:8000/api/v1/faculty/?skip=0&limit=5"
```

**Expected Response**: Faculty list with department_code and current_workload populated

### 3. Test Faculty Retrieval (GET /{faculty_id})

**Test Case 3.1: Get Faculty Without Workload**
```bash
curl "http://localhost:8000/api/v1/faculty/YOUR_FACULTY_ID"
```

**Test Case 3.2: Get Faculty With Workload**
```bash
curl "http://localhost:8000/api/v1/faculty/YOUR_FACULTY_ID?include_workload=true"
```

**Expected Response**: Faculty details with workload calculations when requested

### 4. Test Faculty Update (PUT /{faculty_id})

**Test Case 4.1: Partial Update**
```bash
curl -X PUT "http://localhost:8000/api/v1/faculty/YOUR_FACULTY_ID" \
-H "Content-Type: application/json" \
-d '{
  "max_hours_per_week": 22,
  "subjects_can_teach": ["Computer Science", "Algorithms", "Data Structures"]
}'
```

**Expected Response**: 200 OK with updated faculty details

### 5. Test Faculty Deletion (DELETE /{faculty_id})

**Test Case 5.1: Soft Delete**
```bash
curl -X DELETE "http://localhost:8000/api/v1/faculty/YOUR_FACULTY_ID"
```

**Test Case 5.2: Hard Delete**
```bash
curl -X DELETE "http://localhost:8000/api/v1/faculty/YOUR_FACULTY_ID?hard_delete=true"
```

**Expected Response**: 204 No Content

### 6. Test Workload Calculation (GET /{faculty_id}/workload)

**Test Case 6.1: Get Faculty Workload**
```bash
curl "http://localhost:8000/api/v1/faculty/YOUR_FACULTY_ID/workload"
```

**Expected Response**: Detailed workload information including:
- Assigned hours
- Available hours
- Course assignments
- Utilization percentage
- Overloaded status

### 7. Test Department Statistics (GET /stats/department/{department_id})

**Test Case 7.1: Get Department Faculty Stats**
```bash
curl "http://localhost:8000/api/v1/faculty/stats/department/YOUR_DEPARTMENT_ID"
```

**Expected Response**: Department statistics including:
- Total faculty count
- Average workload
- Overloaded/underutilized faculty counts
- Faculty distribution

### 8. Test Excel Import Template (GET /import/template)

**Test Case 8.1: Download Template**
```bash
curl -o faculty_template.xlsx "http://localhost:8000/api/v1/faculty/import/template"
```

**Test Case 8.2: Get Template Info**
```bash
curl "http://localhost:8000/api/v1/faculty/import/template/info"
```

**Expected Response**: Excel file download and template metadata

### 9. Test Excel Import (POST /import)

**Test Case 9.1: Valid Excel Import**

1. Download the template from Test Case 8.1
2. Fill in sample data:
   - employee_id: FAC002
   - name: Dr. Sarah Wilson
   - email: sarah.wilson@university.edu
   - department_code: CSE (ensure this exists)
   - designation: Assistant Professor
   - max_hours_per_week: 18

```bash
curl -X POST "http://localhost:8000/api/v1/faculty/import?institution_id=YOUR_INSTITUTION_ID" \
-F "file=@faculty_data.xlsx"
```

**Expected Response**: Import results with success/failure counts and detailed error reporting

**Test Case 9.2: Invalid Excel Import**
- Upload a file with missing required columns
- Upload a file with invalid department codes
- Upload a file with duplicate employee IDs

### 10. Test Excel Export (GET /export)

**Test Case 10.1: Export All Faculty**
```bash
curl -o faculty_export.xlsx "http://localhost:8000/api/v1/faculty/export"
```

**Test Case 10.2: Export by Institution**
```bash
curl -o faculty_export_inst.xlsx "http://localhost:8000/api/v1/faculty/export?institution_id=YOUR_INSTITUTION_ID"
```

**Test Case 10.3: Export by Department**
```bash
curl -o faculty_export_dept.xlsx "http://localhost:8000/api/v1/faculty/export?department_id=YOUR_DEPARTMENT_ID"
```

**Expected Response**: Excel file download with formatted faculty data

## Error Scenarios to Test

### 1. Invalid Data Validation
- Empty required fields
- Invalid email formats
- Invalid UUID formats
- Invalid designation values

### 2. Database Constraints
- Non-existent institution/department IDs
- Duplicate employee IDs within institution
- Foreign key violations

### 3. File Upload Errors
- File too large (>10MB)
- Invalid file formats (not Excel)
- Corrupted Excel files
- Missing required columns in Excel

### 4. Edge Cases
- Faculty with no course assignments
- Faculty with maximum utilization
- Department with no faculty
- Empty search results

## Performance Testing

### 1. Large Dataset Handling
- Import 1000+ faculty records
- Export large faculty datasets
- Search with large result sets
- Pagination with large datasets

### 2. Concurrent Operations
- Multiple simultaneous imports
- Concurrent read/write operations
- Bulk operations performance

## API Documentation Testing

### Swagger UI Access
```
http://localhost:8000/docs
```

**Verify:**
- All endpoints are documented
- Request/response schemas are accurate
- Example values are realistic
- Error responses are documented

## Expected Behavioral Validations

### 1. Data Integrity
- Employee IDs are unique within institutions
- Department relationships are maintained
- Workload calculations are accurate
- Soft delete functionality works correctly

### 2. Business Logic
- Overload detection (>max_hours_per_week)
- Underutilization detection (<50% utilization)
- Department statistics calculations
- Search functionality works across all relevant fields

### 3. Security
- Input validation prevents injection attacks
- File upload restrictions are enforced
- Error messages don't expose sensitive information

## Success Criteria

✅ **All CRUD operations work correctly**
✅ **Workload calculations are accurate**
✅ **Excel import/export functions properly**
✅ **Search and filtering work as expected**
✅ **Error handling is comprehensive**
✅ **Performance is acceptable**
✅ **API documentation is complete**

## Next Steps After Testing

1. **Fix any identified issues**
2. **Add missing validations**
3. **Optimize performance bottlenecks**
4. **Enhance error messages**
5. **Proceed to Course and Room API implementation**

---

**Note**: Replace `YOUR_INSTITUTION_ID`, `YOUR_DEPARTMENT_ID`, and `YOUR_FACULTY_ID` with actual UUIDs from your test database.