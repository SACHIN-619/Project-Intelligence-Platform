"""
app/services/ai/orchestrator.py
================================
AI Orchestrator — routes requests to the right AI tier.

Tier 0 → Rules / deterministic (free, instant)
Tier 1 → Local embeddings / HF (free, ~100ms)
Tier 2 → Gemini Flash (paid, ~2s)

MY IMPROVEMENT: Explicit decision tree — no guessing which AI to use.
Every task type has a defined tier so we never accidentally spend
tokens on something rules can handle.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from app.services.ai.gemini import gemini
from app.services.ai.embedding import embedding_service


class TaskType(str, Enum):
    # Tier 0 — rules only
    SCHEMA_MAPPING = "schema_mapping"
    DELAY_CALCULATION = "delay_calculation"
    RISK_SCORING = "risk_scoring"
    RECOVERY_RANKING = "recovery_ranking"
    COMPLIANCE_CHECK = "compliance_check"

    # Tier 1 — embeddings
    SEMANTIC_SEARCH = "semantic_search"
    DOCUMENT_CLASSIFICATION = "document_classification"
    COLUMN_SIMILARITY = "column_similarity"

    # Tier 2 — Gemini
    RISK_EXPLANATION = "risk_explanation"
    RECOVERY_EXPLANATION = "recovery_explanation"
    RAG_SYNTHESIS = "rag_synthesis"
    REPORT_NARRATIVE = "report_narrative"
    QUERY_ANSWER = "query_answer"


# Task → tier assignment
TASK_TIERS: Dict[TaskType, int] = {
    TaskType.SCHEMA_MAPPING:          0,
    TaskType.DELAY_CALCULATION:       0,
    TaskType.RISK_SCORING:            0,
    TaskType.RECOVERY_RANKING:        0,
    TaskType.COMPLIANCE_CHECK:        0,
    TaskType.SEMANTIC_SEARCH:         1,
    TaskType.DOCUMENT_CLASSIFICATION: 1,
    TaskType.COLUMN_SIMILARITY:       1,
    TaskType.RISK_EXPLANATION:        2,
    TaskType.RECOVERY_EXPLANATION:    2,
    TaskType.RAG_SYNTHESIS:           2,
    TaskType.REPORT_NARRATIVE:        2,
    TaskType.QUERY_ANSWER:            2,
}


class AIOrchestrator:
    """
    Single entry point for all AI calls.

    Usage:
        orch = AIOrchestrator()
        result = await orch.run(TaskType.RISK_EXPLANATION, context={...})
    """

    def __init__(self):
        self._cache: Dict[str, Any] = {}   # simple in-memory cache

    def _cache_key(self, task: TaskType, context: Dict) -> str:
        import hashlib, json
        raw = f"{task.value}:{json.dumps(context, sort_keys=True, default=str)}"
        return hashlib.md5(raw.encode()).hexdigest()[:16]

    def get_tier(self, task: TaskType) -> int:
        return TASK_TIERS.get(task, 2)

    async def run(
        self,
        task: TaskType,
        context: Dict[str, Any],
        use_cache: bool = True,
        fallback: Any = None,
    ) -> Any:
        """Route a task to the correct AI tier and return result."""
        # Check cache
        if use_cache:
            key = self._cache_key(task, context)
            if key in self._cache:
                return self._cache[key]

        tier = self.get_tier(task)
        result = None

        try:
            if tier == 0:
                result = self._run_tier0(task, context)
            elif tier == 1:
                result = self._run_tier1(task, context)
            elif tier == 2:
                result = await self._run_tier2(task, context)
        except Exception as e:
            print(f"[Orchestrator] Tier {tier} failed for {task}: {e}")
            if fallback is not None:
                return fallback

        if result is None:
            return fallback

        if use_cache:
            self._cache[key] = result
        return result

    # ── Tier 0: Rules ─────────────────────────────────────────────────────────

    def _run_tier0(self, task: TaskType, context: Dict) -> Any:
        """Deterministic responses — no AI needed."""
        if task == TaskType.SCHEMA_MAPPING:
            # Handled by schema_mapper.py — orchestrator just routes
            return {"handled_by": "schema_mapper"}
        if task == TaskType.DELAY_CALCULATION:
            return {"handled_by": "graph_engine"}
        if task == TaskType.RISK_SCORING:
            return {"handled_by": "risk_engine"}
        return None

    # ── Tier 1: Embeddings ────────────────────────────────────────────────────

    def _run_tier1(self, task: TaskType, context: Dict) -> Any:
        if task == TaskType.SEMANTIC_SEARCH:
            query = context.get("query", "")
            return embedding_service.embed(query) if query else None

        if task == TaskType.COLUMN_SIMILARITY:
            col = context.get("column", "")
            return embedding_service.embed(col) if col else None

        if task == TaskType.DOCUMENT_CLASSIFICATION:
            text = context.get("text", "")[:500]
            # Simple keyword-based classification (no model needed)
            text_l = text.lower()
            if any(k in text_l for k in ["schedule", "gantt", "milestone", "wbs"]):
                return "schedule"
            if any(k in text_l for k in ["vendor", "supplier", "lead time", "delivery"]):
                return "vendor"
            if any(k in text_l for k in ["specification", "standard", "complian"]):
                return "spec"
            if any(k in text_l for k in ["rfi", "request for information"]):
                return "rfi"
            return "general"
        return None

    # ── Tier 2: Gemini ────────────────────────────────────────────────────────

    async def _run_tier2(self, task: TaskType, context: Dict) -> Any:
        if not gemini.is_available:
            return None

        if task == TaskType.RISK_EXPLANATION:
            return gemini.explain_risks(
                project_name=context.get("project_name", "Project"),
                delay_days=context.get("delay_days", 0),
                risk_items=context.get("risks", []),
                confidence=context.get("confidence", 0.8),
            )

        if task == TaskType.RECOVERY_EXPLANATION:
            return gemini.explain_recovery(
                action_type=context.get("action_type", ""),
                task_name=context.get("task_name", ""),
                days_saved=context.get("days_saved", 0),
                confidence=context.get("confidence", 0.8),
                evidence=context.get("evidence", []),
            )

        if task == TaskType.RAG_SYNTHESIS:
            return gemini.answer_rag_query(
                question=context.get("question", ""),
                retrieved_chunks=context.get("chunks", []),
                project_context=context.get("project_context", {}),
                confidence=context.get("confidence", 0.7),
            )

        if task == TaskType.REPORT_NARRATIVE:
            return gemini.generate_report_narrative(
                project_data=context.get("project", {}),
                risks=context.get("risks", []),
                scenarios=context.get("scenarios", []),
            )

        return None

    # ── Budget tracking ────────────────────────────────────────────────────────

    def clear_cache(self) -> None:
        self._cache.clear()


# Singleton
orchestrator = AIOrchestrator()
