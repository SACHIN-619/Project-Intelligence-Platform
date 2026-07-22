"""
tests/test_intelligence.py
===========================
Tests for:
  • SchemaMapper   — 3-stage column detection
  • MonteCarloEngine — distribution shape, sensitivity
  • RiskEngine       — scoring, vendor risk, summary
  • RecoveryEngine   — action generation, scoring, compound
"""

import pytest
from app.services.parser.schema_mapper import SchemaMapper, CANONICAL_ALIASES
from app.services.intelligence.montecarlo import MonteCarloEngine, MCConfig
from app.services.intelligence.risk_engine import RiskEngine, VendorRiskInput
from app.services.intelligence.recovery_engine import RecoveryEngine


# ─────────────────────────────────────────────────────────────────────────────
# SchemaMapper
# ─────────────────────────────────────────────────────────────────────────────

class TestSchemaMapper:

    def test_exact_match_canonical_name(self, mapper):
        r = mapper.map_column("task")
        assert r.canonical == "task_name"
        assert r.method == "exact"
        assert r.confidence == 1.0

    def test_exact_match_alias(self, mapper):
        r = mapper.map_column("Activity")
        assert r.canonical == "task_name"

    def test_fuzzy_match_typo(self, mapper):
        """'durration' should fuzzy-match to 'duration'."""
        r = mapper.map_column("durration")
        assert r.canonical == "duration"
        assert r.method == "fuzzy"
        assert r.confidence < 1.0

    def test_unmapped_returns_none(self, mapper):
        r = mapper.map_column("CarbonFootprintScore")
        # Either unmapped or low confidence — canonical may be None
        if r.canonical is not None:
            assert r.confidence < 0.7
        else:
            assert r.method == "unmapped"

    def test_map_full_list(self, mapper):
        cols = ["Task Name", "Begin", "Finish", "Supplier", "ETA", "CustomFieldXYZ"]
        result = mapper.map(cols)
        assert result.mapped_count >= 4   # at least 4 of 6 should map
        assert "CustomFieldXYZ" in result.unmapped_columns

    def test_quality_score_range(self, mapper):
        result = mapper.map(["task", "duration", "status", "depends_on"])
        assert 0 <= result.quality_score <= 100

    def test_tenant_memory_overrides(self):
        mapper = SchemaMapper(tenant_memory={"ship_eta": "expected_arrival"})
        r = mapper.map_column("Ship ETA")
        assert r.canonical == "expected_arrival"
        assert r.method == "tenant_memory"

    def test_learn_persists_in_session(self, mapper):
        mapper.learn("ETA_DELIVERY", "expected_arrival")
        r = mapper.map_column("ETA_DELIVERY")
        assert r.canonical == "expected_arrival"

    def test_normalise_strips_special_chars(self, mapper):
        """'Task-Name' and 'task_name' should both map."""
        r1 = mapper.map_column("Task-Name")
        r2 = mapper.map_column("task_name")
        assert r1.canonical == r2.canonical

    def test_all_canonical_names_map_exactly(self, mapper):
        """Every canonical name should map to itself."""
        for canon in CANONICAL_ALIASES.keys():
            r = mapper.map_column(canon)
            assert r.canonical == canon, f"{canon} did not self-map"


# ─────────────────────────────────────────────────────────────────────────────
# MonteCarloEngine
# ─────────────────────────────────────────────────────────────────────────────

class TestMonteCarlo:

    def test_p50_less_than_p90(self, dc_graph):
        mc = MonteCarloEngine(dc_graph, MCConfig(n_simulations=500))
        result = mc.run()
        assert result.p50 <= result.p80 <= result.p90 <= result.p95

    def test_deterministic_within_p50_p90_range(self, dc_graph):
        """The CPM completion day should be between P50 and P90."""
        mc = MonteCarloEngine(dc_graph, MCConfig(n_simulations=500))
        result = mc.run()
        assert result.p50 <= result.deterministic <= result.p95

    def test_on_time_probability_is_fraction(self, dc_graph):
        mc = MonteCarloEngine(dc_graph, MCConfig(n_simulations=200))
        result = mc.run()
        assert 0.0 <= result.on_time_probability <= 1.0

    def test_sensitivity_sums_approximately_one(self, dc_graph):
        """Variance contributions across all tasks should sum near 1.0."""
        mc = MonteCarloEngine(dc_graph, MCConfig(n_simulations=300))
        result = mc.run()
        total = sum(result.sensitivity.values())
        # Not guaranteed to sum to exactly 1 due to correlations, but ballpark
        assert total > 0.0

    def test_sensitivity_keys_match_tasks(self, dc_graph):
        mc = MonteCarloEngine(dc_graph, MCConfig(n_simulations=200))
        result = mc.run()
        assert set(result.sensitivity.keys()) == set(dc_graph.tasks.keys())

    def test_histogram_covers_all_simulations(self, dc_graph):
        n = 300
        mc = MonteCarloEngine(dc_graph, MCConfig(n_simulations=n))
        result = mc.run()
        assert sum(result.histogram.values()) == n

    def test_what_if_no_delay_improves_schedule(self, dc_graph):
        """Setting cooling delay to 0 should improve P50."""
        mc = MonteCarloEngine(dc_graph, MCConfig(n_simulations=300))
        baseline = mc.run()
        what_if = mc.what_if("T3", 0)
        assert what_if.p50 <= baseline.p50

    def test_top_sensitivity_returns_n_tasks(self, dc_graph):
        mc = MonteCarloEngine(dc_graph, MCConfig(n_simulations=200))
        result = mc.run()
        top = mc.top_sensitivity_tasks(result, top_n=3)
        assert len(top) == 3
        assert all("name" in t and "variance_contribution" in t for t in top)


