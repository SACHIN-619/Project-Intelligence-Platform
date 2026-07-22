"""
app/main.py
============
FastAPI application factory — single source of truth for:
  • All router registration
  • Middleware stack
  • Startup / shutdown lifecycle
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_tables
from app.core.middleware import add_middleware

# ── Routers ────────────────────────────────────────────────────────────────────
# Phase 1: Auth + Projects + Reports  (project.py exports 3 routers)
from app.api.project import auth_router, project_router, report_router
# Phase 2: File ingestion
from app.api.upload import router as upload_router
# Phase 3: Intelligence + RAG
from app.api.analysis import router as analysis_router
# Phase 4: Recovery simulation
from app.api.simulation import router as simulation_router
# Phase 5: Action management (approve/track)
from app.api.actions import router as actions_router
# Phase 6: Admin, metrics, feature flags
from app.api.admin import router as admin_router
# Phase 7: Real-time WebSocket
from app.api.websocket import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables on startup; clean shutdown."""
    await create_tables()
    print(f"✅  {settings.app_name} v{settings.app_version} ready")
    print(f"    Docs  → http://localhost:8000/docs")
    print(f"    Env   → {settings.environment}")
    yield
    print("👋  Shutting down")


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "AI-powered EPC Project Intelligence Platform.\n\n"
        "Upload project files → detect risks → simulate recovery → export report."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Structured error handling + request logging ────────────────────────────────
add_middleware(app)

# ── Route mounting ─────────────────────────────────────────────────────────────
PREFIX = "/api/v1"

app.include_router(auth_router,       prefix=PREFIX)           # /api/v1/auth/...
app.include_router(project_router,    prefix=PREFIX)           # /api/v1/projects/...
app.include_router(upload_router,     prefix=PREFIX)           # /api/v1/upload/...
app.include_router(analysis_router,   prefix=PREFIX)           # /api/v1/analysis/...
app.include_router(simulation_router, prefix=PREFIX)           # /api/v1/simulation/...
app.include_router(actions_router,    prefix=PREFIX)           # /api/v1/actions/...
app.include_router(admin_router,      prefix=PREFIX)           # /api/v1/admin/...
app.include_router(report_router,     prefix=PREFIX)           # /api/v1/report/...
app.include_router(ws_router,         prefix=PREFIX)           # /api/v1/ws/{project_id}


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "docs": "/docs",
    }


@app.get("/", tags=["Health"])
async def root():
    return {"message": f"Welcome to {settings.app_name}", "docs": "/docs"}