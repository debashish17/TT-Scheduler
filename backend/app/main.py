"""
Main FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import settings
from app.api.v1 import auth, school_timetable, college_timetable, runs, ai_draft

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
app.include_router(auth.router,              prefix=f"{settings.API_V1_STR}/auth",      tags=["Authentication"])
app.include_router(school_timetable.router,  prefix=f"{settings.API_V1_STR}/school",    tags=["School Timetable"])
app.include_router(college_timetable.router, prefix=f"{settings.API_V1_STR}/college",   tags=["College Timetable"])
app.include_router(runs.router,              prefix=f"{settings.API_V1_STR}/runs",      tags=["Runs"])
app.include_router(ai_draft.router,          prefix=f"{settings.API_V1_STR}/timetable", tags=["AI Draft"])


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
