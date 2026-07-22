"""
app/api/project.py
===================
Three routers in one file (all project-level concerns):

  auth_router    — /api/v1/auth/login, /api/v1/auth/demo-login
  project_router — /api/v1/projects  (CRUD)
  report_router  — /api/v1/report/generate, /api/v1/report/download/{id}

Error messages are written in plain English so non-technical users
understand what went wrong and what to do next.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# create_access_token is defined in security.py; deps.py re-exports it
from app.api.deps import (
    create_access_token,
    get_db,
    require_auth,
    CanApprove,
)
from app.config import settings
from app.core.security import hash_password, verify_password
from app.models.db import Organisation, Project, Risk, Scenario, Task, User
from app.models.schemas import (
    LoginRequest,
    MessageResponse,
    ProjectCreate,
    ProjectDetail,
    ProjectSummary,
    ReportRequest,
    ReportResponse,
    TokenResponse,
)
from app.services.ai.gemini import gemini
from app.services.report.generator import generate_report


# ─────────────────────────────────────────────────────────────────────────────
# AUTH ROUTER
# ─────────────────────────────────────────────────────────────────────────────
auth_router = APIRouter(prefix="/auth", tags=["Auth"])


@auth_router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in with email + password",
)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a JWT access token valid for
    {access_token_expire_minutes} minutes.
    """
    stmt = select(User).where(User.email == request.email, User.is_active == True)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user or not verify_password(request.password, user.hashed_password or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect. Please try again.",
        )

    token = create_access_token(str(user.id), user.role, str(user.org_id))
    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@auth_router.post(
    "/demo-login",
    response_model=TokenResponse,
    summary="One-click demo login (no registration needed)",
)
async def demo_login(db: AsyncSession = Depends(get_db)):
    """
    Creates a demo organisation and manager account on first call.
    Perfect for hackathon judges — no sign-up form required.
    """
    demo_email = "demo@pii.ai"
    stmt = select(User).where(User.email == demo_email)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        # First call — bootstrap demo tenant
        org = Organisation(
            name="Demo Organisation",
            slug="demo-org",
            plan="starter",
        )
        db.add(org)
        await db.flush()

        user = User(
            org_id=str(org.id),
            email=demo_email,
            hashed_password=hash_password("demo1234"),
            full_name="Demo Manager",
            role="manager",
        )
        db.add(user)
        await db.flush()

    token = create_access_token(str(user.id), user.role, str(user.org_id))
    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


# ─────────────────────────────────────────────────────────────────────────────
# PROJECT ROUTER
# ─────────────────────────────────────────────────────────────────────────────
project_router = APIRouter(prefix="/projects", tags=["Projects"])


@project_router.post(
    "",
    response_model=ProjectDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project",
)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """
    Creates a project under your organisation.
    You can start uploading files immediately after creation.
    """
    project = Project(
        org_id=user.org_id,
        name=body.name,
        description=body.description,
        target_completion_day=body.target_completion_day,
        created_by=user.id,
        status="active",
    )
    db.add(project)
    await db.flush()
    return ProjectDetail.model_validate(project)


@project_router.get(
    "",
    response_model=List[ProjectSummary],
    summary="List all projects in your organisation",
)
async def list_projects(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    rows = (
        await db.execute(
            select(Project)
            .where(Project.org_id == user.org_id, Project.is_deleted == False)
            .order_by(Project.created_at.desc())
        )
    ).scalars().all()
    return [ProjectSummary.model_validate(r) for r in rows]


@project_router.get(
    "/{project_id}",
    response_model=ProjectDetail,
    summary="Get full project details",
)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    project = await db.get(Project, project_id)
    if not project or project.org_id != user.org_id or project.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found. It may have been deleted or you may not have access.",
        )
    return ProjectDetail.model_validate(project)


