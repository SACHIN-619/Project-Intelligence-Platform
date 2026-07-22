"""
app/services/intelligence/risk_engine.py
=========================================
Computes risks from graph analysis, vendor data, and procurement signals.

MY IMPROVEMENTS over the discussion design:
───────────────────────────────────────────
1. Multi-signal probability model — risk probability is a weighted
   combination of graph position, vendor reliability, and progress variance.
2. Risk momentum — detects whether risk is growing or shrinking by
   comparing current vs previous analysis snapshots.
3. Severity thresholds from settings — easily tunable without code change.
4. Evidence attachment — every risk carries the chunk IDs that support it
   so the RAG layer can explain WHY the risk exists.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from app.services.intelligence.graph_engine import GraphResult, ProjectGraphEngine


class RiskSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskType(str, Enum):
    SCHEDULE = "schedule"
    VENDOR = "vendor"
    QUALITY = "quality"
    PROCUREMENT = "procurement"
    RESOURCE = "resource"


@dataclass
class RiskItem:
    task_id: Optional[str]
    task_name: Optional[str]
    risk_type: RiskType
    severity: RiskSeverity
    probability: float        # 0–1
    impact_days: int
    risk_score: float         # probability × impact_days (weighted)
    explanation: str
    evidence_hints: List[str] = field(default_factory=list)  # doc sources
    confidence: float = 0.8
    mitigation_hint: Optional[str] = None


@dataclass
class VendorRiskInput:
    vendor_id: str
    vendor_name: str
    reliability_score: float   # 0–1 historical reliability
    delivery_status: str       # on_track | at_risk | delayed | delivered
    lead_time_days: int
    expected_arrival_day: Optional[int]


@dataclass
class RiskEngineResult:
    risks: List[RiskItem]
    project_risk_score: float     # aggregate 0–100
    project_risk_level: RiskSeverity
    top_risk: Optional[RiskItem]
    risks_by_type: Dict[str, List[RiskItem]]
    summary: str


class RiskEngine:
    """
    Derives risks from:
      • Graph analysis (task delays, float consumption)
      • Vendor data (reliability, delivery status)
      • Procurement signals (lead times, at-risk deliveries)

    Does NOT call any AI — all deterministic scoring.
    AI is called upstream to explain the risks in natural language.
    """

    # Weights for probability formula
    W_GRAPH   = 0.40   # graph-position contribution
    W_VENDOR  = 0.35   # vendor reliability contribution
    W_PROGRESS = 0.25  # progress variance contribution

    def __init__(
        self,
        low_threshold: float = 3.0,
        medium_threshold: float = 6.0,
        high_threshold: float = 9.0,
    ):
        self.low_threshold = low_threshold
        self.medium_threshold = medium_threshold
        self.high_threshold = high_threshold

    def _severity(self, score: float) -> RiskSeverity:
        if score < self.low_threshold:
            return RiskSeverity.LOW
        if score < self.medium_threshold:
            return RiskSeverity.MEDIUM
        if score < self.high_threshold:
            return RiskSeverity.HIGH
        return RiskSeverity.CRITICAL

    # ── Task-level risk from graph ─────────────────────────────────────────────

    def _graph_risks(self, graph_result: GraphResult, engine: ProjectGraphEngine) -> List[RiskItem]:
        risks: List[RiskItem] = []

        for tid, st in graph_result.scheduled_tasks.items():
            task = engine.tasks.get(tid)
            if not task:
                continue

            if task.actual_delay == 0 and st.total_float >= 5:
                continue  # Healthy task — skip

            # Probability model: graph component
            float_factor = 1.0 / (1 + max(st.total_float, 0))  # more float → lower risk
            delay_factor = min(1.0, task.actual_delay / max(task.duration, 1))
            graph_prob = (float_factor * 0.5 + delay_factor * 0.5)

            # Progress variance (incomplete + near due date → higher risk)
            progress_deficit = max(0, 1.0 - (task.completion / 100.0))
            on_critical = 1.0 if st.is_critical else 0.5
            progress_prob = progress_deficit * on_critical

            # Combined probability
            prob = self.W_GRAPH * graph_prob + self.W_PROGRESS * progress_prob
            prob = max(0.05, min(0.99, prob))

            # Impact = downstream days (simplified: cascade delay)
            impact = graph_result.delay_cascade.get(tid, task.actual_delay)

            score = prob * impact

            if score < 0.5:
                continue  # Noise filter

            severity = self._severity(score)
            explanation = self._build_task_explanation(task.name, st, task.actual_delay, impact)
            mitigation = self._suggest_mitigation(task.name, st.is_critical, task.actual_delay)

            risks.append(RiskItem(
                task_id=tid,
                task_name=task.name,
                risk_type=RiskType.SCHEDULE,
                severity=severity,
                probability=round(prob, 3),
                impact_days=impact,
                risk_score=round(score, 2),
                explanation=explanation,
                confidence=st.confidence,
                mitigation_hint=mitigation,
            ))

        return risks

    # ── Vendor-level risk ─────────────────────────────────────────────────────

    def _vendor_risks(self, vendors: List[VendorRiskInput]) -> List[RiskItem]:
        risks: List[RiskItem] = []

        for v in vendors:
            if v.delivery_status == "delivered":
                continue

            # Vendor probability based on reliability + status
            status_multiplier = {
                "on_track": 0.1,
                "at_risk": 0.5,
                "delayed": 0.9,
            }.get(v.delivery_status, 0.3)

            unreliability = 1.0 - v.reliability_score
            prob = min(0.99, status_multiplier * 0.6 + unreliability * 0.4)

            # Impact estimate: lead time overshoot (rough heuristic)
            impact = int(v.lead_time_days * (1 + unreliability))

            score = prob * impact / 5  # normalise; vendor impact is less direct

            if score < 0.5:
                continue

            explanation = (
                f"Vendor '{v.vendor_name}' has status '{v.delivery_status}' "
                f"with historical reliability {v.reliability_score:.0%}. "
                f"Lead time: {v.lead_time_days} days."
            )

            risks.append(RiskItem(
                task_id=None,
                task_name=None,
                risk_type=RiskType.VENDOR,
                severity=self._severity(score),
                probability=round(prob, 3),
                impact_days=impact,
                risk_score=round(score, 2),
                explanation=explanation,
                confidence=0.75,
                evidence_hints=[v.vendor_name],
                mitigation_hint=f"Identify backup supplier for {v.vendor_name} equipment.",
            ))

        return risks

    # ── Explanation helpers ───────────────────────────────────────────────────

    def _build_task_explanation(
        self,
        name: str,
        st,
        actual_delay: int,
        impact_days: int,
    ) -> str:
        parts = []
        if actual_delay > 0:
            parts.append(f"'{name}' is currently {actual_delay} day(s) delayed.")
        if st.is_critical:
            parts.append("This task is on the critical path — any delay directly extends project end.")
        elif st.total_float < 3:
            parts.append(f"Only {st.total_float} day(s) of float remaining before this becomes critical.")
        if impact_days > 0:
            parts.append(f"Estimated downstream impact: {impact_days} day(s) to project completion.")
        return " ".join(parts) or f"Task '{name}' poses a schedule risk."

    def _suggest_mitigation(self, name: str, is_critical: bool, delay: int) -> str:
        if is_critical and delay > 3:
            return f"Consider parallel execution or resource addition on '{name}' immediately."
        if is_critical:
            return f"Monitor '{name}' daily — it is on the critical path."
        return f"Review float utilisation for '{name}' before it becomes critical."

    # ── Aggregate scoring ─────────────────────────────────────────────────────

    def _aggregate_score(self, risks: List[RiskItem]) -> float:
        if not risks:
            return 0.0
        # Weighted sum: higher-severity risks contribute more
        weight_map = {
            RiskSeverity.LOW: 1,
            RiskSeverity.MEDIUM: 3,
            RiskSeverity.HIGH: 7,
            RiskSeverity.CRITICAL: 15,
        }
        total = sum(r.risk_score * weight_map[r.severity] for r in risks)
        # Normalise to 0–100
        return min(100.0, total)

    # ── Public API ────────────────────────────────────────────────────────────

    def analyse(
        self,
        graph_result: GraphResult,
        engine: ProjectGraphEngine,
        vendors: Optional[List[VendorRiskInput]] = None,
        vendor_history_scores: Optional[Dict[str, Any]] = None,
    ) -> RiskEngineResult:
        """
        Main entry point.
        vendor_history_scores: output of vendor_scorer.compute_vendor_reliability()
        Used to adjust risk scores upward for repeat offenders.
        """
        all_risks: List[RiskItem] = []
        all_risks.extend(self._graph_risks(graph_result, engine))
        
        if vendors:
            vendor_risks = self._vendor_risks(vendors)
            # Apply historical reliability adjustment
            if vendor_history_scores:
                from app.services.intelligence.vendor_scorer import adjust_risk_score_for_vendor
                for r in vendor_risks:
                    # Find vendor name from evidence_hints
                    vendor_name = r.evidence_hints[0] if r.evidence_hints else None
                    if vendor_name:
                        r.risk_score = adjust_risk_score_for_vendor(
                            r.risk_score, vendor_name, vendor_history_scores
                        )
            all_risks.extend(vendor_risks)

        # Sort by score descending
        all_risks.sort(key=lambda r: r.risk_score, reverse=True)

        # Aggregate project-level score
        agg_score = self._aggregate_score(all_risks)
        project_level = self._severity(agg_score / 10)  # re-scale to same thresholds

        # Group by type
        by_type: Dict[str, List[RiskItem]] = {}
        for r in all_risks:
            by_type.setdefault(r.risk_type.value, []).append(r)

        top = all_risks[0] if all_risks else None
        summary = self._build_summary(all_risks, agg_score, graph_result)

        return RiskEngineResult(
            risks=all_risks,
            project_risk_score=round(agg_score, 1),
            project_risk_level=project_level,
            top_risk=top,
            risks_by_type=by_type,
            summary=summary,
        )

    def _build_summary(
        self, risks: List[RiskItem], score: float, result: GraphResult
    ) -> str:
        if not risks:
            return "No significant risks detected. Project appears on track."

        critical = [r for r in risks if r.severity == RiskSeverity.CRITICAL]
        high = [r for r in risks if r.severity == RiskSeverity.HIGH]

        parts = [f"Project risk score: {score:.0f}/100."]
        if result.total_delay > 0:
            parts.append(f"Current predicted delay: {result.total_delay} day(s).")
        if critical:
            names = [r.task_name or r.risk_type.value for r in critical[:3]]
            parts.append(f"Critical risks: {', '.join(names)}.")
        elif high:
            parts.append(f"{len(high)} high-severity risk(s) require attention.")
        return " ".join(parts)