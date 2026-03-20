# 🧪 Comprehensive API Testing Guide

## Phase 4 Complete ✅
You now have a robust API with:
- ✅ Pydantic validation schemas
- ✅ Service layer with business logic
- ✅ Comprehensive error handling
- ✅ Advanced Institution API endpoints

## Quick Start Testing

### 1. Start the Application

```bash
cd /c/Users/ASUS/Desktop/TT-Scheduler/backend

# Ensure .env is configured
cp .env.example .env
# Edit .env with your Supabase credentials

# Install & run
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Access API Documentation

**NEW**: The API docs now show detailed validation rules!
- **Swagger UI**: http://localhost:8000/api/v1/docs
- **ReDoc**: http://localhost:8000/api/v1/redoc

## 🎯 Test the Enhanced Institution API

### Test 1: Create Institution (With Validation)

**Valid Request:**
```bash
curl -X POST "http://localhost:8000/api/v1/institutions" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "MIT",
    "name": "Massachusetts Institute of Technology",
    "type": "University",
    "location": {
      "address": "77 Massachusetts Ave",
      "city": "Cambridge",
      "state": "MA",
      "country": "USA",
      "zip_code": "02139"
    },
    "contact": {
      "phone": "+1-617-253-1000",
      "email": "info@mit.edu",
      "website": "https://web.mit.edu"
    },
    "settings": {
      "academic_year_start": "September",
      "default_class_duration": 60,
      "max_classes_per_day": 8
    }
  }'
```

**Expected Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-03-19T15:30:00Z",
  "updated_at": "2024-03-19T15:30:00Z",
  "code": "MIT",
  "name": "Massachusetts Institute of Technology",
  "type": "University",
  "location": { /* location data */ },
  "contact": { /* contact data */ },
  "settings": { /* settings data */ }
}
```

### Test 2: Test Validation Errors

**Invalid Code (too short):**
```bash
curl -X POST "http://localhost:8000/api/v1/institutions" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "M",
    "name": "Test University",
    "type": "University"
  }'
```

**Expected Error:**
```json
{
  "detail": [
    {
      "loc": ["body", "code"],
      "msg": "ensure this value has at least 2 characters",
      "type": "value_error.any_str.min_length"
    }
  ]
}
```

**Invalid Type:**
```bash
curl -X POST "http://localhost:8000/api/v1/institutions" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TEST123",
    "name": "Test Institution",
    "type": "Invalid Type"
  }'
```

**Expected Error:**
```json
{
  "detail": [
    {
      "loc": ["body", "type"],
      "msg": "Type must be one of: University, College, Institute, School, Academy, Polytechnic, Community College",
      "type": "value_error"
    }
  ]
}
```

### Test 3: Duplicate Code Handling

**Try to create duplicate:**
```bash
curl -X POST "http://localhost:8000/api/v1/institutions" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "MIT",
    "name": "Another MIT",
    "type": "University"
  }'
```

**Expected Error:**
```json
{
  "detail": "Institution code 'MIT' already exists"
}
```

### Test 4: Get Institution by Code

```bash
curl "http://localhost:8000/api/v1/institutions/code/MIT"
```

### Test 5: Update Institution

```bash
curl -X PUT "http://localhost:8000/api/v1/institutions/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Massachusetts Institute of Technology - Updated",
    "settings": {
      "academic_year_start": "August",
      "default_class_duration": 75
    }
  }'
```

### Test 6: Search Institutions

```bash
# Search by name
curl "http://localhost:8000/api/v1/institutions?q=MIT"

# Filter by type
curl "http://localhost:8000/api/v1/institutions?institution_type=University"

# Pagination
curl "http://localhost:8000/api/v1/institutions?skip=0&limit=10"
```

### Test 7: Get Institution Statistics

```bash
curl "http://localhost:8000/api/v1/institutions/550e8400-e29b-41d4-a716-446655440000/stats"
```

**Expected Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-03-19T15:30:00Z",
  "updated_at": "2024-03-19T15:30:00Z",
  "code": "MIT",
  "name": "Massachusetts Institute of Technology",
  "departments": 5,
  "faculty": 120,
  "courses": 450,
  "students": 2500,
  "active_timetables": 2,
  "last_timetable_generated": "2024-03-15T10:00:00Z"
}
```

### Test 8: Soft Delete and Restore

**Delete:**
```bash
curl -X DELETE "http://localhost:8000/api/v1/institutions/550e8400-e29b-41d4-a716-446655440000"
```

**Restore:**
```bash
curl -X POST "http://localhost:8000/api/v1/institutions/550e8400-e29b-41d4-a716-446655440000/restore"
```

## 📊 What's Different in Phase 4?

### Before (Phase 2):
```bash
# Old endpoint - basic, no validation
curl -X POST "http://localhost:8000/api/v1/institutions" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "code=TEST&name=Test&type=Whatever"
```
- ❌ No input validation
- ❌ No error handling
- ❌ Basic response format
- ❌ No business logic

### After (Phase 4):
```bash
# New endpoint - robust, validated
curl -X POST "http://localhost:8000/api/v1/institutions" \
  -H "Content-Type: application/json" \
  -d '{"code":"TEST","name":"Test University","type":"University"}'
```
- ✅ Comprehensive input validation
- ✅ Proper error messages
- ✅ Rich response schemas
- ✅ Business logic in services
- ✅ Search and filtering
- ✅ Statistics endpoints
- ✅ Soft delete/restore

## 🔧 Advanced Features to Test

### 1. Validation Rules
- **Code**: 2-20 chars, alphanumeric + `_-`, auto-uppercase
- **Name**: 3-255 chars, required
- **Type**: Must be from allowed list
- **Email**: Must be valid email format (in contact)

### 2. Business Logic
- Automatic code uppercase conversion
- Duplicate checking with helpful errors
- Soft delete support
- Related entity counting

### 3. API Features
- Pagination with skip/limit
- Search by name or code
- Filter by type
- Include/exclude statistics
- Detailed error responses

## 🚀 Next: Test Other Entities

The same pattern applies to other entities. Try:

**Departments:**
```bash
curl "http://localhost:8000/api/v1/departments"
```

**Faculty:**
```bash
curl "http://localhost:8000/api/v1/faculty"
```

**Courses:**
```bash
curl "http://localhost:8000/api/v1/courses"
```

## ⚠️ Error Testing Checklist

Test these scenarios to see robust error handling:

- [ ] Missing required fields
- [ ] Invalid field formats
- [ ] Duplicate codes
- [ ] Non-existent IDs
- [ ] Invalid UUIDs
- [ ] Constraint violations
- [ ] Large payloads
- [ ] Invalid JSON

## 📈 Performance Testing

```bash
# Create multiple institutions
for i in {1..10}; do
  curl -X POST "http://localhost:8000/api/v1/institutions" \
    -H "Content-Type: application/json" \
    -d "{\"code\":\"INST$i\",\"name\":\"Institution $i\",\"type\":\"University\"}" &
done
wait

# List them all
curl "http://localhost:8000/api/v1/institutions?limit=20"
```

## 🎉 Success Indicators

If everything works, you should see:
- ✅ Detailed validation error messages
- ✅ Proper HTTP status codes
- ✅ Rich JSON responses
- ✅ Search and filtering working
- ✅ Statistics endpoints returning data
- ✅ Soft delete/restore working

---

**Phase 4 Status**: ✅ Complete - Robust API with validation, services, and advanced features
**Next Phase**: Continue with more entities or jump to optimization engine!
