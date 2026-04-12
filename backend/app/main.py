"""
Main FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import settings
from app.api.v1 import (
    auth,
    institutions,
    departments,
    faculty,
    courses,
    batches,
    rooms,
    slots,
    timetables,
    requests,
    analytics,
    issues,
    simple_timetable,
    snapshots,
)

# Configure logging so all modules (especially simple_solver) print to console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

# Create FastAPI application instance
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Timetable Scheduler Backend API with CP-SAT optimization",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)


@app.on_event("startup")
async def auto_create_snapshots_table():
    """
    Auto-create the user_timetable_snapshots table on startup if it doesn't exist.
    This removes the need for a manual SQL migration step.
    """
    try:
        from app.db.session import SessionLocal
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS user_timetable_snapshots (
                    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id             UUID NOT NULL,
                    timetable_id        UUID REFERENCES timetables(id) ON DELETE SET NULL,
                    institution_name    TEXT DEFAULT 'My School',
                    created_at          TIMESTAMP DEFAULT NOW(),
                    updated_at          TIMESTAMP DEFAULT NOW(),
                    institution_data    JSONB DEFAULT '{}'::JSONB,
                    classes_data        JSONB DEFAULT '[]'::JSONB,
                    subjects_data       JSONB DEFAULT '[]'::JSONB,
                    teachers_data       JSONB DEFAULT '[]'::JSONB,
                    time_data           JSONB DEFAULT '{}'::JSONB,
                    rooms_data          JSONB DEFAULT '[]'::JSONB,
                    constraints_data    JSONB DEFAULT '{}'::JSONB,
                    generated_timetable JSONB DEFAULT '{}'::JSONB
                )
            """))
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_snapshots_user_id
                    ON user_timetable_snapshots(user_id)
            """))
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_snapshots_user_created
                    ON user_timetable_snapshots(user_id, created_at DESC)
            """))
            db.commit()
            logging.getLogger(__name__).info("✅ user_timetable_snapshots table ready")
        except Exception as e:
            db.rollback()
            logging.getLogger(__name__).warning(f"⚠ Snapshots table setup: {e}")
        finally:
            db.close()
    except Exception as e:
        logging.getLogger(__name__).warning(f"⚠ DB not available at startup: {e}")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


# Include API v1 routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(institutions.router, prefix=f"{settings.API_V1_STR}/institutions", tags=["Institutions"])
app.include_router(departments.router, prefix=f"{settings.API_V1_STR}/departments", tags=["Departments"])
app.include_router(faculty.router, prefix=f"{settings.API_V1_STR}/faculty", tags=["Faculty"])
app.include_router(courses.router, prefix=f"{settings.API_V1_STR}/courses", tags=["Courses"])
app.include_router(batches.router, prefix=f"{settings.API_V1_STR}/batches", tags=["Batches"])
app.include_router(rooms.router, prefix=f"{settings.API_V1_STR}/rooms", tags=["Rooms"])
app.include_router(slots.router, prefix=f"{settings.API_V1_STR}/slots", tags=["Slots"])
app.include_router(timetables.router, prefix=f"{settings.API_V1_STR}/timetables", tags=["Timetables"])
app.include_router(requests.router, prefix=f"{settings.API_V1_STR}/requests", tags=["Change Requests"])
app.include_router(analytics.router, prefix=f"{settings.API_V1_STR}/analytics", tags=["Analytics"])
app.include_router(issues.router, prefix=f"{settings.API_V1_STR}/issues", tags=["Issue Reports"])
app.include_router(simple_timetable.router, prefix=f"{settings.API_V1_STR}/timetable", tags=["Simple Timetable"])
app.include_router(snapshots.router,         prefix=f"{settings.API_V1_STR}/snapshots",  tags=["Snapshots"])


@app.get("/")
def root():
    """
    Root endpoint. Redirects to API documentation.
    """
    return {
        "message": "Timetable Scheduler API",
        "docs": f"{settings.API_V1_STR}/docs",
        "version": settings.VERSION,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development,
    )
