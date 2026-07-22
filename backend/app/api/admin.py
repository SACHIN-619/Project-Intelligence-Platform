# """
# app/api/admin.py
# =================
# Admin & analytics endpoints — now backed by real data:
#   - Vendor reliability scores from vendor_scorer
#   - AI memory event counts
#   - Business impact metrics from actual DB rows
#   - Schema mapping memory inspection
#   - Feature flag management
# """

# from __future__ import annotations

# from datetime import datetime, timedelta
# from typing import Any, Dict, List, Optional

# from fastapi import APIRouter, Depends, HTTPException
# from sqlalchemy import select, func
# from sqlalchemy.ext.asyncio import AsyncSession

# # from app.api.deps import get_db, require_auth, RequireRole
# from app.api.deps import get_db, require_auth, CanApprove
# from app.models.db import (
#     Task, Vendor, Risk, Project, Upload, Action,
#     DocumentChunk, AuditEvent, SchemaMappingMemory, User,
# )
# from app.models.schemas import (
#     BusinessMetrics, AuditRow, SchemaMemoryRow, MessageResponse,
# )
# from app.config import settings
# from app.services.intelligence.vendor_scorer import (
#     compute_vendor_reliability, get_vendor_risk_summary,
# )

# router = APIRouter(prefix="/admin", tags=["Admin"])

# # RequireAdmin = RequireRole("admin", "manager")


# # ─────────────────────────────────────────────────────────────────────────────
# # BUSINESS METRICS
# # ─────────────────────────────────────────────────────────────────────────────
# @router.get("/metrics/{project_id}", response_model=BusinessMetrics)
# async def get_metrics(
#     project_id: str,
#     db: AsyncSession = Depends(get_db),
#     user: User = Depends(require_auth),
# ):
#     """
#     Real business impact metrics from DB.
#     Hours saved calculated from actual task count vs manual baseline.
#     AI performance metrics from memory events.
#     """
#     # Task count
#     task_count = (await db.execute(
#         select(func.count()).where(Task.project_id == project_id)
#     )).scalar() or 0

#     # Risk count
#     risk_count = (await db.execute(
#         select(func.count()).where(Risk.project_id == project_id)
#     )).scalar() or 0

#     # Document chunks indexed (= documents analysed)
#     chunks_indexed = (await db.execute(
#         select(func.count()).where(DocumentChunk.project_id == project_id)
#     )).scalar() or 0

#     # Actions
#     all_actions = (await db.execute(
#         select(Action).where(Action.project_id == project_id)
#     )).scalars().all()

#     actions_completed = sum(1 for a in all_actions if a.status == "completed")
#     actions_approved = sum(1 for a in all_actions if a.status in ("approved", "completed"))
#     total_actions = len(all_actions)
#     approval_pct = round(actions_approved / max(total_actions, 1) * 100, 1)

#     # Hours saved — 30 min manual vs 3 min AI per task on average
#     # Plus 2 hrs manual for report generation saved each time
#     manual_baseline_hrs = task_count * 0.5    # 30 min per task
#     ai_actual_hrs = task_count * 0.05         # 3 min per task
#     report_savings = min(len(all_actions) * 0.5, 10)  # ~30 min per recovery action
#     hours_saved = max(0.0, (manual_baseline_hrs - ai_actual_hrs) + report_savings)

#     # Confidence — average from project
#     project = await db.get(Project, project_id)
#     avg_confidence = getattr(project, "confidence_score", 0.0) or 0.0

#     # AI performance from memory events
#     memory_events = (await db.execute(
#         select(AuditEvent).where(
#             AuditEvent.project_id == project_id,
#             AuditEvent.event_type.like("memory_%"),
#         ).limit(100)
#     )).scalars().all()
#     memory_event_count = len(memory_events)

#     # Outcomes from memory — did approved actions actually save days?
#     outcome_events = [
#         e for e in memory_events
#         if e.event_type == "memory_outcome"
#     ]
#     avg_accuracy = 0.0
#     if outcome_events:
#         accuracies = []
#         for e in outcome_events:
#             data = e.new_values or {}
#             if isinstance(data, str):
#                 import json
#                 try:
#                     data = json.loads(data)
#                 except Exception:
#                     continue
#             if "accuracy_pct" in data:
#                 accuracies.append(float(data["accuracy_pct"]))
#         if accuracies:
#             avg_accuracy = round(sum(accuracies) / len(accuracies), 1)

