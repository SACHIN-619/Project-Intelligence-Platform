"""
app/services/intelligence/memory_service.py
=============================================
AI Decision Memory — stores analysis outcomes and approved decisions
so future recommendations improve over time.

From the 30-phase discussion (Phase 19 — AI Memory System):
  "Memory is every business event that may improve future project decisions.
   NOT chat history — business outcomes: recovered delays, rejected vendors,
   successful mitigations, past commissioning failures."

Tables used: (stored in existing AuditEvent with event_type prefix "memory_*")
We reuse AuditEvent to avoid needing a new migration for the hackathon.

Post-hackathon: graduate to dedicated memory_events + memory_records tables.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def record_analysis_event(
    db: AsyncSession,
    project_id: str,
    org_id: str,
    delay_days: int,
    risk_count: int,
    risk_level: str,
    top_risk: Optional[str] = None,
) -> None:
    """
    Record an analysis completion to memory.
    Used to track project health trajectory over time.
    """
    try:
        from app.models.db import AuditEvent
        payload = {
            "delay_days": delay_days,
            "risk_count": risk_count,
            "risk_level": risk_level,
            "top_risk_summary": top_risk,
            "analysed_at": datetime.utcnow().isoformat(),
        }
        db.add(AuditEvent(
            org_id=org_id,
            project_id=project_id,
            event_type="memory_analysis_complete",
            entity_type="project",
            entity_id=project_id,
            new_values=payload,
        ))
        # Don't commit here — caller commits with the rest of the batch
        logger.info(f"[AIMemory] Analysis event recorded for project {project_id}")
    except Exception as e:
        logger.warning(f"[AIMemory] Could not record analysis event: {e}")


async def record_decision(
    db: AsyncSession,
    project_id: str,
    org_id: str,
    user_id: str,
    action_type: str,
    description: str,
    estimated_days_saved: int,
    approved: bool,
    reason: Optional[str] = None,
) -> None:
    """
    Record a recovery decision (approve/reject) to memory.
    This is the most valuable memory type — it teaches the system
    which recovery actions actually work for this organisation.
    """
    try:
        from app.models.db import AuditEvent
        payload = {
            "action_type": action_type,
            "description": description,
            "estimated_days_saved": estimated_days_saved,
            "approved": approved,
            "reason": reason,
            "decided_at": datetime.utcnow().isoformat(),
        }
        db.add(AuditEvent(
            org_id=org_id,
            project_id=project_id,
            user_id=user_id,
            event_type="memory_decision",
            entity_type="action",
            new_values=payload,
        ))
        await db.commit()
        logger.info(
            f"[AIMemory] Decision recorded: {action_type} "
            f"({'approved' if approved else 'rejected'})"
        )
    except Exception as e:
        logger.warning(f"[AIMemory] Could not record decision: {e}")


async def record_outcome(
    db: AsyncSession,
    project_id: str,
    org_id: str,
    action_id: str,
    estimated_days_saved: int,
    actual_days_saved: int,
) -> None:
    """
    Record the actual outcome after a recovery action completes.
    This closes the learning loop:
      Recommended → Approved → Executed → Outcome recorded
    """
    try:
        from app.models.db import AuditEvent
        accuracy = (
            round(actual_days_saved / max(estimated_days_saved, 1) * 100, 1)
            if estimated_days_saved > 0 else 0
        )
        payload = {
            "action_id": action_id,
            "estimated_days": estimated_days_saved,
            "actual_days": actual_days_saved,
            "accuracy_pct": accuracy,
            "completed_at": datetime.utcnow().isoformat(),
        }
        db.add(AuditEvent(
            org_id=org_id,
            project_id=project_id,
            event_type="memory_outcome",
            entity_type="action",
            entity_id=action_id,
            new_values=payload,
        ))
        await db.commit()
        logger.info(
            f"[AIMemory] Outcome recorded: {actual_days_saved}d actual "
            f"vs {estimated_days_saved}d estimated ({accuracy}% accuracy)"
        )
    except Exception as e:
        logger.warning(f"[AIMemory] Could not record outcome: {e}")


async def get_similar_past_recoveries(
    db: AsyncSession,
    org_id: str,
    action_type: str,
    limit: int = 5,
) -> list:
    """
    Retrieve past successful recoveries of the same action_type.
    Used to improve RAG answers and recovery recommendations.
    """
    try:
        from sqlalchemy import select
        from app.models.db import AuditEvent

        rows = (await db.execute(
            select(AuditEvent)
            .where(
                AuditEvent.org_id == org_id,
                AuditEvent.event_type == "memory_decision",
            )
            .order_by(AuditEvent.created_at.desc())
            .limit(50)
        )).scalars().all()

        relevant = []
        for row in rows:
            data = row.new_values or {}
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except Exception:
                    continue
            if data.get("action_type") == action_type and data.get("approved"):
                relevant.append({
                    "action_type": data.get("action_type"),
                    "description": data.get("description"),
                    "days_saved": data.get("estimated_days_saved"),
                    "decided_at": data.get("decided_at"),
                })
            if len(relevant) >= limit:
                break

        return relevant
    except Exception as e:
        logger.warning(f"[AIMemory] Could not fetch past recoveries: {e}")
        return []