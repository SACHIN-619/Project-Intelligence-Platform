"""
app/services/intelligence/knowledge_engine.py
===============================================
Lightweight Knowledge Graph Engine — Phase 20 from the 30-phase discussion.

"We are NOT building Neo4j. Instead, we model entities and relationships
 in PostgreSQL and build a graph service on top of those tables.
 Every agent (compliance, schedule, supply chain) consumes this graph."

What this implements:
  1. Entity extraction from task/vendor data (no OCR — that's parser's job)
  2. Relationship inference: task → vendor, task → depends_on task
  3. Impact traversal: "if X is delayed, what else is affected?"
  4. Entity registry: one stable ID per real-world object

Storage: Uses existing Task + Vendor + Risk tables as the graph nodes.
         Relationships inferred from DB foreign keys + depends_on arrays.
         No new migration needed for hackathon phase.

Post-hackathon: graduate to dedicated entities + entity_relationships tables.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


# ── Node types (aligned with 30-phase discussion entity types) ─────────────────

ENTITY_TASK     = "task"
ENTITY_VENDOR   = "vendor"
ENTITY_RISK     = "risk"
ENTITY_ACTION   = "action"
ENTITY_PROJECT  = "project"
ENTITY_DOCUMENT = "document"


# ── Relationship types ─────────────────────────────────────────────────────────

REL_DEPENDS_ON   = "DEPENDS_ON"
REL_SUPPLIED_BY  = "SUPPLIED_BY"
REL_CAUSES_RISK  = "CAUSES_RISK"
REL_MITIGATED_BY = "MITIGATED_BY"
REL_PART_OF      = "PART_OF"


@dataclass
class EntityNode:
    entity_id: str
    entity_type: str           # task | vendor | risk | action | project
    name: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EntityRelationship:
    source_id: str
    target_id: str
    relation: str              # one of REL_* constants above
    confidence: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)


class KnowledgeGraph:
    """
    In-memory knowledge graph built from DB data.

    Built per-request for a project — lightweight, no separate DB.
    Supports:
      - Impact traversal (BFS forward from a node)
      - Root cause traversal (DFS backward to find origin)
      - Entity lookup by type
      - Dependency chain
    """

    def __init__(self):
        self._nodes: Dict[str, EntityNode] = {}
        self._outgoing: Dict[str, List[EntityRelationship]] = {}
        self._incoming: Dict[str, List[EntityRelationship]] = {}

    def add_node(self, node: EntityNode) -> None:
        self._nodes[node.entity_id] = node
        self._outgoing.setdefault(node.entity_id, [])
        self._incoming.setdefault(node.entity_id, [])

    def add_relationship(self, rel: EntityRelationship) -> None:
        self._outgoing.setdefault(rel.source_id, []).append(rel)
        self._incoming.setdefault(rel.target_id, []).append(rel)

    def get_node(self, entity_id: str) -> Optional[EntityNode]:
        return self._nodes.get(entity_id)

    def get_by_type(self, entity_type: str) -> List[EntityNode]:
        return [n for n in self._nodes.values() if n.entity_type == entity_type]

    def impact_traversal(
        self,
        start_id: str,
        max_depth: int = 4,
    ) -> List[Tuple[EntityNode, int]]:
        """
        BFS forward: what is impacted if start_id is delayed?
        Returns list of (node, depth) sorted by depth.

        Example: task → depends_on → tasks → milestones
        """
        if start_id not in self._nodes:
            return []

        visited: Set[str] = {start_id}
        queue: List[Tuple[str, int]] = [(start_id, 0)]
        result: List[Tuple[EntityNode, int]] = []

        while queue:
            current_id, depth = queue.pop(0)
            if depth > 0:
                node = self._nodes.get(current_id)
                if node:
                    result.append((node, depth))

            if depth >= max_depth:
                continue

            for rel in self._outgoing.get(current_id, []):
                if rel.target_id not in visited:
                    visited.add(rel.target_id)
                    queue.append((rel.target_id, depth + 1))

        return result

    def root_cause_traversal(
        self,
        start_id: str,
        max_depth: int = 4,
    ) -> List[Tuple[EntityNode, int]]:
        """
        DFS backward: what caused this node's problem?
        Follows incoming edges to find root causes.
        """
        if start_id not in self._nodes:
            return []

        visited: Set[str] = {start_id}
        stack: List[Tuple[str, int]] = [(start_id, 0)]
        result: List[Tuple[EntityNode, int]] = []

        while stack:
            current_id, depth = stack.pop()
            if depth > 0:
                node = self._nodes.get(current_id)
                if node:
                    result.append((node, depth))

            if depth >= max_depth:
                continue

            for rel in self._incoming.get(current_id, []):
                if rel.source_id not in visited:
                    visited.add(rel.source_id)
                    stack.append((rel.source_id, depth + 1))

        return result

    def get_related(
        self,
        entity_id: str,
        relation: Optional[str] = None,
    ) -> List[EntityNode]:
        """Get all nodes directly connected to entity_id (outgoing)."""
        rels = self._outgoing.get(entity_id, [])
        if relation:
            rels = [r for r in rels if r.relation == relation]
        return [
            self._nodes[r.target_id]
            for r in rels
            if r.target_id in self._nodes
        ]

    def to_summary(self) -> Dict[str, Any]:
        """Return graph statistics for the admin panel."""
        rel_count = sum(len(v) for v in self._outgoing.values())
        return {
            "node_count": len(self._nodes),
            "relationship_count": rel_count,
            "entity_types": {
                et: len(self.get_by_type(et))
                for et in [ENTITY_TASK, ENTITY_VENDOR, ENTITY_RISK, ENTITY_ACTION]
            },
        }


class KnowledgeGraphBuilder:
    """
    Builds a KnowledgeGraph from database rows.
    No new DB migration needed — uses existing Task, Vendor, Risk tables.
    """

    @staticmethod
    def build(
        tasks: List[Any],
        vendors: List[Any],
        risks: List[Any],
        project_id: str,
    ) -> KnowledgeGraph:
        """
        Build graph from ORM objects.

        tasks:   list of Task ORM rows
        vendors: list of Vendor ORM rows
        risks:   list of Risk ORM rows
        """
        graph = KnowledgeGraph()

        # ── Add project node ──────────────────────────────────────────────────
        graph.add_node(EntityNode(
            entity_id=f"project:{project_id}",
            entity_type=ENTITY_PROJECT,
            name=f"Project {project_id}",
        ))

        # ── Add task nodes ────────────────────────────────────────────────────
        name_to_id: Dict[str, str] = {}
        for t in tasks:
            tid = str(t.id)
            name_to_id[t.name] = tid
            graph.add_node(EntityNode(
                entity_id=tid,
                entity_type=ENTITY_TASK,
                name=t.name,
                metadata={
                    "duration":    t.planned_duration,
                    "status":      t.status,
                    "delay":       t.actual_delay or 0,
                    "completion":  t.completion or 0,
                    "total_float": t.total_float,
                },
            ))
            # Task belongs to project
            graph.add_relationship(EntityRelationship(
                source_id=tid,
                target_id=f"project:{project_id}",
                relation=REL_PART_OF,
            ))

        # ── Task dependencies ─────────────────────────────────────────────────
        for t in tasks:
            tid = str(t.id)
            for dep_name in (t.depends_on or []):
                dep_id = name_to_id.get(dep_name)
                if dep_id:
                    graph.add_relationship(EntityRelationship(
                        source_id=dep_id,
                        target_id=tid,
                        relation=REL_DEPENDS_ON,
                    ))

        # ── Add vendor nodes ──────────────────────────────────────────────────
        for v in vendors:
            vid = str(v.id)
            graph.add_node(EntityNode(
                entity_id=vid,
                entity_type=ENTITY_VENDOR,
                name=v.name or "Unknown Vendor",
                metadata={
                    "reliability_score": v.reliability_score,
                    "delivery_status":   v.delivery_status,
                    "lead_time_days":    v.lead_time_days,
                },
            ))

        # ── Task → Vendor relationships via task.owner field ──────────────────
        vendor_name_to_id = {v.name: str(v.id) for v in vendors}
        for t in tasks:
            if t.owner and t.owner in vendor_name_to_id:
                graph.add_relationship(EntityRelationship(
                    source_id=str(t.id),
                    target_id=vendor_name_to_id[t.owner],
                    relation=REL_SUPPLIED_BY,
                    confidence=0.9,
                ))

        # ── Add risk nodes ────────────────────────────────────────────────────
        for r in risks:
            rid = str(r.id)
            graph.add_node(EntityNode(
                entity_id=rid,
                entity_type=ENTITY_RISK,
                name=r.explanation[:80] if r.explanation else "Risk",
                metadata={
                    "severity":    r.severity,
                    "probability": r.probability,
                    "risk_score":  r.risk_score,
                    "impact_days": r.impact_days,
                },
            ))
            # Risk caused by task
            if r.task_id:
                graph.add_relationship(EntityRelationship(
                    source_id=str(r.task_id),
                    target_id=rid,
                    relation=REL_CAUSES_RISK,
                ))

        return graph


async def build_project_graph(db, project_id: str, org_id: str) -> KnowledgeGraph:
    """
    Convenience function: load all DB data for a project and build graph.
    Returns a ready-to-query KnowledgeGraph.
    """
    from sqlalchemy import select
    from app.models.db import Task, Vendor, Risk

    tasks = (await db.execute(
        select(Task).where(Task.project_id == project_id, Task.org_id == org_id)
    )).scalars().all()

    vendors = (await db.execute(
        select(Vendor).where(Vendor.project_id == project_id)
    )).scalars().all()

    risks = (await db.execute(
        select(Risk).where(Risk.project_id == project_id)
    )).scalars().all()

    return KnowledgeGraphBuilder.build(tasks, vendors, risks, project_id)


def explain_impact(graph: KnowledgeGraph, entity_id: str) -> Dict[str, Any]:
    """
    Given a delayed/risky entity, explain what it impacts.
    Returns structured explanation for the Explainability Engine.
    """
    impacted = graph.impact_traversal(entity_id, max_depth=4)
    root_causes = graph.root_cause_traversal(entity_id, max_depth=3)

    node = graph.get_node(entity_id)
    node_name = node.name if node else entity_id

    impacted_tasks = [
        n.name for n, _ in impacted if n.entity_type == ENTITY_TASK
    ]
    impacted_risks = [
        n.name for n, _ in impacted if n.entity_type == ENTITY_RISK
    ]
    root_vendors = [
        n.name for n, _ in root_causes if n.entity_type == ENTITY_VENDOR
    ]
    root_tasks = [
        n.name for n, _ in root_causes if n.entity_type == ENTITY_TASK
    ]

    return {
        "entity": node_name,
        "impacted_tasks": impacted_tasks[:5],
        "impacted_risks": impacted_risks[:3],
        "root_cause_vendors": root_vendors[:3],
        "root_cause_tasks": root_tasks[:3],
        "total_impacted": len(impacted),
        "reasoning_path": [
            f"{n.name} ({n.entity_type})" for n, _ in impacted[:5]
        ],
    }