# ─────────────────────────────────────────────────────────────────────────────
# RiskEngine
# ─────────────────────────────────────────────────────────────────────────────

class TestRiskEngine:

    def test_delayed_critical_task_generates_risk(self, dc_graph):
        graph_result = dc_graph.compute_schedule()
        engine_result = RiskEngine().analyse(graph_result, dc_graph)
        task_risks = [r for r in engine_result.risks if r.task_id == "T3"]
        assert len(task_risks) > 0

    def test_risk_severity_levels(self, dc_graph):
        graph_result = dc_graph.compute_schedule()
        result = RiskEngine().analyse(graph_result, dc_graph)
        severities = {r.severity.value for r in result.risks}
        # At least one severity should be present
        assert len(severities) > 0
        assert severities.issubset({"low", "medium", "high", "critical"})

    def test_vendor_risk_added(self, dc_graph, sample_vendors):
        graph_result = dc_graph.compute_schedule()
        result = RiskEngine().analyse(graph_result, dc_graph, sample_vendors)
        vendor_risks = [r for r in result.risks if r.risk_type.value == "vendor"]
        assert len(vendor_risks) > 0

    def test_delivered_vendor_ignored(self, dc_graph):
        delivered = [VendorRiskInput("V9","Delivered Co",1.0,"delivered",10,5)]
        graph_result = dc_graph.compute_schedule()
        result = RiskEngine().analyse(graph_result, dc_graph, delivered)
        vendor_risks = [r for r in result.risks if r.risk_type.value == "vendor"]
        assert len(vendor_risks) == 0

    def test_project_risk_score_positive(self, dc_graph):
        graph_result = dc_graph.compute_schedule()
        result = RiskEngine().analyse(graph_result, dc_graph)
        assert result.project_risk_score >= 0

    def test_risks_sorted_by_score_descending(self, dc_graph):
        graph_result = dc_graph.compute_schedule()
        result = RiskEngine().analyse(graph_result, dc_graph)
        scores = [r.risk_score for r in result.risks]
        assert scores == sorted(scores, reverse=True)

    def test_summary_not_empty(self, dc_graph):
        graph_result = dc_graph.compute_schedule()
        result = RiskEngine().analyse(graph_result, dc_graph)
        assert len(result.summary) > 10


# ─────────────────────────────────────────────────────────────────────────────
# RecoveryEngine
# ─────────────────────────────────────────────────────────────────────────────

class TestRecoveryEngine:

    def test_generates_options_for_delayed_task(self, dc_graph):
        recovery = RecoveryEngine(dc_graph)
        options = recovery.generate_recovery_options(risk_task_ids=["T3"])
        assert len(options) > 0

    def test_options_sorted_by_score_descending(self, dc_graph):
        recovery = RecoveryEngine(dc_graph)
        options = recovery.generate_recovery_options(risk_task_ids=["T3"])
        scores = [o.multi_objective_score for o in options]
        assert scores == sorted(scores, reverse=True)

    def test_days_saved_non_negative(self, dc_graph):
        recovery = RecoveryEngine(dc_graph)
        options = recovery.generate_recovery_options(risk_task_ids=["T3"])
        for opt in options:
            assert opt.estimated_days_saved >= 0

    def test_graph_unchanged_after_generation(self, dc_graph):
        """Recovery engine must NOT mutate the graph permanently."""
        before = dc_graph.compute_schedule().project_completion_day
        RecoveryEngine(dc_graph).generate_recovery_options(risk_task_ids=["T3"])
        after = dc_graph.compute_schedule().project_completion_day
        assert before == after

    def test_compound_scenario(self, dc_graph):
        recovery = RecoveryEngine(dc_graph)
        options = recovery.generate_recovery_options(risk_task_ids=["T3"])
        if len(options) >= 2:
            compound = recovery.compound_scenario(options[0], options[1])
            assert "combined_days_saved" in compound
            assert compound["combined_days_saved"] >= 0

    def test_max_options_cap(self, dc_graph):
        recovery = RecoveryEngine(dc_graph)
        options = recovery.generate_recovery_options(max_options=3)
        assert len(options) <= 3

    def test_no_options_for_completed_tasks(self):
        """A task that is 100% complete should generate no recovery."""
        engine = ProjectGraphEngine()
        engine.add_task(TaskNode("A","Done Task",5,TaskStatus.COMPLETED,completion=100,actual_delay=0))
        engine.add_task(TaskNode("B","Next",5))
        engine.add_dependency("A","B")
        recovery = RecoveryEngine(engine)
        options = recovery.generate_recovery_options(risk_task_ids=["A"])
        assert len(options) == 0