#     return BusinessMetrics(
#         tasks_analysed=task_count,
#         documents_indexed=chunks_indexed,
#         risks_detected=risk_count,
#         actions_completed=actions_completed,
#         scenarios_approved_pct=approval_pct,
#         avg_confidence=avg_confidence,
#         hours_saved_estimate=round(hours_saved, 1),
#         manual_hours_baseline=round(manual_baseline_hrs, 1),
#         ai_hours_actual=round(ai_actual_hrs, 1),
#         ai_memory_events=memory_event_count,
#         ai_prediction_accuracy=avg_accuracy,
#     )


# # ─────────────────────────────────────────────────────────────────────────────
# # VENDOR RELIABILITY SCORES (NEW from vendor_scorer)
# # ─────────────────────────────────────────────────────────────────────────────
# @router.get("/vendor-scores")
# async def get_vendor_scores(
#     db: AsyncSession = Depends(get_db),
#     user: User = Depends(require_auth),
# ):
#     """
#     Cross-project vendor reliability scores for this organisation.
#     Shows which vendors have a history of delays.
#     """
#     scores = await compute_vendor_reliability(db, user.org_id)
#     summary = get_vendor_risk_summary(scores)

#     # Sort by reliability score ascending (worst first)
#     sorted_vendors = sorted(
#         [
#             {
#                 "vendor_name": name,
#                 **data,
#             }
#             for name, data in scores.items()
#         ],
#         key=lambda v: v["reliability_score"],
#     )

#     return {
#         "summary": summary,
#         "vendors": sorted_vendors,
#     }


# # ─────────────────────────────────────────────────────────────────────────────
# # AUDIT TRAIL
# # ─────────────────────────────────────────────────────────────────────────────
# @router.get("/audit/{project_id}", response_model=List[AuditRow])
# async def get_audit_trail(
#     project_id: str,
#     limit: int = 50,
#     db: AsyncSession = Depends(get_db),
#     user: User = Depends(require_auth),
# ):
#     rows = (await db.execute(
#         select(AuditEvent)
#         .where(
#             AuditEvent.project_id == project_id,
#             AuditEvent.org_id == user.org_id,
#         )
#         .order_by(AuditEvent.created_at.desc())
#         .limit(limit)
#     )).scalars().all()

#     return [
#         AuditRow(
#             id=str(r.id),
#             event_type=r.event_type,
#             entity_type=r.entity_type,
#             entity_id=r.entity_id,
#             created_at=r.created_at,
#         )
#         for r in rows
#     ]


# # ─────────────────────────────────────────────────────────────────────────────
# # SCHEMA MEMORY
# # ─────────────────────────────────────────────────────────────────────────────
# @router.get("/schema-memory", response_model=List[SchemaMemoryRow])
# async def get_schema_memory(
#     db: AsyncSession = Depends(get_db),
#     user: User = Depends(require_auth),
# ):
#     """Learned column name mappings for this organisation."""
#     rows = (await db.execute(
#         select(SchemaMappingMemory)
#         .where(SchemaMappingMemory.org_id == user.org_id)
#         .order_by(SchemaMappingMemory.usage_count.desc())
#         .limit(100)
#     )).scalars().all()

#     return [
#         SchemaMemoryRow(
#             source_column=r.source_column,
#             canonical_column=r.canonical_column,
#             mapping_method=r.mapping_method,
#             confidence=r.confidence,
#             usage_count=r.usage_count,
#         )
#         for r in rows
#     ]


# # ─────────────────────────────────────────────────────────────────────────────
# # FEATURE FLAGS
# # ─────────────────────────────────────────────────────────────────────────────
# @router.get("/feature-flags")
# async def get_feature_flags(user: User = Depends(CanApprove)):
#     """Return current feature flag state."""
#     return {
#         "rag":              settings.feature_rag_enabled,
#         "monte_carlo":      settings.feature_monte_carlo_enabled,
#         "pdf_export":       settings.feature_pdf_export_enabled,
#         "weather_agent":    settings.feature_weather_agent_enabled,
#         "vendor_scoring":   settings.feature_vendor_scoring_enabled,
#         "ai_memory":        settings.feature_ai_memory_enabled,
#     }


