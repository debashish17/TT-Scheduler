# Timetable Scheduler

A modern, full-stack timetable scheduling system for educational institutions.

## Project Structure

```
TTS/
├── backend/        # FastAPI backend (Python)
│   ├── app/        # Main backend application
│   ├── alembic/    # Database migrations
│   └── requirements.txt
├── frontend/       # React frontend (Vite + Tailwind)
│   ├── src/        # Main frontend application
│   └── package.json
├── docs/           # Additional documentation and guides
│   └── ...         # Moved markdown guides (except README & SETUP_GUIDE)
├── SETUP_GUIDE.md  # Quick setup instructions
├── README.md       # Project overview (this file)
```

## Quick Start

For detailed setup instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md).

### Backend Setup

1. Navigate to backend:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate   # Windows
   source venv/bin/activate   # Mac/Linux
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   - Copy `.env.example` to `.env` and update values
5. Run the backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Database Setup

- Use Supabase or PostgreSQL
- Run Alembic migrations or SQL scripts as described in SETUP_GUIDE.md

### Frontend Setup

1. Navigate to frontend:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Access

- Frontend: http://localhost:5173
- Backend API Docs: http://localhost:8000/api/v1/docs

## Additional Guides

- See [docs/](docs/) for integration, testing, and advanced usage guides.
- See [SETUP_GUIDE.md](SETUP_GUIDE.md) for step-by-step setup.

## License

MIT License

## Support

For issues or questions, please refer to the inline documentation or open a GitHub issue.

---

# Smart Timetable Scheduler - Frontend

A modern, interactive React frontend for a comprehensive timetable scheduling system for educational institutions.

## Features

### 🎓 Admin Onboarding Flow (7 Steps)

1. **Institution Information** - Basic setup with name, type, and contact details
2. **Workflow Configuration** - Choose between simple or multi-level admin workflow
3. **Department Setup** - Add departments with templates or custom setup
4. **Time Structure** - Define working days, class durations, and break times
5. **Slot Definition** - Create theory and lab slots (VIT-style or plain time slots)
6. **Classroom Setup** - Add rooms, labs, and lecture halls with capacities
7. **Constraints & Rules** - Set faculty, student, and course constraints

### 📊 Timetable Generation

- **Generation Settings** - Configure departments, optimization focus, and advanced options
- **Real-time Progress** - Live progress tracking with detailed logs
- **Solution Comparison** - Compare 3 optimized solutions with detailed metrics:
  - Room Utilization
  - Workload Balance
  - Student Gaps
  - Faculty Preferences
  - Conflict Detection

### 📅 Interactive Timetable Views

- **Grid View** - Full weekly timetable with drag-and-drop editing
- **Faculty View** - Individual faculty schedules with workload visualization
- **Room View** - Room utilization tracking
- **Batch View** - Student batch schedules

### ✨ Key Highlights

- Modern, gradient-based UI design
- Responsive layout for all screen sizes
- Real-time conflict detection
- Interactive editing with modal dialogs
- Export to PDF functionality
- Visual workload distribution charts
- Color-coded status indicators

## Tech Stack

- **React 18** - UI framework
- **React Router 6** - Navigation
- **Tailwind CSS** - Styling
- **React Icons** - Icon library
- **Vite** - Build tool

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open your browser and navigate to:

```
http://localhost:3000
```

### Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist` folder.

## Project Structure

```
src/
├── components/
│   ├── common/
│   │   ├── Header.jsx           # Main header component
│   │   └── ProgressBar.jsx      # Step progress indicator
│   ├── onboarding/
│   │   ├── WelcomeScreen.jsx     # Step 1: Institution info
│   │   ├── WorkflowConfig.jsx    # Step 2: Workflow selection
│   │   ├── DepartmentSetup.jsx   # Step 3: Department setup
│   │   ├── TimeStructure.jsx     # Step 4: Time configuration
│   │   ├── SlotDefinition.jsx    # Step 5: Slot definitions
│   │   ├── ClassroomSetup.jsx    # Step 6: Room management
│   │   ├── Constraints.jsx       # Step 7: Rules & constraints
│   │   └── SetupComplete.jsx     # Setup completion summary
│   └── timetable/
│       ├── GenerationSettings.jsx   # Timetable generation config
│       ├── GenerationProgress.jsx   # Real-time progress tracker
│       ├── SolutionComparison.jsx   # Compare generated solutions
│       ├── TimetableGrid.jsx        # Interactive grid view
│       └── FacultyView.jsx          # Faculty schedule view
├── App.jsx                       # Main app component with routing
├── main.jsx                      # Application entry point
└── index.css                     # Global styles and Tailwind

```

## Navigation Flow

```
/ (redirect to /onboarding/welcome)
│
├── Onboarding Flow
│   ├── /onboarding/welcome
│   ├── /onboarding/workflow
│   ├── /onboarding/departments
│   ├── /onboarding/time-structure
│   ├── /onboarding/slots
│   ├── /onboarding/classrooms
│   ├── /onboarding/constraints
│   └── /onboarding/complete
│
└── Timetable Management
    ├── /timetable/generate
    ├── /timetable/progress
    ├── /timetable/comparison
    ├── /timetable/grid
    └── /timetable/faculty
```

## Key Features Explained

### 1. Multi-Step Onboarding

- Progressive disclosure of information
- Visual progress tracking
- Form validation
- Template-based quick setup

### 2. Intelligent Timetable Generation

- Multiple optimization strategies (Balanced, Room-Focused, Faculty-Friendly)
- Configurable constraints and preferences
- Real-time progress tracking
- Multiple solution generation for comparison

### 3. Interactive Editing

- Click-to-edit functionality
- Real-time conflict detection
- Visual feedback with color coding
- Drag-and-drop support (ready for implementation)

### 4. Comprehensive Views

- Grid view for overall schedule
- Faculty view for individual schedules
- Room utilization tracking
- Workload distribution visualization

## Customization

### Color Scheme

The primary color scheme can be customized in `tailwind.config.js`:

```javascript
colors: {
  primary: {
    50: '#f0f9ff',
    // ... customize colors
    900: '#0c4a6e',
  },
}
```

### Adding New Features

1. Create component in appropriate directory
2. Add route in `App.jsx`
3. Update navigation links
4. Implement functionality

## Mock Data

This is a **frontend-only** implementation with mock data. To connect to a backend:

1. Create API service files in `src/services/`
2. Replace mock data with API calls
3. Add state management (React Context or Redux)
4. Implement authentication
5. Add error handling

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance

- Code splitting with React Router
- Lazy loading for routes (ready to implement)
- Optimized bundle size with Vite
- Responsive images and assets

## Future Enhancements

- [ ] Backend integration
- [ ] Database connectivity
- [ ] User authentication
- [ ] Real-time collaboration
- [ ] Advanced analytics dashboard
- [ ] Mobile app version
- [ ] Excel/PDF import/export
- [ ] Drag-and-drop timetable editing
- [ ] Automated conflict resolution
- [ ] Email notifications

## License

MIT License - Feel free to use this project for educational purposes.

## Author

Created for educational timetable scheduling and management.

## Support

For issues or questions, please refer to the inline documentation in the code.

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

- [X] Project structure created
- [X] Dependencies configured
- [X] Environment configuration
- [X] Database session management
- [X] FastAPI application with CORS

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
