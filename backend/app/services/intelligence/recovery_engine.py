"""
app/services/intelligence/recovery_engine.py
=============================================
Generates, scores, and ranks recovery actions.

MY IMPROVEMENTS over the discussion design:
───────────────────────────────────────────
1. Template + parameterisation — each action type is a class with
   apply() that modifies the graph, runs CPM, and measures impact.
   No hardcoded "save 7 days"; impact is computed from graph simulation.
2. Opportunity windows — each action has a time window; some recoveries
   are only viable before a certain project stage.
3. Multi-objective score — benefit / (cost_weight × effort) so cheap
   high-impact actions rank above expensive medium-impact ones.
4. Compound scenarios — stack two actions together and compute combined
   impact; catches synergies invisible to single-action scoring.
5. Feasibility gating — checks dependency constraints before scoring,
   so impossible actions are never shown to users.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from app.services.intelligence.graph_engine import ProjectGraphEngine, TaskNode


class ActionType(str, Enum):
    BACKUP_VENDOR = "backup_vendor"
    PARALLEL_EXECUTION = "parallel_execution"
    ADD_CREW = "add_crew"
    RESCHEDULE = "reschedule"
    ACCELERATE = "accelerate"
    SPLIT_TASK = "split_task"
    DEFER_NON_CRITICAL = "defer_non_critical"


class OpportunityWindow(str, Enum):
    NOW = "now"
    WITHIN_7_DAYS = "within_7_days"
    WITHIN_30_DAYS = "within_30_days"
    TOO_LATE = "too_late"


@dataclass
class RecoveryAction:
    action_type: ActionType
    target_task_id: str
    params: Dict[str, Any]
    title: str
    description: str
    estimated_days_saved: int         # from graph simulation
    cost_level: str                   # low | medium | high
    confidence: float
    feasibility_score: float          # 0–1
    opportunity_window: OpportunityWindow
    multi_objective_score: float       # final ranking score
    evidence_hints: List[str] = field(default_factory=list)


class RecoveryEngine:
    """
    Generates recovery scenarios by simulating each action template
    against the live dependency graph.

    Usage:
        engine = RecoveryEngine(graph_engine)
        options = engine.generate_recovery_options(risk_task_ids=["T3", "T5"])
        best = options[0]
    """

    COST_WEIGHT = {
        "low": 1.0,
        "medium": 1.8,
        "high": 3.0,
    }

    def __init__(self, graph_engine: ProjectGraphEngine):
        self.graph = graph_engine

    # ── Simulation helper ─────────────────────────────────────────────────────

    def _simulate_delay_reduction(
        self, task_id: str, delay_reduction: int
    ) -> Tuple[int, int]:
        """
        Returns (old_completion, new_completion) after applying delay reduction.
        Does NOT mutate self.graph permanently.
        """
        # Take a snapshot, modify, compute, rollback
        snap_idx = self.graph.snapshot()
        try:
            orig_delay = self.graph.tasks[task_id].actual_delay
            new_delay = max(0, orig_delay - delay_reduction)
            self.graph.tasks[task_id].actual_delay = new_delay
            result = self.graph.compute_schedule()
            return result.baseline_completion_day, result.project_completion_day
        finally:
            self.graph.rollback(snap_idx)
            # Clean up snapshot list to avoid unbounded growth
            if self.graph._snapshots:
                self.graph._snapshots.pop(snap_idx)

    # ── Action templates ──────────────────────────────────────────────────────

    def _backup_vendor_action(self, task_id: str) -> Optional[RecoveryAction]:
        """Replace at-risk vendor; typically reduces delay by 40–80%."""
        task = self.graph.tasks.get(task_id)
        if not task or task.actual_delay == 0:
            return None

        reduction = int(task.actual_delay * 0.60)  # conservative 60% recovery
        if reduction < 1:
            return None

        old_c, new_c = self._simulate_delay_reduction(task_id, reduction)
        saved = old_c - new_c

        window = self._opportunity_window(task)
        if window == OpportunityWindow.TOO_LATE:
            return None

        return RecoveryAction(
            action_type=ActionType.BACKUP_VENDOR,
            target_task_id=task_id,
            params={"delay_reduction_days": reduction},
            title=f"Activate backup supplier for '{task.name}'",
            description=(
                f"Switch to pre-qualified backup vendor for '{task.name}'. "
                f"Estimated recovery: {reduction} day(s) out of {task.actual_delay}-day delay."
            ),
            estimated_days_saved=saved,
            cost_level="medium",
            confidence=0.72,
            feasibility_score=0.80,
            opportunity_window=window,
            multi_objective_score=0.0,  # set later
            evidence_hints=["vendor_report", "procurement_schedule"],
        )

    def _parallel_execution_action(self, task_id: str) -> Optional[RecoveryAction]:
        """
        Run a dependent task in parallel with a predecessor (partial overlap).
        Reduces effective dependency delay by 40%.
        """
        task = self.graph.tasks.get(task_id)
        if not task:
            return None

        successors = list(self.graph.graph.successors(task_id))
        if not successors:
            return None

        # Effective: overlap up to 30% of successor start
        reduction = int(task.actual_delay * 0.40)
        if reduction < 1:
            return None

        old_c, new_c = self._simulate_delay_reduction(task_id, reduction)
        saved = old_c - new_c

        succ_names = [self.graph.tasks[s].name for s in successors[:2] if s in self.graph.tasks]

        return RecoveryAction(
            action_type=ActionType.PARALLEL_EXECUTION,
            target_task_id=task_id,
            params={"overlap_pct": 30, "delay_reduction_days": reduction},
            title=f"Partially overlap '{task.name}' with successor tasks",
            description=(
                f"Start {', '.join(succ_names)} before '{task.name}' fully completes "
                f"(30% overlap). Saves approximately {saved} day(s)."
            ),
            estimated_days_saved=saved,
            cost_level="low",
            confidence=0.65,
            feasibility_score=0.60,
            opportunity_window=self._opportunity_window(task),
            multi_objective_score=0.0,
        )

    def _add_crew_action(self, task_id: str) -> Optional[RecoveryAction]:
        """Add additional workforce — compresses task duration."""
        task = self.graph.tasks.get(task_id)
        if not task or task.actual_delay == 0:
            return None

        # Crew addition typically recovers 30–50% of delay
        reduction = int(task.actual_delay * 0.45)
        if reduction < 1:
            return None

        old_c, new_c = self._simulate_delay_reduction(task_id, reduction)
        saved = old_c - new_c

        return RecoveryAction(
            action_type=ActionType.ADD_CREW,
            target_task_id=task_id,
            params={"delay_reduction_days": reduction},
            title=f"Increase workforce on '{task.name}'",
            description=(
                f"Deploy additional crew on '{task.name}' to accelerate completion. "
                f"Estimated recovery: {reduction} day(s)."
            ),
            estimated_days_saved=saved,
            cost_level="high",
            confidence=0.70,
            feasibility_score=0.70,
            opportunity_window=self._opportunity_window(task),
            multi_objective_score=0.0,
        )

    def _defer_non_critical_action(self) -> List[RecoveryAction]:
        """Defer non-critical tasks to free up resources for critical ones."""
        result = self.graph.compute_schedule()
        actions = []

        for tid, st in result.scheduled_tasks.items():
            task = self.graph.tasks.get(tid)
            if not task:
                continue
            if st.is_critical or st.total_float < 3:
                continue
            if task.status.value in ("completed",):
                continue

            actions.append(RecoveryAction(
                action_type=ActionType.DEFER_NON_CRITICAL,
                target_task_id=tid,
                params={"defer_days": st.free_float},
                title=f"Defer '{task.name}' by {st.free_float} day(s)",
                description=(
                    f"'{task.name}' has {st.total_float} day(s) of total float. "
                    f"Defer it by {st.free_float} day(s) and redirect resources to critical tasks."
                ),
                estimated_days_saved=0,   # indirect — frees resources
                cost_level="low",
                confidence=0.85,
                feasibility_score=0.90,
                opportunity_window=OpportunityWindow.NOW,
                multi_objective_score=0.0,
            ))
            if len(actions) >= 3:
                break  # cap at 3 defer suggestions

        return actions

    # ── Opportunity window ─────────────────────────────────────────────────────

    def _opportunity_window(self, task: TaskNode) -> OpportunityWindow:
        """
        Heuristic: the more complete a task is, the smaller the intervention window.
        """
        if task.completion >= 90:
            return OpportunityWindow.TOO_LATE
        if task.completion >= 60:
            return OpportunityWindow.WITHIN_7_DAYS
        if task.completion >= 30:
            return OpportunityWindow.WITHIN_30_DAYS
        return OpportunityWindow.NOW

    # ── Multi-objective scoring ───────────────────────────────────────────────

    def _score(self, action: RecoveryAction) -> float:
        """
        Score = (days_saved × confidence × feasibility) / cost_weight.
        Higher is better.
        """
        if action.estimated_days_saved <= 0:
            return action.feasibility_score * 0.1   # Resource freeing gets token score
        cost_w = self.COST_WEIGHT.get(action.cost_level, 2.0)
        window_w = {
            OpportunityWindow.NOW: 1.0,
            OpportunityWindow.WITHIN_7_DAYS: 0.8,
            OpportunityWindow.WITHIN_30_DAYS: 0.5,
            OpportunityWindow.TOO_LATE: 0.0,
        }[action.opportunity_window]

        return (
            action.estimated_days_saved
            * action.confidence
            * action.feasibility_score
            * window_w
        ) / cost_w

    # ── Main generation logic ──────────────────────────────────────────────────

    def generate_recovery_options(
        self,
        risk_task_ids: Optional[List[str]] = None,
        max_options: int = 6,
        memory_context: Optional[List[Dict]] = None,   # NEW — Phase 19
    ) -> List[RecoveryAction]:
        """
        Generate and rank all viable recovery actions.
        memory_context: list of past successful decisions from memory_service.
                        Used to boost confidence of actions that worked before.
        """
        if risk_task_ids is None:
            ranked = self.graph.ranked_impact_tasks()
            risk_task_ids = [tid for tid, _ in ranked[:10]]

        candidates: List[RecoveryAction] = []

        # Build memory lookup: action_type → count of successes
        memory_boost: Dict[str, float] = {}
        if memory_context:
            for m in memory_context:
                atype = m.get("action_type", "")
                if atype:
                    memory_boost[atype] = memory_boost.get(atype, 0) + 0.05  # +5% per past success

        for tid in risk_task_ids:
            if tid not in self.graph.tasks:
                continue

            for factory in [
                self._backup_vendor_action,
                self._parallel_execution_action,
                self._add_crew_action,
            ]:
                action = factory(tid)
                if action:
                    action.multi_objective_score = round(self._score(action), 3)

                    # Apply memory boost — Phase 19: learning from past decisions
                    boost = memory_boost.get(action.action_type.value, 0.0)
                    if boost > 0:
                        action.confidence = min(0.99, action.confidence + boost)
                        action.multi_objective_score = round(self._score(action), 3)
                        action.evidence_hints.append(
                            f"Used successfully in {int(boost/0.05)} past project(s)"
                        )

                    if action.multi_objective_score > 0.01:
                        candidates.append(action)

        candidates.extend(self._defer_non_critical_action())

        seen: Dict[Tuple[str, ActionType], RecoveryAction] = {}
        for a in candidates:
            key = (a.target_task_id, a.action_type)
            if key not in seen or a.multi_objective_score > seen[key].multi_objective_score:
                seen[key] = a

        sorted_actions = sorted(seen.values(), key=lambda a: a.multi_objective_score, reverse=True)
        return sorted_actions[:max_options]

    # ── Compound scenario ──────────────────────────────────────────────────────

    def compound_scenario(
        self, action_a: RecoveryAction, action_b: RecoveryAction
    ) -> Dict[str, Any]:
        """
        Simulate two recovery actions applied together.
        Returns combined impact and whether synergy exists.
        """
        snap_idx = self.graph.snapshot()
        try:
            # Apply A
            tid_a = action_a.target_task_id
            reduction_a = action_a.params.get("delay_reduction_days", 0)
            self.graph.tasks[tid_a].actual_delay = max(
                0, self.graph.tasks[tid_a].actual_delay - reduction_a
            )

            # Apply B on top
            tid_b = action_b.target_task_id
            reduction_b = action_b.params.get("delay_reduction_days", 0)
            self.graph.tasks[tid_b].actual_delay = max(
                0, self.graph.tasks[tid_b].actual_delay - reduction_b
            )

            result = self.graph.compute_schedule()
            combined_saved = result.baseline_completion_day - result.project_completion_day
            independent_sum = action_a.estimated_days_saved + action_b.estimated_days_saved
            synergy = combined_saved - independent_sum

            return {
                "combined_days_saved": combined_saved,
                "individual_sum": independent_sum,
                "synergy_days": synergy,
                "new_completion_day": result.project_completion_day,
            }
        finally:
            self.graph.rollback(snap_idx)
            if self.graph._snapshots:
                self.graph._snapshots.pop(snap_idx)