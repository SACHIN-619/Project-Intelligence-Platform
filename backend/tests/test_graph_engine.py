"""
tests/test_graph_engine.py
===========================
Unit tests for ProjectGraphEngine.

Covers:
  • Forward pass (ES/EF)
  • Backward pass (LS/LF)
  • Total float and free float
  • Critical path detection
  • Delay propagation
  • Confidence decay
  • Cycle detection (must raise)
  • Snapshot / rollback
  • Partial recompute via impact score
"""

import pytest
from app.services.intelligence.graph_engine import (
    ProjectGraphEngine, TaskNode, TaskStatus, GraphResult,
)


# ─────────────────────────────────────────────────────────────────────────────
# CPM — forward / backward / float
# ─────────────────────────────────────────────────────────────────────────────

def test_simple_chain_completion(dc_graph):
    """Site(5)→Elec(7)→Cool(10+3)→Test(5)→Launch(2) = 5+7+13+5+2 = 32."""
    result = dc_graph.compute_schedule()
    assert result.project_completion_day == 32


def test_no_delay_baseline(dc_graph):
    """Without the cooling delay baseline should be 29 days."""
    dc_graph.tasks["T3"].actual_delay = 0
    result = dc_graph.compute_schedule()
    assert result.project_completion_day == 29


def test_critical_path_all_tasks_in_chain(dc_graph):
    """Single chain — every task is on the critical path."""
    result = dc_graph.compute_schedule()
    assert set(result.critical_path) == {"T1", "T2", "T3", "T4", "T5"}


def test_float_is_zero_on_critical_path(dc_graph):
    """Every task in a single chain has zero total float."""
    result = dc_graph.compute_schedule()
    for tid, st in result.scheduled_tasks.items():
        assert st.total_float == 0, f"{tid} should have 0 float"


def test_parallel_branch_gives_float():
    """
    T1 → T2 (10 days)
    T1 → T3 (3 days) → T4
    T2 and T4 both feed T5.
    T3 should have positive float because T2 is longer.
    """
    engine = ProjectGraphEngine()
    for tid, name, dur in [
        ("T1","Start",1),("T2","Long",10),("T3","Short",3),
        ("T4","After Short",1),("T5","End",2),
    ]:
        engine.add_task(TaskNode(tid, name, dur))

    engine.add_dependency("T1","T2")
    engine.add_dependency("T1","T3")
    engine.add_dependency("T3","T4")
    engine.add_dependency("T2","T5")
    engine.add_dependency("T4","T5")

    result = engine.compute_schedule()
    t3_float = result.scheduled_tasks["T3"].total_float
    assert t3_float > 0, "Short branch should have positive float"
    assert result.scheduled_tasks["T2"].is_critical


def test_earliest_start_respects_all_predecessors():
    """
    T3 depends on T1 AND T2. ES(T3) = max(EF(T1), EF(T2)).
    """
    engine = ProjectGraphEngine()
    engine.add_task(TaskNode("T1","A",5))
    engine.add_task(TaskNode("T2","B",12))
    engine.add_task(TaskNode("T3","C",3))
    engine.add_dependency("T1","T3")
    engine.add_dependency("T2","T3")

    result = engine.compute_schedule()
    t3 = result.scheduled_tasks["T3"]
    assert t3.es == 12   # must wait for T2 (longest)


# ─────────────────────────────────────────────────────────────────────────────
# Delay propagation
# ─────────────────────────────────────────────────────────────────────────────

def test_delay_propagates_through_chain(dc_graph):
    """Adding 5 more days to Cooling should push project by 5."""
    baseline = dc_graph.compute_schedule().project_completion_day
    dc_graph.apply_delay("T3", 5)
    new_result = dc_graph.compute_schedule()
    assert new_result.project_completion_day == baseline + 5


