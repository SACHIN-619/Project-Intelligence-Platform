"""
app/services/intelligence/vendor_scorer.py
===========================================
Vendor Reliability Score — tracks on-time delivery rates per vendor
across ALL projects in the organisation and adjusts risk scores upward
for repeat offenders.

This is genuinely innovative for EPC software:
  Most tools don't learn from historical vendor performance across projects.
  PII does — every delayed task makes future risk scores worse for that vendor.

Usage:
  scores = await compute_vendor_reliability(db, org_id)
  adjusted = adjust_risk_score_for_vendor(base_score, "PowerGen Corp", scores)
"""

from __future__ import annotations

import logging
from typing import Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def compute_vendor_reliability(
    db: AsyncSession,
    org_id: str,
) -> Dict[str, Dict]:
    """
    Compute reliability score for each vendor across all org projects.

    Score = (on_time_deliveries / total_deliveries) × 100

    Returns dict keyed by vendor name:
    {
      "PowerGen Corp": {
        "reliability_score": 45.0,     # % on-time
        "avg_delay_days": 18.5,
        "total_tasks": 8,
        "on_time": 4,
        "late": 4,
        "risk_level": "high"           # low|medium|high|critical
      }
    }
    """
    try:
        from sqlalchemy import select, func, case
        from app.models.db import Task

        result = await db.execute(
            select(
                Task.responsible_vendor,
                func.count(Task.id).label("total"),
                func.sum(
                    case((Task.actual_delay > 0, 1), else_=0)
                ).label("late_count"),
                func.avg(Task.actual_delay).label("avg_delay"),
            )
            .where(Task.org_id == org_id)
            .where(Task.responsible_vendor.isnot(None))
            .where(Task.responsible_vendor != "")
            .group_by(Task.responsible_vendor)
        )
        rows = result.fetchall()

    except Exception as e:
        logger.error(f"[VendorScorer] DB query failed: {e}")
        return {}

    scores: Dict[str, Dict] = {}
    for row in rows:
        vendor, total, late, avg_delay = row

        if not vendor or total == 0:
            continue

        on_time     = total - (late or 0)
        score       = round((on_time / total) * 100, 1)
        avg_d       = round(float(avg_delay or 0), 1)

        risk_level  = (
            "critical" if score < 40 else
            "high"     if score < 60 else
            "medium"   if score < 80 else
            "low"
        )

        scores[vendor] = {
            "reliability_score": score,
            "avg_delay_days":    avg_d,
            "total_tasks":       total,
            "on_time":           on_time,
            "late":              late or 0,
            "risk_level":        risk_level,
        }

    logger.info(f"[VendorScorer] Scored {len(scores)} vendors for org {org_id}")
    return scores


def adjust_risk_score_for_vendor(
    base_risk_score: float,
    vendor_name: Optional[str],
    vendor_scores: Dict[str, Dict],
) -> float:
    """
    Adjust a task's risk score upward if the vendor has poor reliability history.

    Scale:
      ≥ 80% on-time  → +0.0  (reliable vendor, no penalty)
      60–79%         → +0.5
      40–59%         → +1.0
      < 40%          → +2.0  (chronic offender)

    Max adjusted score is capped at 10.0.
    """
    if not vendor_name or vendor_name not in vendor_scores:
        return base_risk_score

    reliability = vendor_scores[vendor_name]["reliability_score"]

    if reliability >= 80:
        adjustment = 0.0
    elif reliability >= 60:
        adjustment = 0.5
    elif reliability >= 40:
        adjustment = 1.0
    else:
        adjustment = 2.0

    adjusted = min(10.0, base_risk_score + adjustment)

    if adjustment > 0:
        logger.debug(
            f"[VendorScorer] {vendor_name} reliability {reliability:.0f}% "
            f"→ risk {base_risk_score:.1f} + {adjustment:.1f} = {adjusted:.1f}"
        )
    return round(adjusted, 1)


def get_vendor_risk_summary(vendor_scores: Dict[str, Dict]) -> Dict:
    """
    Return a quick summary of vendor risk distribution for dashboards.
    """
    if not vendor_scores:
        return {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}

    counts = {"total": len(vendor_scores), "critical": 0, "high": 0, "medium": 0, "low": 0}
    for v in vendor_scores.values():
        counts[v["risk_level"]] += 1
    return counts