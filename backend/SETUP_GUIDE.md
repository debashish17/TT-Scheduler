# Timetable Scheduler Backend - Quick Setup Guide

## Phase 2 Complete ✅

You now have a fully functional backend structure with:
- ✅ Complete database schema (18 tables)
- ✅ All 18 SQLAlchemy ORM models
- ✅ Basic CRUD API endpoints (no auth required for now)
- ✅ Alembic migration setup
- ✅ Docker configuration

## Quick Start (3 Steps)

### Step 1: Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your Supabase credentials:
# - SUPABASE_URL
# - SUPABASE_KEY
# - SUPABASE_SERVICE_KEY
# - DATABASE_URL (from Supabase)
# - SECRET_KEY (generate with: openssl rand -hex 32)
```

### Step 2: Create Database Schema

**Option A: Run SQL directly in Supabase**
1. Go to your Supabase project → SQL Editor
2. Copy the contents of `alembic/versions/001_initial_schema.sql`
3. Run the SQL script

**Option B: Use Alembic (after database exists)**
```bash
# Initialize alembic (first time only)
alembic revision --autogenerate -m "Initial schema"

# Apply migrations
alembic upgrade head
```

### Step 3: Run the Application

**Option A: Local Development**
```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --port 8000
```

**Option B: Docker**
```bash
# Build and run
docker-compose up --build

# Or run in background
docker-compose up -d
```

## Access the Application

- **API Documentation**: http://localhost:8000/api/v1/docs
- **Alternative Docs**: http://localhost:8000/api/v1/redoc
- **Health Check**: http://localhost:8000/health

## Available API Endpoints (No Auth Required)

### Institutions
- `GET /api/v1/institutions` - List all institutions
- `POST /api/v1/institutions` - Create institution
- `GET /api/v1/institutions/{id}` - Get specific institution
- `DELETE /api/v1/institutions/{id}` - Delete institution

### Departments
- `GET /api/v1/departments?institution_id={id}` - List departments
- `POST /api/v1/departments` - Create department

### Faculty
- `GET /api/v1/faculty?department_id={id}` - List faculty
- `POST /api/v1/faculty` - Create faculty member

### Courses
- `GET /api/v1/courses?department_id={id}` - List courses
- `POST /api/v1/courses` - Create course

### Student Batches
- `GET /api/v1/batches?department_id={id}` - List batches
- `POST /api/v1/batches` - Create batch

### Classrooms
- `GET /api/v1/rooms?institution_id={id}` - List rooms
- `POST /api/v1/rooms` - Create room

### Time Slots
- `GET /api/v1/slots?institution_id={id}` - List slots
- `POST /api/v1/slots` - Create slot

### Timetables
- `GET /api/v1/timetables?institution_id={id}` - List timetables
- `GET /api/v1/timetables/{id}` - Get timetable with entries
- `POST /api/v1/timetables` - Create timetable

## Testing the API

### Example 1: Create an Institution

```bash
curl -X POST "http://localhost:8000/api/v1/institutions" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "code=INST001&name=Sample University&type=University"
```

### Example 2: Create a Department

```bash
curl -X POST "http://localhost:8000/api/v1/departments" \
  -H "Content-Type": application/x-www-form-urlencoded" \
  -d "institution_id=<institution-uuid>&code=CSE&name=Computer Science"
```

### Example 3: List All Institutions

```bash
curl "http://localhost:8000/api/v1/institutions"
```

## Database Structure

The system has 18 interconnected tables:

**Core Tables:**
1. institutions - Educational institutions
2. departments - Academic departments
3. users - System users (to be enabled with auth)

**People Tables:**
4. faculty - Faculty members
5. students - Student records

**Academic Tables:**
6. student_batches - Student groups
7. courses - Course definitions
8. course_sections - Multi-section courses

**Resource Tables:**
9. classrooms - Physical rooms
10. predefined_slots - Time slot definitions

**Timetable Tables:**
11. timetables - Generated schedules
12. timetable_entries - Individual class assignments

**Configuration Tables:**
13. custom_constraints - Institution-specific rules
14. faculty_preferences - Faculty scheduling preferences

**Workflow Tables:**
15. change_requests - Modification requests

**System Tables:**
16. notifications - User notifications
17. audit_logs - Activity audit trail
18. issue_reports - Problem reports

## Next Steps (Phase 3+)

1. **Authentication** - Add JWT authentication (Phase 3)
2. **Pydantic Schemas** - Create request/response schemas
3. **CRUD Services** - Implement business logic layer
4. **Excel Import** - Add bulk data import
5. **CP-SAT Solver** - Implement timetable generation
6. **Celery Tasks** - Add background job processing
7. **Testing** - Add comprehensive test suite

## Troubleshooting

### Database Connection Error
- Verify your `DATABASE_URL` in `.env`
- Ensure Supabase project is active
- Check if database schema has been created

### Import Errors
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Check Python version: `python --version` (should be 3.11+)

### Port Already in Use
- Change port: `uvicorn app.main:app --port 8001`
- Or kill the process using port 8000

## Support

For issues or questions:
- Check the main README.md
- Review API documentation at `/api/v1/docs`
- Open an issue on GitHub

---

**Status**: ✅ Phase 2 Complete - Basic CRUD APIs Ready
**Next**: Phase 3 - Authentication & Security
