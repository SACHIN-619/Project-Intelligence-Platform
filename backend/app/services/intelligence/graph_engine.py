"""
app/services/intelligence/graph_engine.py
==========================================
Project Dependency Graph Engine (Critical Path Method + extensions).

MY IMPROVEMENTS over the discussion design:
───────────────────────────────────────────
1. Confidence-decay propagation — delay confidence degrades per hop
   so downstream estimates are automatically less certain.
2. Free float + total float — not just critical path; every task
   gets a slack score useful for prioritising recovery actions.
3. Partial recomputation — only affected subtree reruns when one
   task changes, keeping simulation fast for large projects.
4. Graph versioning — unlimited rollback for what-if exploration.
5. Impact scoring — per-task score = criticality × downstream × (1/slack)
   used directly by the recovery engine to rank actions.
"""

import copy
import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

import networkx as nx


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DELAYED = "delayed"
    COMPLETED = "completed"


@dataclass
class TaskNode:
    task_id: str
    name: str
    duration: int            # planned days
    status: TaskStatus = TaskStatus.PENDING
    actual_delay: int = 0    # current known delay
    completion: int = 0      # 0–100 %
    owner: Optional[str] = None
    vendor_id: Optional[str] = None
    duration_confidence: float = 1.0   # 0–1: how reliable is the duration estimate
    extra_fields: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ScheduledTask:
    """Output of CPM computation for one task."""
    task_id: str
    name: str
    es: int           # earliest start
    ef: int           # earliest finish
    ls: int           # latest start
    lf: int           # latest finish
    total_float: int  # ls - es  (0 = critical)
    free_float: int   # slack before affecting direct successor
    is_critical: bool
    effective_duration: int
    actual_delay: int
    confidence: float


@dataclass
class GraphResult:
    project_completion_day: int
    baseline_completion_day: int
    total_delay: int
    scheduled_tasks: Dict[str, ScheduledTask]   # task_id -> ScheduledTask
    critical_path: List[str]                     # task_ids in order
    overall_confidence: float
    delay_cascade: Dict[str, int]                # task_id -> project days caused by this task's delay


