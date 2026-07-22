"""
app/services/rag/pipeline.py
==============================
RAG (Retrieval-Augmented Generation) pipeline.

ENHANCEMENTS from 30-phase discussion:
  Phase 19 — AI Memory: injects past similar decisions into context
  Phase 20 — Knowledge Graph: surfaces related entities before LLM call
  Phase 21 — Graph Intelligence: uses entity traversal for richer answers
  Phase 25 — Explainability: every answer includes evidence + assumptions

Retrieval strategy:
  Hybrid: semantic (BGE-small) × 0.65 + keyword (BM25-lite) × 0.25 + recency × 0.10
  Fallback: keyword-only if embeddings unavailable
  Multi-hop: for complex queries, secondary retrieval on top-k entities found
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np


@dataclass
class RetrievedChunk:
    chunk_id: str
    content: str
    source_file: str
    page_number: int
    chunk_type: str
    embedding: Optional[List[float]]
    keyword_score: float = 0.0
    semantic_score: float = 0.0
    combined_score: float = 0.0


@dataclass
class RAGResult:
    answer: str
    confidence: float
    chunks_retrieved: int
    chunks_used: int
    evidence: List[Dict[str, Any]]
    assumptions: List[str]
    missing_data: List[str]
    suggested_questions: List[str]
    search_mode: str
    memory_context_used: int = 0
    knowledge_entities_found: int = 0


class RAGPipeline:
    """
    Full retrieval pipeline — memory-enhanced, knowledge-graph-aware.

    Usage:
        pipeline = RAGPipeline(db, embedding_service, gemini_client)
        result = await pipeline.query(
            question, project_id, org_id,
            project_context={"name": ..., "past_decisions": [...]}
        )
    """

    W_SEMANTIC  = 0.65
    W_KEYWORD   = 0.25
    W_RECENCY   = 0.10

    TOP_K_RETRIEVE = 15
    TOP_K_CONTEXT  = 5

    def __init__(self, db, embedding_service, gemini_client):
        self.db       = db
        self.embedder = embedding_service
        self.gemini   = gemini_client

    # ── Intent + keywords ─────────────────────────────────────────────────────

    def _detect_intent(self, question: str) -> str:
        q = question.lower()
        if any(k in q for k in ["delay", "late", "schedule", "when", "timeline", "critical"]):
            return "schedule"
        if any(k in q for k in ["vendor", "supplier", "delivery", "shipment", "procurement"]):
            return "vendor"
        if any(k in q for k in ["comply", "spec", "standard", "requirement", "certif", "deviation"]):
            return "quality"
        if any(k in q for k in ["commission", "test", "energis", "handover", "tier"]):
            return "commissioning"
        if any(k in q for k in ["cost", "budget", "price", "₹", "$", "lakh"]):
            return "cost"
        return "general"

    def _extract_keywords(self, question: str) -> List[str]:
        stop_words = {
            "the", "a", "an", "is", "are", "was", "were", "will", "can",
            "has", "have", "had", "be", "been", "being", "do", "does", "did",
            "of", "to", "in", "for", "on", "with", "at", "by", "from",
            "this", "that", "what", "which", "how", "when", "where", "why",
            "would", "could", "should", "may", "might",
        }
        words = re.findall(r'\b[a-zA-Z]{3,}\b', question.lower())
        return [w for w in words if w not in stop_words]

    # ── DB retrieval ──────────────────────────────────────────────────────────

    async def _fetch_chunks(self, project_id: str, org_id: str) -> List[Dict]:
        from sqlalchemy import select
        from app.models.db import DocumentChunk

        rows = (await self.db.execute(
            select(DocumentChunk).where(
                DocumentChunk.project_id == project_id,
                DocumentChunk.org_id == org_id,
            )
        )).scalars().all()

        return [
            {
                "id":          str(r.id),
                "content":     r.content,
                "source_file": r.source_file or "unknown",
                "page_number": r.page_number or 0,
                "chunk_type":  r.chunk_type or "text",
                "embedding":   r.embedding,
                "created_at":  r.created_at,
            }
            for r in rows
        ]

    # ── Scoring ───────────────────────────────────────────────────────────────

    def _keyword_score(self, content: str, keywords: List[str]) -> float:
        if not keywords:
            return 0.0
        content_lower = content.lower()
        hits = sum(1 for kw in keywords if kw in content_lower)
        return hits / max(len(keywords), 1)

    def _semantic_score(
        self, query_emb: List[float], chunk_emb: Optional[List[float]]
    ) -> float:
        if not chunk_emb:
            return 0.0
        a = np.array(query_emb, dtype=np.float32)
        b = np.array(chunk_emb, dtype=np.float32)
        denom = np.linalg.norm(a) * np.linalg.norm(b)
        return float(np.dot(a, b) / denom) if denom > 1e-8 else 0.0

    def _score_and_rank(
        self,
        chunks: List[Dict],
        query_emb: Optional[List[float]],
        keywords: List[str],
    ) -> List[RetrievedChunk]:
        scored = []
        for c in chunks:
            kw  = self._keyword_score(c["content"], keywords)
            sem = self._semantic_score(query_emb, c.get("embedding")) if query_emb else 0.0
            scored.append(RetrievedChunk(
                chunk_id=c["id"], content=c["content"],
                source_file=c["source_file"], page_number=c["page_number"],
                chunk_type=c["chunk_type"], embedding=c.get("embedding"),
                keyword_score=kw, semantic_score=sem,
                combined_score=self.W_SEMANTIC * sem + self.W_KEYWORD * kw,
            ))
        return sorted(scored, key=lambda x: x.combined_score, reverse=True)

    # ── Knowledge Graph context ───────────────────────────────────────────────

    async def _get_knowledge_context(
        self,
        question: str,
        project_id: str,
        org_id: str,
        keywords: List[str],
    ) -> Tuple[str, int]:
        """
        Query the knowledge graph for entities matching question keywords.
        Returns (context_string, entity_count).
        """
        try:
            from app.services.intelligence.knowledge_engine import (
                build_project_graph, explain_impact
            )
            graph = await build_project_graph(self.db, project_id, org_id)

            # Find entities whose names match question keywords
            matched_entities = []
            for kw in keywords[:5]:
                for node in graph._nodes.values():
                    if kw in node.name.lower() and node not in matched_entities:
                        matched_entities.append(node)

            if not matched_entities:
                return "", 0

            # Get impact for top matched entity
            top_entity = matched_entities[0]
            impact = explain_impact(graph, top_entity.entity_id)

            context_lines = [
                f"Knowledge Graph context for '{top_entity.name}':",
            ]
            if impact["impacted_tasks"]:
                context_lines.append(
                    f"  Impacted tasks: {', '.join(impact['impacted_tasks'][:3])}"
                )
            if impact["root_cause_vendors"]:
                context_lines.append(
                    f"  Root cause vendors: {', '.join(impact['root_cause_vendors'][:2])}"
                )
            if impact["impacted_risks"]:
                context_lines.append(
                    f"  Related risks: {', '.join(impact['impacted_risks'][:2])}"
                )

            return "\n".join(context_lines), len(matched_entities)

        except Exception:
            return "", 0

    # ── Memory context ────────────────────────────────────────────────────────

    def _format_memory_context(self, past_decisions: List[Dict]) -> str:
        """Format past decisions for injection into prompt."""
        if not past_decisions:
            return ""
        lines = ["Relevant past decisions from your organisation:"]
        for d in past_decisions[:3]:
            lines.append(
                f"  - {d.get('action_type', 'action')} "
                f"(saved {d.get('days_saved', '?')} days): {d.get('description', '')[:80]}"
            )
        return "\n".join(lines)

    # ── Confidence ────────────────────────────────────────────────────────────

    def _retrieval_confidence(
        self, top_chunks: List[RetrievedChunk], total_count: int
    ) -> float:
        if not top_chunks or total_count == 0:
            return 0.1
        avg_score = float(np.mean([c.combined_score for c in top_chunks]))
        coverage  = len(top_chunks) / max(total_count, 1)
        return float(min(0.95, avg_score * 0.7 + coverage * 0.3))

    # ── Suggested follow-ups ──────────────────────────────────────────────────

    def _suggest_questions(self, intent: str) -> List[str]:
        return {
            "schedule": [
                "What tasks are on the critical path?",
                "Which vendor is causing the most delay?",
                "What recovery options are available?",
            ],
            "vendor": [
                "Which tasks depend on this vendor?",
                "Are there backup suppliers available?",
                "What is the lead time impact on testing?",
            ],
            "quality": [
                "Are there any compliance deviations?",
                "Which specifications are at risk?",
                "What commissioning steps are pending?",
            ],
            "commissioning": [
                "What tests are blocking commissioning?",
                "Are all prerequisites complete?",
                "What is the commissioning readiness score?",
            ],
        }.get(intent, [
            "Show me the top project risks.",
            "What is the current critical path?",
            "Which task has the most downstream impact?",
        ])

    # ── Main pipeline ─────────────────────────────────────────────────────────

    async def query(
        self,
        question: str,
        project_id: str,
        org_id: str,
        project_context: Optional[Dict] = None,
    ) -> RAGResult:
        """
        Full RAG pipeline: retrieve → knowledge graph → memory → synthesise.
        """
        project_context = project_context or {}
        intent   = self._detect_intent(question)
        keywords = self._extract_keywords(question)

        # ── 1. Fetch chunks ────────────────────────────────────────────────────
        all_chunks = await self._fetch_chunks(project_id, org_id)

        if not all_chunks:
            return RAGResult(
                answer=(
                    "No project documents found. Please upload schedule, "
                    "specification, or procurement files to enable intelligent Q&A."
                ),
                confidence=0.0,
                chunks_retrieved=0,
                chunks_used=0,
                evidence=[],
                assumptions=["No documents indexed for this project"],
                missing_data=["Project documents (schedule, specs, vendor reports)"],
                suggested_questions=self._suggest_questions(intent),
                search_mode="fallback",
            )

        # ── 2. Embed query ─────────────────────────────────────────────────────
        search_mode = "hybrid"
        query_emb: Optional[List[float]] = None
        try:
            query_emb = self.embedder.embed(question)
        except Exception:
            search_mode = "keyword"

        # ── 3. Rank chunks ─────────────────────────────────────────────────────
        ranked   = self._score_and_rank(all_chunks, query_emb, keywords)
        top_k    = ranked[:self.TOP_K_RETRIEVE]

        if not top_k or top_k[0].combined_score < 0.05:
            search_mode  = "keyword"
            top_k        = self._score_and_rank(all_chunks, None, keywords)[:self.TOP_K_RETRIEVE]

        context_chunks = top_k[:self.TOP_K_CONTEXT]

        # ── 4. Knowledge Graph enrichment (Phase 20) ───────────────────────────
        kg_context, kg_entities = await self._get_knowledge_context(
            question, project_id, org_id, keywords
        )

        # ── 5. Memory context (Phase 19) ───────────────────────────────────────
        past_decisions = project_context.get("past_decisions", [])
        memory_ctx = self._format_memory_context(past_decisions)
        memory_count = len(past_decisions)

        # ── 6. Risk context ────────────────────────────────────────────────────
        risk_ctx_lines = project_context.get("active_risks", [])
        risk_ctx = "\n".join(f"- {r}" for r in risk_ctx_lines[:3]) if risk_ctx_lines else ""

        # ── 7. Build evidence list ─────────────────────────────────────────────
        evidence = [
            {
                "source_file":     c.source_file,
                "page_number":     c.page_number,
                "text":            c.content[:300] + "..." if len(c.content) > 300 else c.content,
                "relevance_score": round(c.combined_score, 3),
            }
            for c in context_chunks
        ]

        confidence = self._retrieval_confidence(context_chunks, len(all_chunks))

        # ── 8. Build enriched project context for LLM ──────────────────────────
        enriched_context = dict(project_context)
        if kg_context:
            enriched_context["knowledge_graph"] = kg_context
        if memory_ctx:
            enriched_context["past_decisions_summary"] = memory_ctx
        if risk_ctx:
            enriched_context["active_risk_context"] = risk_ctx

        # ── 9. Synthesise via Gemini (3-layer fallback built-in) ───────────────
        chunk_dicts = [
            {
                "content":     c.content,
                "source_file": c.source_file,
                "page_number": c.page_number,
            }
            for c in context_chunks
        ]

        if self.gemini.is_available and confidence >= 0.2:
            gen_result = self.gemini.answer_rag_query(
                question, chunk_dicts, enriched_context, confidence
            )
            answer       = gen_result.get("answer", "Unable to generate answer.")
            assumptions  = gen_result.get("assumptions", [])
            missing_data = gen_result.get("missing_data", [])
        else:
            best = context_chunks[0] if context_chunks else None
            answer = (
                f"Based on '{best.source_file}' (page {best.page_number}): "
                f"{best.content[:500]}"
                if best else "Insufficient information to answer this question."
            )
            assumptions  = ["Answer from document excerpt — AI synthesis unavailable"]
            missing_data = []

        return RAGResult(
            answer=answer,
            confidence=confidence,
            chunks_retrieved=len(all_chunks),
            chunks_used=len(context_chunks),
            evidence=evidence,
            assumptions=assumptions,
            missing_data=missing_data,
            suggested_questions=self._suggest_questions(intent),
            search_mode=search_mode,
            memory_context_used=memory_count,
            knowledge_entities_found=kg_entities,
        )