"""
app/api/analysis.py
====================
Project intelligence endpoints — enhanced with:
  - Health score (Phase 9 from discussion)
  - Weather risks in full analysis response
  - Memory-enhanced RAG query (past similar decisions surfaced)
  - Vendor reliability summary in dashboard
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth, CanAnalyse
from app.models.db import Task, Vendor, Risk, Project, User, AuditEvent
from app.models.schemas import (
    AnalysisResult, ProjectHealthDashboard, QueryRequest,
    QueryResponse, RiskSummary, TaskGraphNode, MessageResponse,
)
from app.services.intelligence.graph_engine import ProjectGraphEngine, TaskNode, TaskStatus
from app.services.intelligence.risk_engine import RiskEngine, VendorRiskInput
from app.services.intelligence.montecarlo import MonteCarloEngine, MCConfig
from app.services.ai.gemini import gemini
from app.services.ai.embedding import embedding_service
from app.services.rag.pipeline import RAGPipeline
from app.services.queue.jobs import job_queue, job_run_analysis
from app.config import settings

router = APIRouter(prefix="/analysis", tags=["Analysis"])


# ── Graph builder helper ──────────────────────────────────────────────────────

async def _build_graph(project_id: str, org_id: str, db: AsyncSession) -> ProjectGraphEngine:
    t_rows = (await db.execute(
        select(Task).where(Task.project_id == project_id, Task.org_id == org_id)
    )).scalars().all()

    if not t_rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No tasks found. Please upload a schedule file first.",
        )

    engine = ProjectGraphEngine()
    for t in t_rows:
        engine.add_task(TaskNode(
            task_id=str(t.id),
            name=t.name,
            duration=t.planned_duration,
            status=TaskStatus(t.status),
            actual_delay=t.actual_delay,
            completion=t.completion,
            vendor_id=str(t.vendor_id) if t.vendor_id else None,
            duration_confidence=t.duration_confidence,
        ))

    name_to_id = {t.name: str(t.id) for t in t_rows}
    for t in t_rows:
        for dep_name in (t.depends_on or []):
            dep_id = name_to_id.get(dep_name)
            if dep_id:
                try:
                    engine.add_dependency(dep_id, str(t.id))
                except ValueError:
                    pass

    return engine


# ─────────────────────────────────────────────────────────────────────────────
# FULL ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{project_id}", response_model=AnalysisResult)
async def get_analysis(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = CanAnalyse,
):
    """
    Full project intelligence: CPM + risks + Monte Carlo + health score.
    Now also includes weather risks and vendor reliability summary.
    """
    engine = await _build_graph(project_id, user.org_id, db)
    graph_result = engine.compute_schedule()

    # Vendor risk inputs
    v_rows = (await db.execute(
        select(Vendor).where(Vendor.project_id == project_id)
    )).scalars().all()

    vendor_inputs = [
        VendorRiskInput(
            vendor_id=str(v.id),
            vendor_name=v.name,
            reliability_score=v.reliability_score,
            delivery_status=v.delivery_status,
            lead_time_days=v.lead_time_days or 0,
            expected_arrival_day=v.expected_arrival_day,
        )
        for v in v_rows
    ]

    # ── Vendor history scores ─────────────────────────────────────────────────
    vendor_history = {}
    if settings.feature_vendor_scoring_enabled:
        try:
            from app.services.intelligence.vendor_scorer import compute_vendor_reliability
            vendor_history = await compute_vendor_reliability(db, user.org_id)
        except Exception:
            pass

    risk_engine = RiskEngine(
        low_threshold=settings.risk_threshold_low,
        medium_threshold=settings.risk_threshold_medium,
        high_threshold=settings.risk_threshold_high,
    )
    risk_result = risk_engine.analyse(
        graph_result, engine, vendor_inputs,
        vendor_history_scores=vendor_history,
    )

    # ── Weather risks ─────────────────────────────────────────────────────────
    if settings.feature_weather_agent_enabled:
        try:
            from app.services.intelligence.weather_agent import analyse_weather_risks
            from app.services.intelligence.risk_engine import RiskItem, RiskType, RiskSeverity

            t_rows_all = (await db.execute(
                select(Task).where(Task.project_id == project_id)
            )).scalars().all()

            task_dicts = [
                {
                    "name": t.name,
                    "planned_start": str(t.planned_start_day or ""),
                    "planned_finish": str(t.planned_duration or ""),
                }
                for t in t_rows_all
            ]
            weather_risks = await analyse_weather_risks(
                task_dicts,
                latitude=settings.default_site_latitude,
                longitude=settings.default_site_longitude,
            )
            for wr in weather_risks:
                risk_result.risks.append(RiskItem(
                    task_id=None,
                    task_name=wr["task_name"],
                    risk_type=RiskType.SCHEDULE,
                    severity=RiskSeverity(wr["severity"]),
                    probability=wr["probability"],
                    impact_days=wr["impact_days"],
                    risk_score=wr["risk_score"],
                    explanation=wr["explanation"],
                    confidence=wr["confidence"],
                    evidence_hints=wr.get("evidence_hints", []),
                ))
        except Exception:
            pass

    # ── Monte Carlo ───────────────────────────────────────────────────────────
    mc_p50 = mc_p80 = mc_p90 = mc_on_time = None
    top_sensitivity = None

    if settings.feature_monte_carlo_enabled:
        try:
            mc = MonteCarloEngine(engine, MCConfig(n_simulations=settings.mc_n_simulations))
            mc_result = mc.run()
            mc_p50 = mc_result.p50
            mc_p80 = mc_result.p80
            mc_p90 = mc_result.p90
            mc_on_time = mc_result.on_time_probability
            top_sensitivity = mc.top_sensitivity_tasks(mc_result)
        except Exception:
            pass

    # ── Project Health Score ──────────────────────────────────────────────────
    health_score = None
    health_level = None
    health_summary = None
    try:
        from app.services.intelligence.project_health import compute_project_health
        t_count = len((await db.execute(
            select(Task).where(Task.project_id == project_id)
        )).scalars().all())
        hs = compute_project_health(
            graph_result=graph_result,
            risk_result=risk_result,
            tasks_count=t_count,
            mc_result=None,
        )
        health_score = hs.overall_score
        health_level = hs.health_level
        health_summary = hs.summary
    except Exception:
        pass

    # ── Map to API schema ─────────────────────────────────────────────────────
    task_nodes = [
        TaskGraphNode(
            task_id=tid,
            name=st.name,
            es=st.es,
            ef=st.ef,
            total_float=st.total_float,
            free_float=st.free_float,
            is_critical=st.is_critical,
            actual_delay=st.actual_delay,
            confidence=st.confidence,
        )
        for tid, st in graph_result.scheduled_tasks.items()
    ]

    risk_summaries = [
        RiskSummary(
            id=str(i),
            task_name=r.task_name,
            risk_type=r.risk_type.value,
            severity=r.severity.value,
            probability=r.probability,
            impact_days=r.impact_days,
            risk_score=r.risk_score,
            explanation=r.explanation,
            confidence=r.confidence,
        )
        for i, r in enumerate(risk_result.risks)
    ]

    cp_names = [
        engine.tasks[tid].name
        for tid in graph_result.critical_path
        if tid in engine.tasks
    ]

    delay_breakdown = {
        engine.tasks[tid].name: days
        for tid, days in graph_result.delay_cascade.items()
        if tid in engine.tasks
    }

    return AnalysisResult(
        project_id=project_id,
        completion_day=graph_result.project_completion_day,
        original_completion_day=graph_result.baseline_completion_day,
        total_delay_days=graph_result.total_delay,
        risk_level=risk_result.project_risk_level.value,
        overall_confidence=graph_result.overall_confidence,
        critical_path=cp_names,
        tasks=task_nodes,
        risks=risk_summaries,
        delay_breakdown=delay_breakdown,
        mc_p50=mc_p50,
        mc_p80=mc_p80,
        mc_p90=mc_p90,
        mc_on_time_probability=mc_on_time,
        top_sensitivity_tasks=top_sensitivity,
        health_score=health_score,
        health_level=health_level,
        health_summary=health_summary,
    )


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH DASHBOARD  — lightweight, uses stored values + live risk query
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{project_id}/dashboard", response_model=ProjectHealthDashboard)
async def get_dashboard(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    project = await db.get(Project, project_id)
    if not project or project.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Project not found")

    risks = (await db.execute(
        select(Risk).where(Risk.project_id == project_id, Risk.is_resolved == False)
    )).scalars().all()

    active_risk_count = len(risks)
    risk_level = "low"
    if active_risk_count > 0:
        severities = [r.severity for r in risks]
        if "critical" in severities:
            risk_level = "critical"
        elif "high" in severities:
            risk_level = "high"
        elif "medium" in severities:
            risk_level = "medium"

    delay_days = (
        (project.predicted_completion_day or 0) - (project.baseline_completion_day or 0)
    )

    task_rows = (await db.execute(
        select(Task).where(Task.project_id == project_id)
    )).scalars().all()

    # Hours saved: AI does in ~3 min per task what takes ~30 min manually
    hours_saved = max(0.0, len(task_rows) * (30 - 3) / 60)

    # Pull vendor reliability summary for dashboard
    vendor_risk_summary = None
    if settings.feature_vendor_scoring_enabled and task_rows:
        try:
            from app.services.intelligence.vendor_scorer import (
                compute_vendor_reliability, get_vendor_risk_summary
            )
            scores = await compute_vendor_reliability(db, user.org_id)
            vendor_risk_summary = get_vendor_risk_summary(scores)
        except Exception:
            pass

    # Pull stored health score (computed during last analysis run)
    stored_health = getattr(project, "health_score", None)

    return ProjectHealthDashboard(
        project_id=project_id,
        name=project.name,
        completion_pct=project.current_progress,
        predicted_delay_days=max(0, delay_days),
        risk_level=risk_level,
        confidence=project.confidence_score or 0.0,
        active_risks=active_risk_count,
        active_scenarios=0,
        hours_saved_estimate=round(hours_saved, 1),
        last_analysed=project.updated_at,
        health_score=stored_health,
        vendor_risk_summary=vendor_risk_summary,
        critical_path_summary=[],
    )


# ─────────────────────────────────────────────────────────────────────────────
# MANUAL RE-TRIGGER
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/{project_id}/run", response_model=MessageResponse)
async def trigger_analysis(
    project_id: str,
    user: User = CanAnalyse,
):
    await job_queue.enqueue(job_run_analysis, project_id, user.org_id)
    return MessageResponse(
        message="Analysis job queued.",
        detail="Results available within 30 seconds.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# RAG QUERY — memory-enhanced
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/query", response_model=QueryResponse)
async def query_project(
    request: QueryRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """
    Natural language Q&A over project documents using RAG.
    Now enhanced with AI Memory — surfaces similar past decisions.
    """
    if not settings.feature_rag_enabled:
        raise HTTPException(status_code=503, detail="RAG feature is disabled.")

    project = await db.get(Project, request.project_id)
    project_ctx: dict = {}
    if project:
        delay = (project.predicted_completion_day or 0) - (project.baseline_completion_day or 0)
        project_ctx = {
            "name": project.name,
            "delay_days": max(0, delay),
            "confidence": project.confidence_score or 0.0,
            "health_score": getattr(project, "health_score", None),
        }

    # ── Inject AI memory context ──────────────────────────────────────────────
    memory_context = []
    if settings.feature_ai_memory_enabled:
        try:
            from app.services.intelligence.memory_service import get_similar_past_recoveries
            # Try to detect action type from question keywords
            q_lower = request.question.lower()
            action_hint = "unknown"
            if any(w in q_lower for w in ["vendor", "supplier", "delivery"]):
                action_hint = "backup_vendor"
            elif any(w in q_lower for w in ["parallel", "concurrent"]):
                action_hint = "parallel_execution"
            elif any(w in q_lower for w in ["crew", "overtime", "night"]):
                action_hint = "add_crew"

            memory_context = await get_similar_past_recoveries(
                db=db, org_id=user.org_id, action_type=action_hint, limit=3
            )
        except Exception:
            pass

    # ── Risk context ──────────────────────────────────────────────────────────
    active_risks = (await db.execute(
        select(Risk).where(
            Risk.project_id == request.project_id,
            Risk.is_resolved == False,
        ).limit(5)
    )).scalars().all()

    risk_ctx = [
        f"{r.severity} risk: {r.explanation[:120]}"
        for r in active_risks
    ] if active_risks else []

    # Pass enriched context to RAG pipeline
    pipeline = RAGPipeline(db, embedding_service, gemini)
    result = await pipeline.query(
        question=request.question,
        project_id=request.project_id,
        org_id=user.org_id,
        project_context={
            **project_ctx,
            "active_risks": risk_ctx,
            "past_decisions": memory_context,
        },
    )

    return QueryResponse(
        answer=result.answer,
        confidence=result.confidence,
        evidence=result.evidence,
        assumptions=result.assumptions,
        missing_data=result.missing_data,
        suggested_questions=result.suggested_questions,
    )