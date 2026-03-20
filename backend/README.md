# Timetable Scheduler Backend

Production-ready backend for automated timetable generation using CP-SAT optimization.

## Tech Stack

- **Framework**: FastAPI 0.109.0
- **Database**: PostgreSQL (via Supabase)
- **ORM**: SQLAlchemy 2.0.25
- **Optimization**: Google OR-Tools (CP-SAT) 9.8.3296
- **Background Jobs**: Celery 5.3.6 + Redis
- **Authentication**: JWT (python-jose)
- **Validation**: Pydantic 2.5.3

## Project Structure

```
backend/
├── app/
│   ├── api/v1/              # API route handlers
│   ├── core/                # Core configuration
│   ├── db/                  # Database connection
│   ├── models/              # SQLAlchemy ORM models
│   ├── schemas/             # Pydantic validation schemas
│   ├── services/            # Business logic layer
│   ├── optimization/        # CP-SAT timetable generation
│   ├── tasks/               # Celery background tasks
│   └── utils/               # Utility functions
├── tests/                   # Test suite
├── alembic/                 # Database migrations
└── requirements.txt         # Python dependencies
```

## Setup Instructions

### 1. Prerequisites

- Python 3.11+
- PostgreSQL database (Supabase recommended)
- Redis server (for Celery)
- Git

### 2. Create Virtual Environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env` and update with your credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Supabase anon key
- `SUPABASE_SERVICE_KEY`: Supabase service role key
- `DATABASE_URL`: PostgreSQL connection string from Supabase
- `SECRET_KEY`: Generate with `openssl rand -hex 32`

### 5. Setup Database

Run the database migration script in Supabase SQL Editor:
```bash
alembic/versions/001_initial_schema.sql
```

### 6. Run Database Migrations

```bash
alembic upgrade head
```

### 7. Start the Application

```bash
# Development mode
uvicorn app.main:app --reload --port 8000

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 8. Start Celery Worker

```bash
celery -A app.core.celery_app worker --loglevel=info
```

### 9. Start Redis (if not already running)

```bash
# Windows (with Redis installed)
redis-server

# Linux/Mac
redis-server
```

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/api/v1/docs
- **ReDoc**: http://localhost:8000/api/v1/redoc
- **OpenAPI JSON**: http://localhost:8000/api/v1/openapi.json

## Implementation Status

### Phase 1: Project Setup ✅ COMPLETED
- [x] Project structure created
- [x] Dependencies configured
- [x] Environment configuration
- [x] Database session management
- [x] FastAPI application with CORS

### Phase 2: Database ⏳ IN PROGRESS
- [ ] Database schema SQL file
- [ ] SQLAlchemy models (18 tables)
- [ ] Alembic migrations

### Phase 3: Authentication ⏳ PENDING
- [ ] JWT implementation
- [ ] Password hashing
- [ ] Auth routes (login, register, /me)
- [ ] Role-based access control

### Phase 4: CRUD Operations ⏳ PENDING
- [ ] Institution, Department CRUD
- [ ] Faculty CRUD + Excel import
- [ ] Course CRUD + Excel import
- [ ] Batch, Room, Slot CRUD

### Phase 5: Excel Import ⏳ PENDING
- [ ] Import service
- [ ] Template generation
- [ ] Validation and error reporting

### Phase 6: Optimization Engine ⏳ PENDING
- [ ] 8 hard constraints
- [ ] Data loader
- [ ] CP-SAT solver
- [ ] Solution builder
- [ ] Metrics calculation

### Phase 7: Celery Background Jobs ⏳ PENDING
- [ ] Celery configuration
- [ ] Timetable generation task
- [ ] Job status tracking

### Phase 8: Workflows ⏳ PENDING
- [ ] Setup workflow
- [ ] Semester setup workflow
- [ ] Generation workflow
- [ ] Change request workflow
- [ ] Student view workflow

## Development Workflow

### Running Tests

```bash
pytest tests/ -v
```

### Code Formatting

```bash
black app/
isort app/
```

### Type Checking

```bash
mypy app/
```

## Database Schema

The system uses 18 core tables:

1. **institutions** - Educational institutions
2. **departments** - Academic departments
3. **users** - System users (admin, faculty, students)
4. **faculty** - Faculty members
5. **student_batches** - Student batches/groups
6. **courses** - Course definitions
7. **course_sections** - Multiple sections of courses
8. **predefined_slots** - Time slot definitions
9. **classrooms** - Room inventory
10. **timetables** - Generated timetables
11. **timetable_entries** - Individual class assignments
12. **custom_constraints** - Institution-specific constraints
13. **faculty_preferences** - Faculty scheduling preferences
14. **change_requests** - Modification requests
15. **notifications** - System notifications
16. **audit_logs** - Activity audit trail
17. **students** - Student records
18. **issue_reports** - Issue/problem reports

## CP-SAT Hard Constraints

The optimization engine implements 8 hard constraints:

1. **FacultyOverlapConstraint** - No faculty teaches two classes simultaneously
2. **RoomOverlapConstraint** - No room hosts two classes simultaneously
3. **BatchOverlapConstraint** - No batch has two classes simultaneously
4. **RoomCapacityConstraint** - Room capacity ≥ batch size
5. **CourseHoursConstraint** - Each course gets required hours
6. **FacultyWorkloadConstraint** - Faculty total hours ≤ max hours
7. **RoomFeaturesConstraint** - Room has required features
8. **LabConsecutiveConstraint** - Lab sessions in consecutive slots

## API Endpoints Overview

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user

### Institutions & Departments
- `GET /api/v1/institutions` - List institutions
- `POST /api/v1/institutions` - Create institution
- `GET /api/v1/departments` - List departments
- `POST /api/v1/departments` - Create department

### Faculty & Courses
- `GET /api/v1/faculty` - List faculty
- `POST /api/v1/faculty` - Create faculty
- `POST /api/v1/faculty/import` - Import from Excel
- `GET /api/v1/courses` - List courses
- `POST /api/v1/courses` - Create course

### Timetable Generation
- `POST /api/v1/timetables/generate` - Start generation job
- `GET /api/v1/timetables/jobs/{job_id}` - Check job status
- `GET /api/v1/timetables/{id}` - Get timetable
- `GET /api/v1/timetables/{id}/grid` - Get grid view

### Change Requests
- `POST /api/v1/requests/cancel` - Cancel class request
- `POST /api/v1/requests/leave` - Faculty leave request
- `PUT /api/v1/requests/{id}/approve` - Approve request

## Contributing

1. Follow the phase-by-phase implementation plan
2. Write tests for all new features
3. Update API documentation
4. Follow PEP 8 style guide

## License

MIT License

## Support

For issues and questions, please open a GitHub issue.
