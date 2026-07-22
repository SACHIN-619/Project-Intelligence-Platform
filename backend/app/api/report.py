"""
app/api/report.py
==================
Report generation endpoint — was missing from the API layer.
Ties together: analysis + risks + scenarios + health score + vendor scores
                → AI narrative (3-layer gemini) → PDF (reportlab)
"""

from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth
from app.models.db import Project, Task, Risk, Scenario, User
from app.models.schemas import ReportRequest, ReportResponse
from app.services.ai.gemini import gemini
from app.services.report.generator import generate_report
from app.config import settings

router = APIRouter(prefix="/report", tags=["Report"])

REPORT_DIR = "/tmp/pii_uploads"


@router.post("/generate", response_model=ReportResponse)
async def generate_project_report(
    request: ReportRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """
    Generate a full PDF report combining:
      - Executive summary (AI narrative via Gemini→Groq fallback)
      - Project health breakdown (Phase 9)
      - Risk register
      - Vendor reliability (Phase 3, cross-project scoring)
      - Recovery scenarios
    """
    project = await db.get(Project, request.project_id)
    if not project or project.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Project not found")

    # ── Gather risks ─────────────────────────────────────────────────────────
    risk_rows = (await db.execute(
        select(Risk).where(Risk.project_id == request.project_id)
    )).scalars().all()
    risks = [
        {
            "task_name":   r.task_name if hasattr(r, "task_name") else None,
            "risk_type":   r.risk_type,
            "severity":    r.severity,
            "probability": r.probability,
            "impact_days": r.impact_days,
            "risk_score":  r.risk_score,
            "explanation": r.explanation,
        }
        for r in risk_rows
    ]

    # ── Gather scenarios ─────────────────────────────────────────────────────
    scenario_query = select(Scenario).where(Scenario.project_id == request.project_id)
    if request.scenario_ids:
        scenario_query = scenario_query.where(Scenario.id.in_(request.scenario_ids))
    scenario_rows = (await db.execute(scenario_query)).scalars().all()

    scenarios = [
        {
            "title":            s.name,
            "action_type":      s.action_type,
            "days_saved":       s.days_saved,
            "cost_level":       getattr(s, "cost_level", "medium"),
            "confidence":       s.confidence,
            "feasibility_score": getattr(s, "feasibility_score", 0.7),
            "status":           s.status,
        }
        for s in scenario_rows
    ]

    # ── Task count for delay calc ────────────────────────────────────────────
    task_rows = (await db.execute(
        select(Task).where(Task.project_id == request.project_id)
    )).scalars().all()

    delay_days = (
        (project.predicted_completion_day or 0) - (project.baseline_completion_day or 0)
    )
    delay_days = max(0, delay_days)

    risk_level = "low"
    if risks:
        severities = [r["severity"] for r in risks]
        if "critical" in severities:
            risk_level = "critical"
        elif "high" in severities:
            risk_level = "high"
        elif "medium" in severities:
            risk_level = "medium"

    project_dict = {
        "id":               str(project.id),
        "name":             project.name,
        "completion_pct":   project.current_progress,
        "delay_days":       delay_days,
        "risk_level":       risk_level,
        "confidence_score": project.confidence_score or 0.0,
    }

    # ── Monte Carlo (if requested) ───────────────────────────────────────────
    mc_result = None
    if request.include_monte_carlo:
        try:
            from app.services.intelligence.graph_engine import ProjectGraphEngine, TaskNode, TaskStatus
            from app.services.intelligence.montecarlo import MonteCarloEngine, MCConfig

            engine = ProjectGraphEngine()
            for t in task_rows:
                engine.add_task(TaskNode(
                    task_id=str(t.id), name=t.name, duration=t.planned_duration,
                    status=TaskStatus(t.status), actual_delay=t.actual_delay,
                    completion=t.completion,
                ))
            name_to_id = {t.name: str(t.id) for t in task_rows}
            for t in task_rows:
                for dep in (t.depends_on or []):
                    dep_id = name_to_id.get(dep)
                    if dep_id:
                        try:
                            engine.add_dependency(dep_id, str(t.id))
                        except ValueError:
                            pass

            mc = MonteCarloEngine(engine, MCConfig(n_simulations=settings.mc_n_simulations))
            mc_run = mc.run()
            mc_result = {
                "p50": mc_run.p50, "p80": mc_run.p80, "p90": mc_run.p90,
                "on_time_probability": mc_run.on_time_probability,
            }
        except Exception:
            pass

    # ── Project Health (Phase 9) ─────────────────────────────────────────────
    health_dict = None
    try:
        from app.services.intelligence.graph_engine import ProjectGraphEngine, TaskNode, TaskStatus
        from app.services.intelligence.risk_engine import RiskEngine
        from app.services.intelligence.project_health import compute_project_health

        engine2 = ProjectGraphEngine()
        for t in task_rows:
            engine2.add_task(TaskNode(
                task_id=str(t.id), name=t.name, duration=t.planned_duration,
                status=TaskStatus(t.status), actual_delay=t.actual_delay,
                completion=t.completion,
            ))
        graph_res = engine2.compute_schedule()

        risk_eng = RiskEngine()
        risk_res = risk_eng.analyse(graph_res, engine2, [])

        hs = compute_project_health(
            graph_result=graph_res, risk_result=risk_res,
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
        pass

    # ── Vendor reliability (Phase 3) ─────────────────────────────────────────
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

    # ── AI Narrative (3-layer Gemini→Groq fallback) ──────────────────────────
    ai_narrative = ""
    if gemini.is_available:
        try:
            ai_narrative = gemini.generate_report_narrative(
                project_data=project_dict, risks=risks, scenarios=scenarios,
            )
        except Exception:
            ai_narrative = ""

    # ── Build PDF ─────────────────────────────────────────────────────────────
    filepath = generate_report(
        project=project_dict,
        risks=risks,
        scenarios=scenarios,
        mc_result=mc_result,
        ai_narrative=ai_narrative,
        health_score=health_dict,
        vendor_scores=vendor_scores_list,
        output_dir=REPORT_DIR,
    )

    report_id = os.path.basename(filepath).replace(".pdf", "").replace(".txt", "")

    from datetime import datetime
    return ReportResponse(
        report_id=report_id,
        download_url=f"/api/v1/report/download/{report_id}",
        generated_at=datetime.utcnow(),
    )


@router.get("/download/{report_id}")
async def download_report(
    report_id: str,
    user: User = Depends(require_auth),
):
    """Download a previously generated report by ID."""
    pdf_path = os.path.join(REPORT_DIR, f"{report_id}.pdf")
    txt_path = os.path.join(REPORT_DIR, f"{report_id}.txt")

    if os.path.exists(pdf_path):
        return FileResponse(
            pdf_path, media_type="application/pdf",
            filename=f"{report_id}.pdf",
        )
    if os.path.exists(txt_path):
        return FileResponse(
            txt_path, media_type="text/plain",
            filename=f"{report_id}.txt",
        )

    raise HTTPException(status_code=404, detail="Report not found or expired.")