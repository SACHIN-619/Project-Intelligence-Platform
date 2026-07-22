"""
app/api/simulation.py
=======================
Recovery scenario simulation endpoints.

  POST /simulation/run          → simulate a specific recovery action
  POST /simulation/auto-recover → AI-generate ranked recovery options
  POST /simulation/compound     → combine two scenarios
  GET  /simulation/{id}         → get scenario details
  POST /simulation/{id}/approve → manager approves
  POST /simulation/{id}/reject  → manager rejects with reason
  GET  /simulation/project/{id} → list all scenarios for a project
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth, CanSimulate, CanApprove
from app.models.db import Task, Vendor, Scenario, User
from app.models.schemas import (
    SimulationRequest, ScenarioResult, RecoveryOption,
    ApproveActionRequest, RejectActionRequest, MessageResponse,
)
from app.services.intelligence.graph_engine import ProjectGraphEngine, TaskNode, TaskStatus
from app.services.intelligence.recovery_engine import RecoveryEngine, ActionType
from app.services.intelligence.montecarlo import MonteCarloEngine, MCConfig
from app.services.intelligence.memory_service import get_similar_past_recoveries
from app.services.ai.gemini import gemini
from app.config import settings

router = APIRouter(prefix="/simulation", tags=["Simulation"])


# ── Shared graph builder ──────────────────────────────────────────────────────

async def _build_engine(project_id: str, org_id: str, db: AsyncSession) -> ProjectGraphEngine:
    t_rows = (await db.execute(
        select(Task).where(Task.project_id == project_id, Task.org_id == org_id)
    )).scalars().all()

    if not t_rows:
        raise HTTPException(status_code=422, detail="No tasks found — upload a schedule first.")

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
        for dep in (t.depends_on or []):
            dep_id = name_to_id.get(dep)
            if dep_id:
                try:
                    engine.add_dependency(dep_id, str(t.id))
                except ValueError:
                    pass

    return engine


# ─────────────────────────────────────────────────────────────────────────────
# AUTO RECOVERY  — generate ranked options automatically
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/auto-recover/{project_id}", response_model=List[RecoveryOption])
async def auto_recover(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = CanSimulate,
):
    """
    Generate ranked recovery options for the most critical risks.
    No scenario is committed — this is a discovery endpoint.
    """
    engine = await _build_engine(project_id, user.org_id, db)
    recovery_engine = RecoveryEngine(engine)

    # Focus on top 5 impact tasks
    ranked = engine.ranked_impact_tasks()
    top_ids = [tid for tid, _ in ranked[:5]]

    # NEW — Phase 19: Fetch AI Memory Context
    memory_context = []
    if settings.feature_ai_memory_enabled:
        try:
            memory_context = await get_similar_past_recoveries(
                db=db, org_id=user.org_id, action_type="backup_vendor", limit=5
            )
        except Exception:
            pass

    options = recovery_engine.generate_recovery_options(
        risk_task_ids=top_ids,
        max_options=6,
        memory_context=memory_context,   # Pass memory context to the engine
    )

    return [
        RecoveryOption(
            action_type=opt.action_type.value,
            title=opt.title,
            description=opt.description,
            estimated_days_saved=opt.estimated_days_saved,
            estimated_cost=opt.cost_level,
            confidence=opt.confidence,
            feasibility=opt.feasibility_score,
            opportunity_window=opt.opportunity_window.value,
            memory_context=", ".join(opt.evidence_hints) if opt.evidence_hints else None,
        )
        for opt in options
    ]


# ─────────────────────────────────────────────────────────────────────────────
# RUN SIMULATION  — simulate a specific action and persist result
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/run", response_model=ScenarioResult, status_code=status.HTTP_201_CREATED)
async def run_simulation(
    request: SimulationRequest,
    db: AsyncSession = Depends(get_db),
    user: User = CanSimulate,
):
    """
    Simulate a specific recovery action and save as a scenario.
    Returns the before/after comparison and Monte Carlo results.
    """
    engine = await _build_engine(request.project_id, user.org_id, db)
    baseline = engine.compute_schedule()
    old_delay = baseline.total_delay

    # Apply the action to the graph
    task_id = request.action_params.get("task_id")
    delay_reduction = int(request.action_params.get("delay_reduction_days", 0))

    if task_id and delay_reduction > 0:
        snap = engine.snapshot()
        engine.tasks[task_id].actual_delay = max(
            0, engine.tasks[task_id].actual_delay - delay_reduction
        )

    new_result = engine.compute_schedule()
    new_delay = new_result.total_delay
    days_saved = old_delay - new_delay

    # Monte Carlo for new state
    mc_p50 = mc_p80 = mc_p90 = mc_on_time = None
    if settings.feature_monte_carlo_enabled:
        mc = MonteCarloEngine(engine, MCConfig(n_simulations=settings.mc_n_simulations))
        mc_r = mc.run()
        mc_p50, mc_p80, mc_p90, mc_on_time = mc_r.p50, mc_r.p80, mc_r.p90, mc_r.on_time_probability

    # AI explanation
    task_name = engine.tasks[task_id].name if task_id and task_id in engine.tasks else "project"
    explanation = gemini.explain_recovery(
        action_type=request.action_type,
        task_name=task_name,
        days_saved=days_saved,
        confidence=new_result.overall_confidence,
        evidence=[],
    )

    # Feasibility score (heuristic)
    feasibility = 0.75 if days_saved > 0 else 0.30

    # Persist scenario
    pct_saved = round(days_saved / max(old_delay, 1) * 100, 1) if old_delay > 0 else 0.0
    scenario = Scenario(
        org_id=user.org_id,
        project_id=request.project_id,
        created_by=user.id,
        name=request.name or f"{request.action_type.replace('_', ' ').title()} — {task_name}",
        action_type=request.action_type,
        action_params=request.action_params,
        old_delay_days=old_delay,
        new_delay_days=new_delay,
        days_saved=days_saved,
        feasibility_score=feasibility,
        confidence=new_result.overall_confidence,
        monte_carlo_p50=mc_p50,
        monte_carlo_p80=mc_p80,
        monte_carlo_p90=mc_p90,
        on_time_probability=mc_on_time,
        status="draft",
    )
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)

    return ScenarioResult(
        scenario_id=str(scenario.id),
        name=scenario.name,
        action_type=request.action_type,
        old_delay_days=old_delay,
        new_delay_days=new_delay,
        days_saved=days_saved,
        days_saved_pct=pct_saved,
        feasibility_score=feasibility,
        confidence=new_result.overall_confidence,
        cost_impact=0.0,
        mc_p50=mc_p50,
        mc_p80=mc_p80,
        mc_p90=mc_p90,
        on_time_probability=mc_on_time,
        explanation=explanation,
        evidence=[],
    )


# ─────────────────────────────────────────────────────────────────────────────
# COMPOUND SCENARIO
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/compound/{project_id}", response_model=dict)
async def compound_scenario(
    project_id: str,
    scenario_ids: List[str],
    db: AsyncSession = Depends(get_db),
    user: User = CanSimulate,
):
    """Simulate two recovery actions stacked together; detects synergy."""
    if len(scenario_ids) != 2:
        raise HTTPException(status_code=400, detail="Exactly 2 scenario IDs required.")

    sc_a = await db.get(Scenario, scenario_ids[0])
    sc_b = await db.get(Scenario, scenario_ids[1])

    if not sc_a or not sc_b:
        raise HTTPException(status_code=404, detail="One or both scenarios not found.")

    engine = await _build_engine(project_id, user.org_id, db)
    baseline = engine.compute_schedule()
    old_delay = baseline.total_delay

    # Apply A
    tid_a = sc_a.action_params.get("task_id")
    red_a = sc_a.action_params.get("delay_reduction_days", 0)
    if tid_a and red_a and tid_a in engine.tasks:
        engine.tasks[tid_a].actual_delay = max(0, engine.tasks[tid_a].actual_delay - int(red_a))

    # Apply B
    tid_b = sc_b.action_params.get("task_id")
    red_b = sc_b.action_params.get("delay_reduction_days", 0)
    if tid_b and red_b and tid_b in engine.tasks:
        engine.tasks[tid_b].actual_delay = max(0, engine.tasks[tid_b].actual_delay - int(red_b))

    combined_result = engine.compute_schedule()
    combined_saved = old_delay - combined_result.total_delay
    independent_sum = (sc_a.days_saved or 0) + (sc_b.days_saved or 0)

    return {
        "combined_days_saved": combined_saved,
        "independent_sum": independent_sum,
        "synergy_days": combined_saved - independent_sum,
        "new_delay_days": combined_result.total_delay,
        "message": (
            "Compound scenario shows synergy!" if combined_saved > independent_sum
            else "Actions have overlapping impact — combined gain less than sum."
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# APPROVE / REJECT
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/{scenario_id}/approve", response_model=MessageResponse)
async def approve_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = CanApprove,
):
    """Manager approves a recovery scenario — marks it for execution."""
    scenario = await db.get(Scenario, scenario_id)
    if not scenario or scenario.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    if scenario.status != "draft":
        raise HTTPException(status_code=400, detail=f"Scenario is already '{scenario.status}'.")

    scenario.status = "approved"
    scenario.approved_by = user.id
    from datetime import datetime
    scenario.approved_at = datetime.utcnow()
    return MessageResponse(message="Scenario approved.", detail=f"Recovery plan approved by {user.full_name}.")


@router.post("/{scenario_id}/reject", response_model=MessageResponse)
async def reject_scenario(
    scenario_id: str,
    request: RejectActionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = CanApprove,
):
    """Manager rejects a scenario with a reason (stored for learning)."""
    scenario = await db.get(Scenario, scenario_id)
    if not scenario or scenario.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Scenario not found.")

    scenario.status = "rejected"
    scenario.rejection_reason = request.reason
    return MessageResponse(message="Scenario rejected.", detail=request.reason)


# ─────────────────────────────────────────────────────────────────────────────
# LIST
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/project/{project_id}", response_model=List[ScenarioResult])
async def list_scenarios(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    rows = (await db.execute(
        select(Scenario)
        .where(Scenario.project_id == project_id, Scenario.org_id == user.org_id)
        .order_by(Scenario.created_at.desc())
    )).scalars().all()

    return [
        ScenarioResult(
            scenario_id=str(r.id),
            name=r.name or "",
            action_type=r.action_type,
            old_delay_days=r.old_delay_days or 0,
            new_delay_days=r.new_delay_days or 0,
            days_saved=r.days_saved or 0,
            days_saved_pct=round((r.days_saved or 0) / max(r.old_delay_days or 1, 1) * 100, 1),
            feasibility_score=r.feasibility_score or 0.0,
            confidence=r.confidence or 0.0,
            cost_impact=r.cost_impact or 0.0,
            mc_p50=r.monte_carlo_p50,
            mc_p80=r.monte_carlo_p80,
            mc_p90=r.monte_carlo_p90,
            on_time_probability=r.on_time_probability,
            explanation="",
            evidence=[],
        )
        for r in rows
    ]