# @router.post("/feature-flags/{flag_name}")
# async def toggle_feature_flag(
#     flag_name: str,
#     body: dict,
#     user: User = Depends(CanApprove),
# ):
#     """
#     Toggle a feature flag at runtime (updates in-memory settings).
#     For permanent changes, update .env and restart.
#     """
#     allowed_flags = {
#         "rag":            "feature_rag_enabled",
#         "monte_carlo":    "feature_monte_carlo_enabled",
#         "pdf_export":     "feature_pdf_export_enabled",
#         "weather_agent":  "feature_weather_agent_enabled",
#         "vendor_scoring": "feature_vendor_scoring_enabled",
#         "ai_memory":      "feature_ai_memory_enabled",
#     }
#     attr = allowed_flags.get(flag_name)
#     if not attr:
#         raise HTTPException(status_code=400, detail=f"Unknown flag: {flag_name}")

#     value = bool(body.get("enabled", False))
#     setattr(settings, attr, value)
#     return {"flag": flag_name, "enabled": value}


# # ─────────────────────────────────────────────────────────────────────────────
# # SYSTEM HEALTH
# # ─────────────────────────────────────────────────────────────────────────────
# @router.get("/health")
# async def system_health(
#     db: AsyncSession = Depends(get_db),
#     user: User = Depends(require_auth),
# ):
#     """
#     Real system health check — tests DB, pgvector, Redis, AI providers.
#     Used by the System Health frontend page.
#     """
#     components = []

#     # Database
#     try:
#         from sqlalchemy import text
#         await db.execute(text("SELECT 1"))
#         components.append({"name": "database", "status": "ok", "detail": "PostgreSQL connected"})
#     except Exception as e:
#         components.append({"name": "database", "status": "down", "detail": str(e)})

#     # pgvector
#     try:
#         from sqlalchemy import text
#         await db.execute(text("SELECT vector_dims(ARRAY[1,2,3]::vector)"))
#         components.append({"name": "pgvector", "status": "ok", "detail": "pgvector extension active"})
#     except Exception as e:
#         components.append({"name": "pgvector", "status": "degraded",
#                            "detail": f"pgvector not available: {e}"})

#     # Redis
#     try:
#         import redis.asyncio as aioredis
#         r = aioredis.from_url(settings.redis_url)
#         await r.ping()
#         await r.close()
#         components.append({"name": "redis", "status": "ok", "detail": "Redis connected"})
#     except Exception as e:
#         components.append({"name": "redis", "status": "degraded",
#                            "detail": f"Redis unavailable — using fallback queue: {e}"})

#     # Gemini AI
#     from app.services.ai.gemini import gemini as gemini_client
#     if gemini_client._gemini_available:
#         components.append({"name": "gemini_ai", "status": "ok",
#                            "detail": "Gemini Layer 1 ready"})
#     elif gemini_client._groq_client:
#         components.append({"name": "gemini_ai", "status": "degraded",
#                            "detail": "Gemini unavailable — Groq Layer 2 active"})
#     else:
#         components.append({"name": "gemini_ai", "status": "down",
#                            "detail": "No AI provider configured. Add GEMINI_API_KEY to .env"})

#     # BGE Embeddings
#     try:
#         from app.services.ai.embedding import embedding_service
#         if embedding_service.is_ready:
#             components.append({"name": "embeddings", "status": "ok",
#                                "detail": "BGE-small-en-v1.5 loaded locally"})
#         else:
#             components.append({"name": "embeddings", "status": "degraded",
#                                "detail": "Embedding model not yet loaded — first upload triggers download (~130MB)"})
#     except Exception:
#         components.append({"name": "embeddings", "status": "degraded",
#                            "detail": "Embedding service not initialised"})

#     # Overall
#     statuses = [c["status"] for c in components]
#     overall = (
#         "ok"       if all(s == "ok" for s in statuses)   else
#         "degraded" if "down" not in statuses               else
#         "down"
#     )

#     return {
#         "overall": overall,
#         "checked_at": datetime.utcnow().isoformat(),
#         "components": components,
#     }

