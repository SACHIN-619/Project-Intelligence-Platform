"""
app/services/intelligence/project_health.py
=============================================
Project Health Score Engine — continuously calculates an overall
health score (0–100) from schedule, risk, procurement, and Monte Carlo data.

From the 30-phase discussion (Phase 9 — Project Health Engine):
  "Instead of only showing 'task delayed', show Project Pulse:
   Schedule Health + Procurement Health + Quality Health + Commissioning Readiness"

Scores breakdown:
  Schedule Health   40% — based on delay days, critical path, float
  Risk Health       30% — based on risk level and count
  Procurement Hlth  20% — based on vendor delivery statuses
  MC Confidence     10% — based on Monte Carlo on-time probability
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Any

from app.config import settings


@dataclass
class ProjectHealthScore:
    overall_score: float           # 0–100
    schedule_score: float          # 0–100
    risk_score: float              # 0–100
    procurement_score: float       # 0–100
    confidence_score: float        # 0–100
    health_level: str              # healthy | watch | at_risk | critical
    summary: str


def compute_project_health(
    graph_result: Any,
    risk_result: Any,
    tasks_count: int,
    mc_result: Optional[Any] = None,
) -> ProjectHealthScore:
    """
    Compute project health from analysis outputs.

    Inputs:
        graph_result: GraphResult from CPM engine
        risk_result: RiskEngineResult
        tasks_count: total number of tasks
        mc_result: MonteCarloResult (optional)
    """

    # ── 1. Schedule Health (40%) ──────────────────────────────────────────────
    # Perfect = 100, Degrades with delay and critical path density

    total_delay = getattr(graph_result, "total_delay", 0)
    critical_count = len(getattr(graph_result, "critical_path", []))
    critical_ratio = critical_count / max(tasks_count, 1)

    # Delay penalty: -5 per day up to -50
    delay_penalty = min(50, total_delay * 5)
    # Critical path density penalty: more tasks on critical path = more risk
    critical_penalty = min(30, critical_ratio * 60)

    schedule_score = max(0, 100 - delay_penalty - critical_penalty)

    # ── 2. Risk Health (30%) ──────────────────────────────────────────────────
    risk_level = getattr(risk_result, "project_risk_level", None)
    risk_count = len(getattr(risk_result, "risks", []))

    risk_level_penalty = {
        "low":      0,
        "medium":   20,
        "high":     50,
        "critical": 80,
    }.get(str(risk_level.value if risk_level else "low"), 0)

    # Additional penalty per risk beyond 5
    extra_risk_penalty = min(20, max(0, risk_count - 5) * 2)

    risk_health_score = max(0, 100 - risk_level_penalty - extra_risk_penalty)

    # ── 3. Procurement Health (20%) ───────────────────────────────────────────
    # Derived from vendor delivery statuses via graph_result
    # Fallback if no vendor data: neutral 75
    delayed_vendors = sum(
        1 for r in getattr(risk_result, "risks", [])
        if hasattr(r, "risk_type") and str(r.risk_type.value) == "vendor"
    )
    procurement_score = max(0, 100 - delayed_vendors * 15)

    # ── 4. Monte Carlo Confidence (10%) ───────────────────────────────────────
    if mc_result and hasattr(mc_result, "on_time_probability"):
        mc_confidence_score = round(mc_result.on_time_probability * 100)
    else:
        # Fall back to graph engine confidence
        mc_confidence_score = round(
            getattr(graph_result, "overall_confidence", 0.5) * 100
        )

    # ── Overall score ─────────────────────────────────────────────────────────
    overall = (
        schedule_score     * settings.health_weight_schedule     +
        risk_health_score  * settings.health_weight_quality      +
        procurement_score  * settings.health_weight_procurement  +
        mc_confidence_score * settings.health_weight_resource
    )
    overall = round(max(0, min(100, overall)), 1)

    # ── Health level ──────────────────────────────────────────────────────────
    if overall >= 80:
        health_level = "healthy"
    elif overall >= 60:
        health_level = "watch"
    elif overall >= 40:
        health_level = "at_risk"
    else:
        health_level = "critical"

    # ── Summary ───────────────────────────────────────────────────────────────
    summary = _build_summary(
        overall, health_level, total_delay, risk_count, str(risk_level.value if risk_level else "low")
    )

    return ProjectHealthScore(
        overall_score=overall,
        schedule_score=round(schedule_score, 1),
        risk_score=round(risk_health_score, 1),
        procurement_score=round(procurement_score, 1),
        confidence_score=round(mc_confidence_score, 1),
        health_level=health_level,
        summary=summary,
    )


def _build_summary(
    score: float,
    level: str,
    delay: int,
    risk_count: int,
    risk_level: str,
) -> str:
    if level == "healthy":
        return f"Project health is strong at {score:.0f}/100. No critical issues detected."
    if level == "watch":
        return (
            f"Project health at {score:.0f}/100 — monitoring recommended. "
            f"{risk_count} risk(s) detected."
        )
    if level == "at_risk":
        return (
            f"Project health at {score:.0f}/100 with {delay} day(s) delay and "
            f"{risk_count} {risk_level} risk(s) requiring action."
        )
    return (
        f"Project health critical at {score:.0f}/100. "
        f"{delay} day(s) delay, {risk_count} risks. Immediate recovery recommended."
    )