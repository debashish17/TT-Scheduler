<div align="center">

<img src="https://img.shields.io/badge/STATUS-LIVE-00d4aa?style=for-the-badge&labelColor=0a0a0a" />

# 🗓️ TT-Scheduler

### *Conflict-free timetables in seconds — powered by constraint solving*

[![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=black)](https://supabase.com)
[![OR-Tools](https://img.shields.io/badge/OR--Tools_CP--SAT-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://developers.google.com/optimization)
[![License](https://img.shields.io/badge/License-MIT-a855f7?style=for-the-badge)](LICENSE)

<br/>

> Building a timetable for hundreds of students, dozens of faculty, and limited rooms is an NP-hard combinatorial problem.  
> **TT-Scheduler solves it in under 60 seconds.**

<br/>

**🌐 [Live Demo](https://tt-scheduler.vercel.app)** &nbsp;•&nbsp; **📄 [API Docs](https://tt-scheduler.onrender.com/docs)**

</div>

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🧠 | **CP-SAT Solver** | Google OR-Tools constraint engine with 8 hard constraints — zero clashes, guaranteed |
| 🧭 | **7-Step Onboarding Wizard** | Guided setup: institution → departments → rooms → faculty → subjects → constraints → generate |
| 👤 | **Per-User Persistence** | Full state snapshots saved to Supabase — resume exactly where you left off, across devices |
| 📜 | **Timetable History** | Browse, compare, and restore any of your previously generated timetables |
| 📊 | **Multiple Views** | Grid, Faculty, Room, and Batch views for every generated schedule |
| 📥 | **Excel Import / Export** | Bulk-import faculty & courses from spreadsheets; export timetables to `.xlsx` |
| 🔐 | **Auth via Supabase** | Secure JWT-based authentication with row-level security on all user data |
| 🌙 | **Dark-first UI** | Glass-morphism design built with React + Vite |

---

## 🏗️ Architecture

```
TT-Scheduler/
├── frontend/                   # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── api/                # Axios client — all API calls live here
│   │   ├── components/
│   │   │   ├── onboarding/     # 7-step setup wizard
│   │   │   └── timetable/      # Grid views, history, generation UI
│   │   ├── contexts/           # React context providers
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Supabase client init
│   │   ├── store/              # Global state (Zustand)
│   │   └── utils/
│   └── vercel.json             # SPA rewrite rules for Vercel
│
└── backend/                    # FastAPI + Python 3.11
    └── app/
        ├── api/v1/             # REST endpoints
        ├── core/               # Config, security, dependencies
        ├── db/                 # Database session management
        ├── models/             # SQLAlchemy ORM (18 tables)
        ├── optimization/       # CP-SAT constraint solver
        ├── schemas/            # Pydantic v2 request/response models
        ├── services/           # Business logic layer
        └── tasks/              # Celery background jobs
```

---

## 🧠 Constraint Engine

The CP-SAT solver enforces **8 hard constraints** — if any are violated, the solution is discarded entirely:

| # | Constraint | Rule |
|---|---|---|
| 1 | `FacultyOverlap` | No faculty teaches two classes at the same time |
| 2 | `RoomOverlap` | No room hosts two classes simultaneously |
| 3 | `BatchOverlap` | No batch attends two classes simultaneously |
| 4 | `RoomCapacity` | Room size must be ≥ batch enrollment |
| 5 | `CourseHours` | Each course gets its exact required contact hours |
| 6 | `FacultyWorkload` | Faculty hours stay within contract limits |
| 7 | `RoomFeatures` | Rooms match course requirements (lab, projector, etc.) |
| 8 | `LabConsecutive` | Lab sessions are always scheduled back-to-back |

---

## 🚀 Quick Start (Local)

### Prerequisites

- **Python 3.11+** · **Node.js 18+** · **Supabase project**

### 1 — Clone

```bash
git clone https://github.com/your-username/TT-Scheduler.git
cd TT-Scheduler
```

### 2 — Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate        # Windows
source venv/bin/activate       # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env           # Fill in your credentials (see below)

# Run
uvicorn app.main:app --reload --port 8000
```

### 3 — Frontend

```bash
cd frontend
npm install

# Configure environment
cp .env.example .env           # Fill in your credentials (see below)

npm run dev
```

### 4 — Access

| | URL |
|---|---|
| 🌐 **App** | http://localhost:5173 |
| 📄 **Swagger UI** | http://localhost:8000/docs |
| 📘 **ReDoc** | http://localhost:8000/redoc |

---

## ⚙️ Environment Variables

### Frontend — `frontend/.env`

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://localhost:8000
```

### Backend — `backend/.env`

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
DATABASE_URL=postgresql://user:password@host:5432/dbname
SECRET_KEY=                    # Run: openssl rand -hex 32
BACKEND_CORS_ORIGINS=["http://localhost:5173"]
FRONTEND_URL=http://localhost:5173
```

---

## 🌍 Deployment

The app is deployed at:

| Service | Platform | URL |
|---|---|---|
| **Frontend** | Vercel | [tt-scheduler.vercel.app](https://tt-scheduler.vercel.app) |
| **Backend** | Render | [tt-scheduler.onrender.com](https://tt-scheduler.onrender.com) |
| **Database** | Supabase | Managed PostgreSQL |

### Deploy Your Own

**Frontend → Vercel**
1. Fork this repo
2. Import to Vercel, set **Root Directory** to `frontend`
3. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (your backend URL)

**Backend → Render**
1. Create a new **Web Service** on Render
2. Set **Root Directory** to `backend`
3. **Build Command:** `pip install -r requirements.txt`
4. **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add all backend env variables from the section above
6. Set `BACKEND_CORS_ORIGINS` to include your Vercel frontend URL

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Zustand |
| **Backend** | FastAPI, SQLAlchemy 2, Pydantic v2, Alembic |
| **Database** | PostgreSQL via Supabase |
| **Auth** | Supabase Auth + JWT |
| **Solver** | Google OR-Tools CP-SAT 9.x |
| **Background Jobs** | Celery + Redis |
| **Hosting** | Vercel (frontend) + Render (backend) |

---

## 📡 Key API Endpoints

```
POST   /api/v1/auth/register              Register a new user
POST   /api/v1/auth/login                 Login

POST   /timetable/generate-simple         Generate a timetable (CP-SAT)
POST   /timetable/save                    Save generated timetable to DB
POST   /timetable/export/excel            Export timetable as .xlsx

POST   /snapshots/save                    Save full user state snapshot
GET    /snapshots/latest                  Restore latest session
GET    /snapshots/history                 List all past snapshots
GET    /snapshots/{id}                    Load a specific snapshot

POST   /api/v1/faculty/import             Bulk import via Excel
```

Full interactive docs: **[tt-scheduler.onrender.com/docs](https://tt-scheduler.onrender.com/docs)**

---

## 🧪 Development

```bash
# Backend tests
cd backend
pytest tests/ -v

# Code formatting
black app/ && isort app/

# Type checking
mypy app/
```

---

## 📄 License

MIT © 2026 — built with ☕ and way too much constraint programming.

<div align="center">
<br/>
<a href="https://tt-scheduler.vercel.app"><strong>→ Try it live ←</strong></a>
</div>