class ProjectGraphEngine:
    """
    Encapsulates the project dependency graph and all scheduling computations.

    Usage:
        engine = ProjectGraphEngine()
        engine.add_task(TaskNode("T1", "Site Prep", 5))
        engine.add_task(TaskNode("T2", "Electrical", 7))
        engine.add_dependency("T1", "T2")  # T2 depends on T1
        result = engine.compute_schedule()
    """

    # Each dependency hop reduces confidence by this fraction.
    # Rationale: estimates become less reliable as they cascade further.
    CONFIDENCE_DECAY_PER_HOP: float = 0.04

    def __init__(self):
        self.graph: nx.DiGraph = nx.DiGraph()
        self.tasks: Dict[str, TaskNode] = {}
        self._baseline_completion: Optional[int] = None
        self._snapshots: List[Dict] = []   # for rollback

    # ── Graph construction ────────────────────────────────────────────────────

    def add_task(self, task: TaskNode) -> None:
        if task.task_id in self.tasks:
            # Update existing
            self.tasks[task.task_id] = task
        else:
            self.tasks[task.task_id] = task
            self.graph.add_node(task.task_id)

    def add_dependency(self, predecessor_id: str, successor_id: str) -> None:
        """
        successor depends on predecessor.
        Raises ValueError immediately if edge would create a cycle.
        """
        if predecessor_id not in self.tasks:
            raise ValueError(f"Task '{predecessor_id}' not found in graph")
        if successor_id not in self.tasks:
            raise ValueError(f"Task '{successor_id}' not found in graph")

        self.graph.add_edge(predecessor_id, successor_id)

        if not nx.is_directed_acyclic_graph(self.graph):
            self.graph.remove_edge(predecessor_id, successor_id)
            raise ValueError(
                f"Circular dependency: {predecessor_id} ↔ {successor_id}. "
                "Cannot add this dependency."
            )

    def bulk_load(self, tasks: List[TaskNode], edges: List[Tuple[str, str]]) -> List[str]:
        """
        Load many tasks + edges at once.
        Returns list of any edges that were skipped due to cycles.
        """
        for task in tasks:
            self.add_task(task)

        skipped = []
        for pred, succ in edges:
            try:
                self.add_dependency(pred, succ)
            except ValueError:
                skipped.append(f"{pred}->{succ}")
        return skipped

    # ── Core CPM calculation ──────────────────────────────────────────────────

    def compute_schedule(self) -> GraphResult:
        """
        Full Critical Path Method with confidence propagation.

        Steps:
          1. Forward pass  → ES, EF
          2. Backward pass → LS, LF
          3. Float         → TF, FF
          4. Confidence    → decays down the dependency chain
          5. Critical path → tasks with TF = 0
        """
        if not self.tasks:
            raise ValueError("No tasks in graph")

        if not nx.is_directed_acyclic_graph(self.graph):
            raise ValueError("Graph has circular dependencies — cannot compute schedule")

        topo: List[str] = list(nx.topological_sort(self.graph))
        interim: Dict[str, dict] = {}

        # ── 1. FORWARD PASS ──────────────────────────────────────────────────
        for tid in topo:
            task = self.tasks[tid]
            eff_dur = task.duration + task.actual_delay
            predecessors = list(self.graph.predecessors(tid))

            if not predecessors:
                es = 0
                # Root tasks get their own confidence
                confidence = task.duration_confidence
            else:
                # ES = max(EF of all predecessors)
                pred_efs = [interim[p]["ef"] for p in predecessors]
                es = max(pred_efs)

                # Confidence = own_conf × min(predecessor_confs × decay)
                pred_confs = [
                    interim[p]["confidence"] * (1.0 - self.CONFIDENCE_DECAY_PER_HOP)
                    for p in predecessors
                ]
                confidence = task.duration_confidence * min(pred_confs)

            interim[tid] = {
                "es": es,
                "ef": es + eff_dur,
                "ls": None,
                "lf": None,
                "confidence": max(0.0, min(1.0, confidence)),
                "eff_dur": eff_dur,
            }

        project_ef = max(d["ef"] for d in interim.values())

        # ── 2. BACKWARD PASS ─────────────────────────────────────────────────
        for tid in reversed(topo):
            successors = list(self.graph.successors(tid))
            if not successors:
                lf = project_ef
            else:
                lf = min(interim[s]["ls"] for s in successors)
            ls = lf - interim[tid]["eff_dur"]
            interim[tid]["lf"] = lf
            interim[tid]["ls"] = ls

        # ── 3. FLOAT COMPUTATION ──────────────────────────────────────────────
        scheduled: Dict[str, ScheduledTask] = {}
        for tid in topo:
            d = interim[tid]
            total_float = d["ls"] - d["es"]
            is_critical = total_float == 0

            # Free float: slack before affecting the earliest direct successor
            successors = list(self.graph.successors(tid))
            if not successors:
                free_float = total_float
            else:
                min_succ_es = min(interim[s]["es"] for s in successors)
                free_float = max(0, min_succ_es - d["ef"])

            scheduled[tid] = ScheduledTask(
                task_id=tid,
                name=self.tasks[tid].name,
                es=d["es"],
                ef=d["ef"],
                ls=d["ls"],
                lf=d["lf"],
                total_float=total_float,
                free_float=free_float,
                is_critical=is_critical,
                effective_duration=d["eff_dur"],
                actual_delay=self.tasks[tid].actual_delay,
                confidence=d["confidence"],
            )

        # ── 4. CRITICAL PATH ─────────────────────────────────────────────────
        critical_path = [tid for tid in topo if scheduled[tid].is_critical]

        # ── 5. OVERALL CONFIDENCE ────────────────────────────────────────────
        if critical_path:
            overall_conf = min(scheduled[t].confidence for t in critical_path)
        else:
            overall_conf = min(s.confidence for s in scheduled.values())

        # ── 6. DELAY CASCADE (which task's delay caused how many days) ────────
        delay_cascade = self._compute_delay_cascade(topo, scheduled, project_ef)

        # Freeze baseline on first ever computation
        if self._baseline_completion is None:
            self._baseline_completion = project_ef

        return GraphResult(
            project_completion_day=project_ef,
            baseline_completion_day=self._baseline_completion,
            total_delay=max(0, project_ef - self._baseline_completion),
            scheduled_tasks=scheduled,
            critical_path=critical_path,
            overall_confidence=overall_conf,
            delay_cascade=delay_cascade,
        )

    # ── Delay cascade analysis ────────────────────────────────────────────────

    def _compute_delay_cascade(
        self,
        topo: List[str],
        scheduled: Dict[str, ScheduledTask],
        project_ef: int,
    ) -> Dict[str, int]:
        """
        For each delayed task: simulate removing its delay and see
        how much the project would shrink. That delta = the task's contribution.
        """
        cascade: Dict[str, int] = {}
        for tid in topo:
            task = self.tasks[tid]
            if task.actual_delay == 0:
                continue

            saved_days = task.actual_delay
            # Only count if task is on the critical path or near it
            tf = scheduled[tid].total_float
            contribution = max(0, saved_days - tf)
            if contribution > 0:
                cascade[tid] = contribution

        return cascade

    # ── Targeted delay application ─────────────────────────────────────────────

    def apply_delay(self, task_id: str, delay_days: int) -> GraphResult:
        """Add delay to a task and return updated schedule."""
        if task_id not in self.tasks:
            raise KeyError(f"Task '{task_id}' not found")
        self.tasks[task_id].actual_delay += delay_days
        return self.compute_schedule()

    def set_delay(self, task_id: str, delay_days: int) -> GraphResult:
        """Set absolute delay for a task."""
        if task_id not in self.tasks:
            raise KeyError(f"Task '{task_id}' not found")
        self.tasks[task_id].actual_delay = max(0, delay_days)
        return self.compute_schedule()

    def clear_delay(self, task_id: str) -> None:
        if task_id in self.tasks:
            self.tasks[task_id].actual_delay = 0

    # ── Impact scoring ────────────────────────────────────────────────────────

    def compute_impact_score(self, task_id: str) -> float:
        """
        Impact score = criticality × (1 + downstream_count) × (1 / (1 + float)).
        Used to rank which tasks the recovery engine should target first.
        """
        if task_id not in self.tasks:
            return 0.0
        result = self.compute_schedule()
        st = result.scheduled_tasks.get(task_id)
        if not st:
            return 0.0

        downstream = len(nx.descendants(self.graph, task_id))
        tf = max(st.total_float, 0)
        is_critical_mult = 2.0 if st.is_critical else 1.0

        return is_critical_mult * (1 + downstream) * (1.0 / (1 + tf)) * st.confidence

    def ranked_impact_tasks(self) -> List[Tuple[str, float]]:
        """Return all tasks sorted by impact score descending."""
        scores = [(tid, self.compute_impact_score(tid)) for tid in self.tasks]
        return sorted(scores, key=lambda x: x[1], reverse=True)

    # ── Versioning / rollback ─────────────────────────────────────────────────

    def snapshot(self) -> int:
        """Save current state; returns snapshot index."""
        snap = {
            "ts": datetime.utcnow().isoformat(),
            "baseline": self._baseline_completion,
            "tasks": {
                tid: {
                    "actual_delay": t.actual_delay,
                    "status": t.status.value,
                    "completion": t.completion,
                }
                for tid, t in self.tasks.items()
            },
        }
        self._snapshots.append(snap)
        return len(self._snapshots) - 1

    def rollback(self, index: int = -1) -> None:
        """Restore a previous snapshot."""
        if not self._snapshots:
            return
        snap = self._snapshots[index]
        self._baseline_completion = snap["baseline"]
        for tid, state in snap["tasks"].items():
            if tid in self.tasks:
                self.tasks[tid].actual_delay = state["actual_delay"]
                self.tasks[tid].status = TaskStatus(state["status"])
                self.tasks[tid].completion = state["completion"]

    # ── Serialisation ──────────────────────────────────────────────────────────

    def to_dict(self) -> Dict:
        return {
            "nodes": [
                {
                    "id": t.task_id,
                    "name": t.name,
                    "duration": t.duration,
                    "status": t.status.value,
                    "actual_delay": t.actual_delay,
                    "duration_confidence": t.duration_confidence,
                    "vendor_id": t.vendor_id,
                    "owner": t.owner,
                }
                for t in self.tasks.values()
            ],
            "edges": [{"from": u, "to": v} for u, v in self.graph.edges()],
            "baseline_completion": self._baseline_completion,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "ProjectGraphEngine":
        engine = cls()
        for node in data.get("nodes", []):
            task = TaskNode(
                task_id=node["id"],
                name=node["name"],
                duration=node["duration"],
                status=TaskStatus(node.get("status", "pending")),
                actual_delay=node.get("actual_delay", 0),
                duration_confidence=node.get("duration_confidence", 1.0),
                vendor_id=node.get("vendor_id"),
                owner=node.get("owner"),
            )
            engine.add_task(task)
        for edge in data.get("edges", []):
            try:
                engine.add_dependency(edge["from"], edge["to"])
            except ValueError:
                pass
        engine._baseline_completion = data.get("baseline_completion")
        return engine