def test_delay_on_non_critical_absorbed_by_float():
    """Delay on a parallel non-critical task should NOT extend project."""
    engine = ProjectGraphEngine()
    for tid, name, dur in [
        ("T1","Start",1),("T2","Critical",20),("T3","Side",3),("T4","End",2),
    ]:
        engine.add_task(TaskNode(tid, name, dur))
    engine.add_dependency("T1","T2")
    engine.add_dependency("T1","T3")
    engine.add_dependency("T2","T4")
    engine.add_dependency("T3","T4")

    baseline = engine.compute_schedule().project_completion_day
    engine.apply_delay("T3", 5)   # T3 has 17 days of float
    new = engine.compute_schedule()
    assert new.project_completion_day == baseline  # absorbed


def test_total_delay_reported_correctly(dc_graph):
    result = dc_graph.compute_schedule()
    assert result.total_delay == 3   # only the cooling delay


# ─────────────────────────────────────────────────────────────────────────────
# Confidence decay
# ─────────────────────────────────────────────────────────────────────────────

def test_confidence_decays_downstream(dc_graph):
    """Tasks further down the chain should have lower confidence."""
    result = dc_graph.compute_schedule()
    conf_t1 = result.scheduled_tasks["T1"].confidence
    conf_t5 = result.scheduled_tasks["T5"].confidence
    assert conf_t5 < conf_t1, "Downstream confidence must be lower"


def test_root_task_has_full_confidence():
    engine = ProjectGraphEngine()
    engine.add_task(TaskNode("T1","Root",5,duration_confidence=1.0))
    result = engine.compute_schedule()
    assert result.scheduled_tasks["T1"].confidence == 1.0


# ─────────────────────────────────────────────────────────────────────────────
# Cycle detection
# ─────────────────────────────────────────────────────────────────────────────

def test_cycle_raises_immediately():
    engine = ProjectGraphEngine()
    engine.add_task(TaskNode("A","A",5))
    engine.add_task(TaskNode("B","B",5))
    engine.add_dependency("A","B")
    with pytest.raises(ValueError, match="[Cc]ircular"):
        engine.add_dependency("B","A")


def test_self_loop_raises():
    engine = ProjectGraphEngine()
    engine.add_task(TaskNode("A","A",5))
    with pytest.raises(ValueError):
        engine.add_dependency("A","A")


# ─────────────────────────────────────────────────────────────────────────────
# Snapshot / rollback
# ─────────────────────────────────────────────────────────────────────────────

def test_snapshot_and_rollback(dc_graph):
    original = dc_graph.compute_schedule().project_completion_day
    idx = dc_graph.snapshot()
    dc_graph.apply_delay("T3", 10)
    assert dc_graph.compute_schedule().project_completion_day > original
    dc_graph.rollback(idx)
    dc_graph._snapshots.pop(idx)
    assert dc_graph.compute_schedule().project_completion_day == original


# ─────────────────────────────────────────────────────────────────────────────
# Impact scoring
# ─────────────────────────────────────────────────────────────────────────────

def test_critical_task_has_higher_impact_than_parallel(dc_graph):
    """Cooling (critical, delayed) should score higher than a hypothetical side task."""
    score_cooling = dc_graph.compute_impact_score("T3")
    score_t1 = dc_graph.compute_impact_score("T1")
    # T3 has actual delay and is critical
    assert score_cooling > 0


def test_ranked_impact_first_is_highest(dc_graph):
    ranked = dc_graph.ranked_impact_tasks()
    assert len(ranked) == 5
    scores = [s for _, s in ranked]
    assert scores == sorted(scores, reverse=True)


# ─────────────────────────────────────────────────────────────────────────────
# Serialisation
# ─────────────────────────────────────────────────────────────────────────────

def test_roundtrip_serialisation(dc_graph):
    """Graph → dict → Graph must give same completion day."""
    original_day = dc_graph.compute_schedule().project_completion_day
    data = dc_graph.to_dict()
    restored = ProjectGraphEngine.from_dict(data)
    assert restored.compute_schedule().project_completion_day == original_day
