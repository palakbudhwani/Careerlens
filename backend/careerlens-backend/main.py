"""
CareerLens Backend — FastAPI
Run:  uvicorn main:app --reload
Docs: http://localhost:8000/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.database import Base, engine

# Import all models so SQLAlchemy registers them before create_all
import models.user  # noqa: F401

from routers.auth      import router as auth_router
from routers.dashboard import router as dashboard_router
from routers.jobs      import router as jobs_router
from routers.candidate import candidate_router, activity_router

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Backend API for CareerLens — Dashboard, Auth, Jobs & Matching",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS  (allow React dev server) ────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_ORIGIN,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Create DB tables on startup ───────────────────────────────────────────────

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    print(f"✅  Database tables created / verified")


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(jobs_router)
app.include_router(candidate_router)
app.include_router(activity_router)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