"""
app/api/admin.py
=================
Admin & analytics endpoints — now backed by real data:
  - Vendor reliability scores from vendor_scorer
  - AI memory event counts
  - Business impact metrics from actual DB rows
  - Schema mapping memory inspection
  - Feature flag management
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth, CanApprove
from app.models.db import (
    Task, Vendor, Risk, Project, Upload, Action,
    DocumentChunk, AuditEvent, SchemaMappingMemory, User,
)
from app.models.schemas import (
    BusinessMetrics, AuditRow, SchemaMemoryRow, MessageResponse,
)
from app.config import settings
from app.services.intelligence.vendor_scorer import (
    compute_vendor_reliability, get_vendor_risk_summary,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─────────────────────────────────────────────────────────────────────────────
# BUSINESS METRICS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/metrics/{project_id}", response_model=BusinessMetrics)
async def get_metrics(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """
    Real business impact metrics from DB.
    Hours saved calculated from actual task count vs manual baseline.
    AI performance metrics from memory events.
    """
    # Task count
    task_count = (await db.execute(
        select(func.count()).where(Task.project_id == project_id)
    )).scalar() or 0

    # Risk count
    risk_count = (await db.execute(
        select(func.count()).where(Risk.project_id == project_id)
    )).scalar() or 0

    # Document chunks indexed (= documents analysed)
    chunks_indexed = (await db.execute(
        select(func.count()).where(DocumentChunk.project_id == project_id)
    )).scalar() or 0

    # Actions
    all_actions = (await db.execute(
        select(Action).where(Action.project_id == project_id)
    )).scalars().all()

    actions_completed = sum(1 for a in all_actions if a.status == "completed")
    actions_approved = sum(1 for a in all_actions if a.status in ("approved", "completed"))
    total_actions = len(all_actions)
    approval_pct = round(actions_approved / max(total_actions, 1) * 100, 1)

    # Hours saved — 30 min manual vs 3 min AI per task on average
    # Plus 2 hrs manual for report generation saved each time
    manual_baseline_hrs = task_count * 0.5    # 30 min per task
    ai_actual_hrs = task_count * 0.05         # 3 min per task
    report_savings = min(len(all_actions) * 0.5, 10)  # ~30 min per recovery action
    hours_saved = max(0.0, (manual_baseline_hrs - ai_actual_hrs) + report_savings)

    # Confidence — average from project
    project = await db.get(Project, project_id)
    avg_confidence = getattr(project, "confidence_score", 0.0) or 0.0

    # AI performance from memory events
    memory_events = (await db.execute(
        select(AuditEvent).where(
            AuditEvent.project_id == project_id,
            AuditEvent.event_type.like("memory_%"),
        ).limit(100)
    )).scalars().all()
    memory_event_count = len(memory_events)

    # Outcomes from memory — did approved actions actually save days?
    outcome_events = [
        e for e in memory_events
        if e.event_type == "memory_outcome"
    ]
    avg_accuracy = 0.0
    if outcome_events:
        accuracies = []
        for e in outcome_events:
            data = e.new_values or {}
            if isinstance(data, str):
                import json
                try:
                    data = json.loads(data)
                except Exception:
                    continue
            if "accuracy_pct" in data:
                accuracies.append(float(data["accuracy_pct"]))
        if accuracies:
            avg_accuracy = round(sum(accuracies) / len(accuracies), 1)

    return BusinessMetrics(
        tasks_analysed=task_count,
        documents_indexed=chunks_indexed,
        risks_detected=risk_count,
        actions_completed=actions_completed,
        scenarios_approved_pct=approval_pct,
        avg_confidence=avg_confidence,
        hours_saved_estimate=round(hours_saved, 1),
        manual_hours_baseline=round(manual_baseline_hrs, 1),
        ai_hours_actual=round(ai_actual_hrs, 1),
        ai_memory_events=memory_event_count,
        ai_prediction_accuracy=avg_accuracy,
    )


# ─────────────────────────────────────────────────────────────────────────────
# VENDOR RELIABILITY SCORES (NEW from vendor_scorer)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/vendor-scores")
async def get_vendor_scores(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """
    Cross-project vendor reliability scores for this organisation.
    Shows which vendors have a history of delays.
    """
    scores = await compute_vendor_reliability(db, user.org_id)
    summary = get_vendor_risk_summary(scores)

    # Sort by reliability score ascending (worst first)
    sorted_vendors = sorted(
        [
            {
                "vendor_name": name,
                **data,
            }
            for name, data in scores.items()
        ],
        key=lambda v: v["reliability_score"],
    )

    return {
        "summary": summary,
        "vendors": sorted_vendors,
    }


# ─────────────────────────────────────────────────────────────────────────────
# AUDIT TRAIL
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/audit/{project_id}", response_model=List[AuditRow])
async def get_audit_trail(
    project_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    rows = (await db.execute(
        select(AuditEvent)
        .where(
            AuditEvent.project_id == project_id,
            AuditEvent.org_id == user.org_id,
        )
        .order_by(AuditEvent.created_at.desc())
        .limit(limit)
    )).scalars().all()

    return [
        AuditRow(
            id=str(r.id),
            event_type=r.event_type,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            created_at=r.created_at,
        )
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# SCHEMA MEMORY
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/schema-memory", response_model=List[SchemaMemoryRow])
async def get_schema_memory(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Learned column name mappings for this organisation."""
    rows = (await db.execute(
        select(SchemaMappingMemory)
        .where(SchemaMappingMemory.org_id == user.org_id)
        .order_by(SchemaMappingMemory.usage_count.desc())
        .limit(100)
    )).scalars().all()

    return [
        SchemaMemoryRow(
            source_column=r.source_column,
            canonical_column=r.canonical_column,
            mapping_method=r.mapping_method,
            confidence=r.confidence,
            usage_count=r.usage_count,
        )
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE FLAGS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/feature-flags")
async def get_feature_flags(user: User = CanApprove):
    """Return current feature flag state."""
    return {
        "rag":              settings.feature_rag_enabled,
        "monte_carlo":      settings.feature_monte_carlo_enabled,
        "pdf_export":       settings.feature_pdf_export_enabled,
        "weather_agent":    settings.feature_weather_agent_enabled,
        "vendor_scoring":   settings.feature_vendor_scoring_enabled,
        "ai_memory":        settings.feature_ai_memory_enabled,
    }


@router.post("/feature-flags/{flag_name}")
async def toggle_feature_flag(
    flag_name: str,
    body: dict,
    user: User = CanApprove,
):
    """
    Toggle a feature flag at runtime (updates in-memory settings).
    For permanent changes, update .env and restart.
    """
    allowed_flags = {
        "rag":            "feature_rag_enabled",
        "monte_carlo":    "feature_monte_carlo_enabled",
        "pdf_export":     "feature_pdf_export_enabled",
        "weather_agent":  "feature_weather_agent_enabled",
        "vendor_scoring": "feature_vendor_scoring_enabled",
        "ai_memory":      "feature_ai_memory_enabled",
    }
    attr = allowed_flags.get(flag_name)
    if not attr:
        raise HTTPException(status_code=400, detail=f"Unknown flag: {flag_name}")

    value = bool(body.get("enabled", False))
    setattr(settings, attr, value)
    return {"flag": flag_name, "enabled": value}


# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM HEALTH
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/health")
async def system_health(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """
    Real system health check — tests DB, pgvector, Redis, AI providers.
    Used by the System Health frontend page.
    """
    components = []

    # Database
    try:
        from sqlalchemy import text
        await db.execute(text("SELECT 1"))
        components.append({"name": "database", "status": "ok", "detail": "PostgreSQL connected"})
    except Exception as e:
        components.append({"name": "database", "status": "down", "detail": str(e)})

    # pgvector
    try:
        from sqlalchemy import text
        await db.execute(text("SELECT vector_dims(ARRAY[1,2,3]::vector)"))
        components.append({"name": "pgvector", "status": "ok", "detail": "pgvector extension active"})
    except Exception as e:
        components.append({"name": "pgvector", "status": "degraded",
                           "detail": f"pgvector not available: {e}"})

    # Redis
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        await r.close()
        components.append({"name": "redis", "status": "ok", "detail": "Redis connected"})
    except Exception as e:
        components.append({"name": "redis", "status": "degraded",
                           "detail": f"Redis unavailable — using fallback queue: {e}"})

    # Gemini AI
    from app.services.ai.gemini import gemini as gemini_client
    if gemini_client._gemini_available:
        components.append({"name": "gemini_ai", "status": "ok",
                           "detail": "Gemini Layer 1 ready"})
    elif gemini_client._groq_client:
        components.append({"name": "gemini_ai", "status": "degraded",
                           "detail": "Gemini unavailable — Groq Layer 2 active"})
    else:
        components.append({"name": "gemini_ai", "status": "down",
                           "detail": "No AI provider configured. Add GEMINI_API_KEY to .env"})

    # BGE Embeddings
    try:
        from app.services.ai.embedding import embedding_service
        if embedding_service.is_ready:
            components.append({"name": "embeddings", "status": "ok",
                               "detail": "BGE-small-en-v1.5 loaded locally"})
        else:
            components.append({"name": "embeddings", "status": "degraded",
                               "detail": "Embedding model not yet loaded — first upload triggers download (~130MB)"})
    except Exception:
        components.append({"name": "embeddings", "status": "degraded",
                           "detail": "Embedding service not initialised"})

    # Overall
    statuses = [c["status"] for c in components]
    overall = (
        "ok"       if all(s == "ok" for s in statuses)   else
        "degraded" if "down" not in statuses               else
        "down"
    )

    return {
        "overall": overall,
        "checked_at": datetime.utcnow().isoformat(),
        "components": components,
    }
    