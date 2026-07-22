"""
app/services/parser/schema_mapper.py
=====================================
Maps arbitrary uploaded column names → canonical internal schema.

MY IMPROVEMENT: Three-stage cascade with per-stage confidence scores.
Stage 1: Exact dictionary lookup  (confidence 1.0)
Stage 2: Fuzzy string matching    (confidence 0.7–0.9 based on ratio)
Stage 3: Semantic embedding sim   (confidence 0.5–0.8)
Plus: tenant-level memory so each org's column names are learned over time.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from rapidfuzz import fuzz, process

# ── Canonical field definitions ───────────────────────────────────────────────
# Maps canonical name → set of known aliases (for stage 1 lookup)
CANONICAL_ALIASES: Dict[str, List[str]] = {
    # ── task_id MUST be before task_name — prevents fuzzy mismatch ────────────
    "task_id": [
        "task_id", "taskid", "task_no", "task_num", "task_number",
        "activity_id", "activity_no", "id", "item_id", "wbs_code",
        "wbs_id", "ref", "ref_no", "reference", "external_id",
    ],

    # Tasks
    "task_name": [
        "task_name", "task", "activity", "activity_name", "work_item",
        "item", "name", "description", "task_description", "work_package",
        "work_description", "scope", "item_name",
    ],
    "duration": [
        "duration", "duration_days", "days", "planned_days", "effort",
        "work_days", "estimated_days", "task_duration", "baseline_duration",
        "planned_duration",
    ],
    "start_day": [
        "start", "start_day", "start_date", "begin", "begin_date",
        "planned_start", "baseline_start", "commencement", "actual_start",
        "from_date",
    ],
    "end_day": [
        "end", "end_day", "end_date", "finish", "finish_date",
        "planned_finish", "completion_date", "eta", "expected_completion",
        "actual_finish", "to_date", "planned_end",
    ],
    "dependency": [
        "dependency", "depends_on", "predecessor", "predecessors",
        "follows", "after", "requires", "prerequisite", "predecessor_ids",
        "predecessor_id", "prev_task", "links",
    ],
    "status": [
        "status", "task_status", "state", "progress_status",
        "completion_status", "current_status", "delivery_status",
        "work_status",
    ],
    "completion": [
        "completion", "percent_complete", "progress", "done_pct",
        "pct_done", "% complete", "percent", "completion_pct",
        "pct_complete", "percentage_complete",
    ],
    "delay_days": [
        "delay_days", "delay", "slippage", "lag", "lag_days",
        "days_late", "days late", "overrun", "behind_days",
        "delay days", "late_days",
    ],
    "owner": [
        "owner", "assigned_to", "responsible", "assignee", "person",
        "resource", "engineer", "responsible_engineer",
    ],

    # Vendors / procurement
    "vendor_name": [
        "vendor", "supplier", "vendor_name", "supplier_name", "company",
        "manufacturer", "contractor", "responsible_vendor", "vendor name",
    ],
    "equipment_type": [
        "equipment", "equipment_type", "material", "item_type",
        "product", "scope", "equipment_description", "item_description",
    ],
    "lead_time": [
        "lead_time", "lead_time_days", "procurement_lead", "supply_days",
        "delivery_period", "lead time",
    ],
    "delivery_status": [
        "delivery_status", "shipment_status", "supply_status",
        "dispatch_status",
    ],
    "expected_arrival": [
        "expected_arrival", "expected_delivery", "arrival_date",
        "due_date", "delivery_date", "planned_arrival",
        "estimated_delivery", "actual_delivery",
    ],
    "reliability_score": [
        "reliability", "vendor_rating", "score", "rating",
        "performance_score", "vendor_score",
    ],
    "priority": [
        "priority", "risk_level", "criticality", "urgency",
        "importance", "priority_level",
    ],
    "phase": [
        "phase", "stage", "work_phase", "construction_phase",
        "project_phase", "category",
    ],
    "notes": [
        "notes", "remarks", "comments", "additional_info", "note",
    ],

    # Project
    "project_name": ["project", "project_name", "project_title"],
    "site_location": ["site", "location", "site_location", "area", "zone"],
}

# Reverse lookup: alias → canonical
_ALIAS_TO_CANONICAL: Dict[str, str] = {}
for canonical, aliases in CANONICAL_ALIASES.items():
    for alias in aliases:
        _ALIAS_TO_CANONICAL[alias.lower().strip()] = canonical


@dataclass
class MappedField:
    original: str
    canonical: Optional[str]   # None if unmappable
    confidence: float           # 0–1
    method: str                 # exact | fuzzy | semantic | tenant_memory | unmapped


@dataclass
class SchemaMappingResult:
    mappings: List[MappedField]
    quality_score: float     # 0–100 (how well we understood the schema)
    mapped_count: int
    unmapped_columns: List[str]
    assumed_columns: List[str]  # canonical cols inferred from context


class SchemaMapper:
    """
    Three-stage schema mapper with tenant-level learning.

    Usage:
        mapper = SchemaMapper()
        result = mapper.map(["Task Name", "Begin ETA", "Supplier Code"])
    """

    FUZZY_THRESHOLD = 72      # rapidfuzz score 0–100; below this → stage 3
    SEMANTIC_THRESHOLD = 0.60  # cosine similarity; below this → unmapped

    def __init__(self, tenant_memory: Optional[Dict[str, str]] = None):
        """
        tenant_memory: {source_column_lower: canonical} from DB for this org.
        """
        self._memory: Dict[str, str] = tenant_memory or {}
        self._embedder = None   # lazy-loaded to avoid slow import on startup

    # ── Stage 1: exact match ──────────────────────────────────────────────────

    def _exact_match(self, col: str) -> Optional[str]:
        key = self._normalise(col)
        return _ALIAS_TO_CANONICAL.get(key) or self._memory.get(key)

    # ── Stage 2: fuzzy match ──────────────────────────────────────────────────

    def _fuzzy_match(self, col: str) -> Tuple[Optional[str], float]:
        key = self._normalise(col)
        all_aliases = list(_ALIAS_TO_CANONICAL.keys())
        if not all_aliases:
            return None, 0.0

        match, score, _ = process.extractOne(
            key, all_aliases, scorer=fuzz.token_sort_ratio
        ) or (None, 0, None)

        if match and score >= self.FUZZY_THRESHOLD:
            canonical = _ALIAS_TO_CANONICAL[match]
            confidence = round(score / 100 * 0.9, 3)  # cap fuzzy confidence at 0.9
            return canonical, confidence
        return None, 0.0

    # ── Stage 3: semantic (lazy) ──────────────────────────────────────────────

    def _semantic_match(self, col: str) -> Tuple[Optional[str], float]:
        """
        Use sentence-transformers to find the most similar canonical field name.
        Lazy-loads the model on first call.
        """
        try:
            if self._embedder is None:
                from sentence_transformers import SentenceTransformer
                self._embedder = SentenceTransformer("BAAI/bge-small-en-v1.5")

            import numpy as np

            query_emb = self._embedder.encode(col, normalize_embeddings=True)
            canonical_names = list(CANONICAL_ALIASES.keys())
            corpus_emb = self._embedder.encode(canonical_names, normalize_embeddings=True)
            sims = np.dot(corpus_emb, query_emb)
            best_idx = int(np.argmax(sims))
            best_score = float(sims[best_idx])

            if best_score >= self.SEMANTIC_THRESHOLD:
                return canonical_names[best_idx], round(best_score * 0.85, 3)
        except Exception:
            pass  # Model not available — skip semantic stage gracefully
        return None, 0.0

    # ── Normalisation ─────────────────────────────────────────────────────────

    @staticmethod
    def _normalise(col: str) -> str:
        """Lowercase, strip, replace spaces/dashes/dots with underscores."""
        s = col.lower().strip()
        s = re.sub(r"[\s\-./\\]+", "_", s)
        s = re.sub(r"[^a-z0-9_]", "", s)
        s = re.sub(r"_+", "_", s).strip("_")
        return s

    # ── Public API ────────────────────────────────────────────────────────────

    def map_column(self, col: str) -> MappedField:
        """Map a single column name through the cascade."""
        # Stage 0: tenant memory (highest priority)
        key = self._normalise(col)
        if key in self._memory:
            return MappedField(col, self._memory[key], 0.95, "tenant_memory")

        # Stage 1: exact
        exact = self._exact_match(col)
        if exact:
            return MappedField(col, exact, 1.0, "exact")

        # Stage 2: fuzzy
        fuzzy_canonical, fuzzy_conf = self._fuzzy_match(col)
        if fuzzy_canonical:
            return MappedField(col, fuzzy_canonical, fuzzy_conf, "fuzzy")

        # Stage 3: semantic
        sem_canonical, sem_conf = self._semantic_match(col)
        if sem_canonical:
            return MappedField(col, sem_canonical, sem_conf, "semantic")

        return MappedField(col, None, 0.0, "unmapped")

    def map(self, columns: List[str]) -> SchemaMappingResult:
        """Map a list of columns and compute overall quality."""
        mappings = [self.map_column(c) for c in columns]
        mapped = [m for m in mappings if m.canonical is not None]
        unmapped = [m.original for m in mappings if m.canonical is None]

        # Quality = weighted average confidence of mapped fields
        if mapped:
            quality = sum(m.confidence for m in mapped) / len(columns) * 100
        else:
            quality = 0.0

        # What canonical fields did we NOT find?
        found_canonicals = {m.canonical for m in mapped}
        assumed: List[str] = []
        for canon in ("duration", "task_name", "dependency"):
            if canon not in found_canonicals:
                assumed.append(f"'{canon}' not found — will be inferred or prompted")

        return SchemaMappingResult(
            mappings=mappings,
            quality_score=round(quality, 1),
            mapped_count=len(mapped),
            unmapped_columns=unmapped,
            assumed_columns=assumed,
        )

    def learn(self, source_col: str, canonical: str) -> None:
        """
        Record a successful mapping for this tenant session.
        Caller should persist this to SchemaMappingMemory table.
        """
        self._memory[self._normalise(source_col)] = canonical

    def to_dict(self) -> Dict[str, str]:
        """Return {original -> canonical} for storage."""
        return dict(self._memory)


def build_mapper_from_db_memory(memory_rows: List) -> SchemaMapper:
    """
    Helper: reconstruct a SchemaMapper from DB SchemaMappingMemory rows.
    rows should have .source_column and .canonical_column attrs.
    """
    mem = {row.source_column.lower(): row.canonical_column for row in memory_rows}
    return SchemaMapper(tenant_memory=mem)