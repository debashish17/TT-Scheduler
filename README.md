<div align="center">

# 🗓️ TT-Scheduler

**AI-powered timetable generation for educational institutions**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)

*Constraint-based scheduling powered by Google OR-Tools CP-SAT — no more spreadsheet nightmares.*

</div>

---

## ✨ What It Does

TT-Scheduler automates the most painful part of academic administration — building conflict-free timetables. It takes your institution's rooms, faculty, batches, and courses, and produces optimal schedules in seconds using a constraint satisfaction solver.

| Capability                     | Details                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| 🔢**CP-SAT Solver**      | 8 hard constraints — no clashes, capacity, workload, lab blocks  |
| 🧭**Guided Onboarding**  | 7-step wizard: institution → departments → rooms → constraints |
| 📊**Multiple Views**     | Grid, Faculty, Room, and Batch schedule views                     |
| ⚡**Real-time Progress** | Live generation tracking with solution comparison                 |
| 🔄**Change Requests**    | Faculty leave, class cancellations, admin approvals               |
| 📥**Excel Import**       | Bulk import faculty and courses from spreadsheets                 |

---

## 🏗️ Architecture

```
TTS/
├── backend/                  # FastAPI + Python
│   └── app/
│       ├── api/v1/           # REST endpoints
│       ├── models/           # SQLAlchemy ORM (18 tables)
│       ├── schemas/          # Pydantic v2 validation
│       ├── services/         # Business logic
│       ├── optimization/     # CP-SAT constraint solver
│       └── tasks/            # Celery background jobs
├── frontend/                 # React + Vite + Tailwind
│   └── src/
│       ├── components/
│       │   ├── onboarding/   # 7-step setup flow
│       │   └── timetable/    # Views & generation UI
│       └── App.jsx
└── docs/                     # Guides & references
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+** · **Node.js 16+** · **Redis** · **Supabase** (or local PostgreSQL)

### 1 — Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate        # Windows
source venv/bin/activate       # Mac / Linux

# Install & configure
pip install -r requirements.txt
cp .env.example .env           # → fill in your credentials

# Migrate & run
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

> Start the Celery worker in a separate terminal:
>
> ```bash
> celery -A app.core.celery_app worker --loglevel=info
> ```

### 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3 — Access

|                        | URL                                |
| ---------------------- | ---------------------------------- |
| 🌐**App**        | http://localhost:5173              |
| 📄**Swagger UI** | http://localhost:8000/api/v1/docs  |
| 📘**ReDoc**      | http://localhost:8000/api/v1/redoc |

---

## ⚙️ Environment Variables

Create `backend/.env` from `.env.example` and set:

```env
SUPABASE_URL=          # Your Supabase project URL
SUPABASE_KEY=          # Supabase anon key
SUPABASE_SERVICE_KEY=  # Supabase service role key
DATABASE_URL=          # PostgreSQL connection string
SECRET_KEY=            # Run: openssl rand -hex 32
```

---

## 🧠 Constraint Engine

The CP-SAT solver enforces **8 hard constraints** on every generated timetable:

| # | Constraint          | Rule                                                   |
| - | ------------------- | ------------------------------------------------------ |
| 1 | `FacultyOverlap`  | No faculty teaches two classes at the same time        |
| 2 | `RoomOverlap`     | No room hosts two classes simultaneously               |
| 3 | `BatchOverlap`    | No batch attends two classes simultaneously            |
| 4 | `RoomCapacity`    | Room size ≥ batch enrollment                          |
| 5 | `CourseHours`     | Each course receives its required contact hours        |
| 6 | `FacultyWorkload` | Faculty hours stay within contract limits              |
| 7 | `RoomFeatures`    | Rooms match course requirements (lab, projector, etc.) |
| 8 | `LabConsecutive`  | Lab sessions are always back-to-back                   |

---

## 🛠️ Tech Stack

| Layer              | Technology                                       |
| ------------------ | ------------------------------------------------ |
| **Frontend** | React 18, Vite, Tailwind CSS, React Router 6     |
| **Backend**  | FastAPI 0.109, SQLAlchemy 2, Pydantic 2, Alembic |
| **Database** | PostgreSQL · Supabase                           |
| **Solver**   | Google OR-Tools CP-SAT 9.8                       |
| **Jobs**     | Celery 5.3 + Redis                               |
| **Auth**     | JWT via python-jose                              |

---

## 📡 Key API Endpoints

```
POST   /api/v1/auth/register            Register a new user
POST   /api/v1/auth/login               Login
POST   /api/v1/timetables/generate      Trigger timetable generation
GET    /api/v1/timetables/jobs/{id}     Poll job status
GET    /api/v1/timetables/{id}/grid     Fetch timetable grid
POST   /api/v1/faculty/import           Bulk import via Excel
POST   /api/v1/requests/leave           Submit faculty leave request
```

---

## 🧪 Development

```bash
# Run tests (activate venv first)
pytest tests/ -v

# Format
black app/ && isort app/

# Type check
mypy app/
```

---

## 🚀 Deployment

For full deployment instructions (Render + Vercel), see [DEPLOYMENT.md](./DEPLOYMENT.md).

> ⚠️ `DEPLOYMENT.md` is listed in `.gitignore` and is not committed to the repository.

---
