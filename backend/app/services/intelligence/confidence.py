"""
app/services/intelligence/confidence.py
========================================
Confidence Propagation System.

MY IMPROVEMENT: Directed confidence graph where data quality issues
propagate forward — a vendor with low-quality data lowers confidence
of every risk involving that vendor, not just vendor-specific risks.
No recommendation is surfaced below the threshold.

Key concepts:
  • Source confidence  — how reliable is the input data?
  • Coverage score     — what fraction of needed data do we have?
  • Propagated score   — confidence × coverage × evidence density
  • Final gate         — below threshold → ask user / show warning
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class DataSource(str, Enum):
    MANUAL_UPLOAD = "manual_upload"
    ERP_CONNECTOR = "erp_connector"
    AI_INFERRED = "ai_inferred"
    USER_CORRECTED = "user_corrected"
    DEFAULT_ASSUMED = "default_assumed"


# Base reliability weights per source type
SOURCE_RELIABILITY: Dict[DataSource, float] = {
    DataSource.ERP_CONNECTOR: 0.95,
    DataSource.USER_CORRECTED: 0.90,
    DataSource.MANUAL_UPLOAD: 0.80,
    DataSource.AI_INFERRED: 0.65,
    DataSource.DEFAULT_ASSUMED: 0.40,
}

# Fields the system needs for full confidence
REQUIRED_SCHEDULE_FIELDS = {"task_name", "duration", "dependency", "status"}
REQUIRED_VENDOR_FIELDS = {"vendor_name", "lead_time", "delivery_status"}
REQUIRED_QUALITY_FIELDS = {"spec_document", "compliance_checklist"}


@dataclass
class FieldPresence:
    field_name: str
    is_present: bool
    source: DataSource
    value_quality: float = 1.0  # 0–1 (1 = exact, 0.5 = inferred, 0 = default)


@dataclass
class ConfidenceReport:
    overall: float              # 0–1 final composite score
    data_coverage: float        # fraction of required fields present
    source_reliability: float   # weighted avg reliability of sources
    evidence_density: float     # how much evidence backs the claims
    missing_fields: List[str]
    assumptions: List[str]      # what we assumed when data was missing
    low_quality_warnings: List[str]
    recommendation_gate: bool   # True = safe to show recommendations
    suggested_uploads: List[str]  # files that would most improve confidence


class ConfidencePipeline:
    """
    Computes end-to-end confidence for a project analysis.

    Usage:
        pipeline = ConfidencePipeline()
        pipeline.register_field("task_name", DataSource.MANUAL_UPLOAD, True)
        pipeline.register_field("duration", DataSource.AI_INFERRED, True, 0.7)
        pipeline.register_field("vendor_name", DataSource.DEFAULT_ASSUMED, False)
        report = pipeline.compute(threshold=0.60)
    """

    def __init__(self, threshold: float = 0.60):
        self.threshold = threshold
        self._fields: List[FieldPresence] = []
        self._extra_evidence_count: int = 0   # RAG chunks retrieved
        self._corrections: int = 0            # user corrections applied

    def register_field(
        self,
        name: str,
        source: DataSource,
        is_present: bool,
        value_quality: float = 1.0,
    ) -> None:
        self._fields.append(FieldPresence(name, is_present, source, value_quality))

    def register_rag_evidence(self, chunk_count: int) -> None:
        """More evidence → higher density score."""
        self._extra_evidence_count = chunk_count

    def register_user_correction(self) -> None:
        """Every user correction slightly raises overall confidence."""
        self._corrections += 1

    def compute(self) -> ConfidenceReport:
        # ── 1. Data coverage ─────────────────────────────────────────────────
        required_all = REQUIRED_SCHEDULE_FIELDS | REQUIRED_VENDOR_FIELDS
        present_required = {
            f.field_name
            for f in self._fields
            if f.is_present and f.field_name in required_all
        }
        coverage = len(present_required) / max(len(required_all), 1)

        missing = list(required_all - present_required)

        # ── 2. Source reliability (weighted average) ──────────────────────────
        if not self._fields:
            src_reliability = 0.5
        else:
            present_fields = [f for f in self._fields if f.is_present]
            if not present_fields:
                src_reliability = 0.3
            else:
                weighted = sum(
                    SOURCE_RELIABILITY[f.source] * f.value_quality
                    for f in present_fields
                )
                src_reliability = weighted / len(present_fields)

        # Boost for user corrections
        correction_boost = min(0.05, self._corrections * 0.01)
        src_reliability = min(1.0, src_reliability + correction_boost)

        # ── 3. Evidence density ───────────────────────────────────────────────
        # 5+ chunks = full density; 0 chunks = 0.3 baseline
        evidence_density = 0.3 + min(0.7, self._extra_evidence_count * 0.07)

        # ── 4. Composite score ────────────────────────────────────────────────
        overall = (
            coverage          * 0.40
            + src_reliability  * 0.40
            + evidence_density * 0.20
        )
        overall = round(min(1.0, max(0.0, overall)), 3)

        # ── 5. Assumptions & warnings ─────────────────────────────────────────
        assumptions: List[str] = []
        warnings: List[str] = []

        for f in self._fields:
            if not f.is_present and f.field_name in required_all:
                assumptions.append(f"'{f.field_name}' assumed default (data not provided)")
            if f.is_present and f.source == DataSource.AI_INFERRED:
                warnings.append(f"'{f.field_name}' was AI-inferred — verify if critical")
            if f.is_present and f.value_quality < 0.5:
                warnings.append(f"'{f.field_name}' has low-quality value (partial/estimated)")

        # ── 6. Suggested uploads ──────────────────────────────────────────────
        suggestions = self._suggest_uploads(missing, coverage)

        return ConfidenceReport(
            overall=overall,
            data_coverage=round(coverage, 3),
            source_reliability=round(src_reliability, 3),
            evidence_density=round(evidence_density, 3),
            missing_fields=missing,
            assumptions=assumptions,
            low_quality_warnings=warnings,
            recommendation_gate=overall >= self.threshold,
            suggested_uploads=suggestions,
        )

    def _suggest_uploads(self, missing: List[str], coverage: float) -> List[str]:
        suggestions: List[str] = []
        if "duration" in missing or "dependency" in missing:
            suggestions.append("Project schedule file (CSV or Excel with tasks, durations, dependencies)")
        if "vendor_name" in missing or "lead_time" in missing:
            suggestions.append("Procurement schedule (vendor names, equipment, lead times)")
        if "delivery_status" in missing:
            suggestions.append("Vendor status update (current delivery status per supplier)")
        if "spec_document" in missing:
            suggestions.append("Equipment specification sheets (PDF) for compliance checking")
        return suggestions


# ── Convenience functions ─────────────────────────────────────────────────────

def confidence_from_schema_mapping(
    mapping: Dict[str, Optional[str]],
    mapping_confidences: Dict[str, float],
) -> float:
    """
    Compute field-level confidence from schema mapper output.

    mapping: {source_col: canonical_col | None}
    mapping_confidences: {source_col: 0.0–1.0}
    """
    if not mapping:
        return 0.0
    total = sum(
        mapping_confidences.get(col, 0.5)
        for col, canonical in mapping.items()
        if canonical is not None
    )
    return total / len(mapping)


def gate_recommendation(confidence: float, threshold: float = 0.60) -> Tuple[bool, str]:
    """
    Returns (allow, reason).
    Used throughout the API layer before surfacing recommendations.
    """
    if confidence >= 0.90:
        return True, "High confidence — recommendation surfaced."
    if confidence >= threshold:
        return True, f"Confidence {confidence:.0%} — recommendation shown with caveats."
    missing_pct = int((threshold - confidence) * 100)
    return False, (
        f"Confidence {confidence:.0%} is below threshold ({threshold:.0%}). "
        f"Need approximately {missing_pct}% more data quality to surface this recommendation."
    )