@project_router.delete(
    "/{project_id}",
    response_model=MessageResponse,
    summary="Archive (soft-delete) a project",
)
async def archive_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = CanApprove,
):
    """
    Soft-deletes the project — data is retained for 30 days
    before permanent deletion. Only managers and admins can archive.
    """
    project = await db.get(Project, project_id)
    if not project or project.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Project not found.")

    project.is_deleted = True
    return MessageResponse(
        message="Project archived successfully.",
        detail="Data will be permanently deleted after 30 days.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# REPORT ROUTER
# ─────────────────────────────────────────────────────────────────────────────
report_router = APIRouter(prefix="/report", tags=["Report"])


@report_router.post(
    "/generate",
    response_model=ReportResponse,
    summary="Generate a PDF project intelligence report",
)
async def generate_project_report(
    request: ReportRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """
    Builds a downloadable PDF report with:
      • Project health summary (Phase 9 — weighted composite score)
      • Risk register (with real task names, not raw IDs)
      • Vendor reliability analysis (Phase 3 — cross-project scoring)
      • Recovery scenarios evaluated
      • Monte Carlo completion forecast
      • AI-written executive narrative (3-layer Gemini → Groq fallback)

    The download link is valid for this session.
    """
    if not settings.feature_pdf_export_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PDF export is currently disabled. Enable it via the feature flags endpoint.",
        )

    project = await db.get(Project, request.project_id)
    if not project or project.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Project not found.")

    # ── Load tasks first — needed for risk task-name lookup + health score ────
    task_rows = (
        await db.execute(select(Task).where(Task.project_id == request.project_id))
    ).scalars().all()
    task_name_by_id = {str(t.id): t.name for t in task_rows}

    # ── Load risks — FIXED: real task name instead of raw task_id ─────────────
    risks = (
        await db.execute(select(Risk).where(Risk.project_id == request.project_id))
    ).scalars().all()
    risk_dicts = [
        {
            "task_name": task_name_by_id.get(str(r.task_id), r.risk_type),
            "risk_type": r.risk_type,
            "severity": r.severity,
            "probability": r.probability,
            "impact_days": r.impact_days,
            "risk_score": r.risk_score,
            "explanation": r.explanation,
        }
        for r in risks
    ]

    # ── FIXED: compute actual risk_level instead of hardcoded "unknown" ───────
    risk_level = "low"
    if risks:
        severities = [r.severity for r in risks]
        if "critical" in severities:
            risk_level = "critical"
        elif "high" in severities:
            risk_level = "high"
        elif "medium" in severities:
            risk_level = "medium"

    # Load scenarios (filter to requested IDs if provided)
    sc_query = select(Scenario).where(Scenario.project_id == request.project_id)
    if request.scenario_ids:
        sc_query = sc_query.where(Scenario.id.in_(request.scenario_ids))
    scenarios = (await db.execute(sc_query)).scalars().all()
    sc_dicts = [
        {
            "title": s.name or s.action_type,
            "action_type": s.action_type,
            "days_saved": s.days_saved or 0,
            "cost_level": "medium",
            "confidence": s.confidence or 0.0,
            "feasibility_score": s.feasibility_score or 0.0,
            "status": s.status,
        }
        for s in scenarios
    ]

    delay = (project.predicted_completion_day or 0) - (project.baseline_completion_day or 0)
    project_dict = {
        "id": str(project.id),
        "name": project.name,
        "completion_pct": project.current_progress,
        "delay_days": max(0, delay),
        "risk_level": risk_level,   # FIXED — was hardcoded "unknown"
        "confidence_score": project.confidence_score or 0.0,
    }

    # ── NEW — Phase 9: Project Health Score for the PDF ────────────────────────
    health_dict = None
    try:
        from app.services.intelligence.graph_engine import ProjectGraphEngine, TaskNode, TaskStatus
        from app.services.intelligence.risk_engine import RiskEngine
        from app.services.intelligence.project_health import compute_project_health

        health_engine = ProjectGraphEngine()
        for t in task_rows:
            health_engine.add_task(TaskNode(
                task_id=str(t.id), name=t.name, duration=t.planned_duration,
                status=TaskStatus(t.status), actual_delay=t.actual_delay,
                completion=t.completion,
            ))
        name_to_id = {t.name: str(t.id) for t in task_rows}
        for t in task_rows:
            for dep_name in (t.depends_on or []):
                dep_id = name_to_id.get(dep_name)
                if dep_id:
                    try:
                        health_engine.add_dependency(dep_id, str(t.id))
                    except ValueError:
                        pass

        graph_result = health_engine.compute_schedule()
        risk_eng = RiskEngine()
        risk_result = risk_eng.analyse(graph_result, health_engine, [])

        hs = compute_project_health(
            graph_result=graph_result, risk_result=risk_result,
            tasks_count=len(task_rows), mc_result=None,
        )
        health_dict = {
            "overall_score":     hs.overall_score,
            "schedule_score":    hs.schedule_score,
            "risk_score":        hs.risk_score,
            "procurement_score": hs.procurement_score,
            "confidence_score":  hs.confidence_score,
            "health_level":      hs.health_level,
            "summary":           hs.summary,
        }
    except Exception:
        pass  # Report still generates without the health section

    # ── NEW — Phase 3: Vendor reliability for the PDF ──────────────────────────
    vendor_scores_list = None
    if settings.feature_vendor_scoring_enabled:
        try:
            from app.services.intelligence.vendor_scorer import compute_vendor_reliability
            scores = await compute_vendor_reliability(db, user.org_id)
            vendor_scores_list = sorted(
                [{"vendor_name": name, **data} for name, data in scores.items()],
                key=lambda v: v["reliability_score"],
            )
        except Exception:
            pass

    # AI narrative (3-layer Gemini → Groq → template fallback, built into gemini.generate())
    narrative = gemini.generate_report_narrative(project_dict, risk_dicts, sc_dicts)

    try:
        pdf_path = generate_report(
            project=project_dict,
            risks=risk_dicts,
            scenarios=sc_dicts,
            ai_narrative=narrative,
            health_score=health_dict,          # NEW
            vendor_scores=vendor_scores_list,   # NEW
            output_dir=settings.storage_local_path,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation failed: {exc}. Please try again.",
        )

    report_id = os.path.basename(pdf_path).rsplit(".", 1)[0]
    return ReportResponse(
        report_id=report_id,
        download_url=f"/api/v1/report/download/{report_id}",
        generated_at=datetime.utcnow(),
    )


@report_router.get(
    "/download/{report_id}",
    summary="Download a previously generated report",
)
async def download_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Streams the PDF file to the browser for download."""
    base_dir = settings.storage_local_path
    
    # Try to extract project_id from report_id (format: report_{project_id}_{timestamp})
    project_name = "project"
    if report_id.startswith("report_"):
        parts = report_id.split("_")
        if len(parts) >= 2:
            project_uuid = parts[1]
            try:
                stmt = select(Project).where(Project.id == project_uuid)
                proj = (await db.execute(stmt)).scalar_one_or_none()
                if proj and proj.name:
                    # convert name to a safe filename
                    project_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in proj.name)
            except Exception:
                pass

    for ext in (".pdf", ".txt"):
        path = os.path.join(base_dir, f"{report_id}{ext}")
        if os.path.exists(path):
            return FileResponse(
                path=path,
                media_type="application/pdf" if ext == ".pdf" else "text/plain",
                filename=f"{project_name}_report{ext}",
            )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=(
            "Report file not found. It may have expired "
            "or the server was restarted. Please generate a new report."
        ),
    )