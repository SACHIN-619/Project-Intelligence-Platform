"""
app/services/intelligence/montecarlo.py
=========================================
Monte Carlo schedule risk simulation.

MY IMPROVEMENTS over the discussion design:
───────────────────────────────────────────
1. Beta / PERT distribution — better than uniform for task durations;
   naturally right-skewed (tasks more often run long than short).
2. Vendor-correlated sampling — tasks sharing a vendor have
   correlated uncertainties via a shared Gaussian noise term.
3. Sensitivity analysis — identifies which tasks drive project
   variance most (informs recovery prioritisation).
4. Opportunity cost metric — P(finish on time) is output so the
   dashboard can show "only 43% chance of on-time delivery."
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

import numpy as np
from scipy import stats


@dataclass
class MCConfig:
    n_simulations: int = 1000
    optimistic_factor: float = 0.80   # best-case = 80% of planned
    pessimistic_factor: float = 1.50  # worst-case = 150% of planned
    vendor_correlation: float = 0.30  # shared-vendor noise weight


@dataclass
class MCResult:
    # Percentile completion days
    p50: int
    p80: int
    p90: int
    p95: int
    mean: float
    std: float
    deterministic: int          # CPM result with no sampling
    on_time_probability: float  # P(sim ≤ deterministic)
    # {task_id: fraction of total variance explained by this task}
    sensitivity: Dict[str, float]
    # {day: count} — for histogram widget
    histogram: Dict[int, int]


class MonteCarloEngine:
    """
    Runs probabilistic schedule analysis on top of a ProjectGraphEngine.

    Quick start:
        engine = MonteCarloEngine(graph_engine)
        result = engine.run()
        print(f"P90 completion: day {result.p90}")
        print(f"On-time probability: {result.on_time_probability:.0%}")
    """

    def __init__(self, graph_engine, config: Optional[MCConfig] = None):
        from app.services.intelligence.graph_engine import ProjectGraphEngine  # local import avoids cycle
        self.graph: ProjectGraphEngine = graph_engine
        self.cfg = config or MCConfig()

    # ── Sampling helpers ──────────────────────────────────────────────────────

    def _pert_beta_samples(self, task_id: str) -> np.ndarray:
        """
        Generate N duration samples for one task using the PERT-Beta distribution.

        PERT parameters:
          optimistic  = planned * optimistic_factor
          most_likely = planned + actual_delay      (current state)
          pessimistic = planned * pessimistic_factor

        Alpha/beta for Beta dist are derived so the mode equals most_likely.
        """
        n = self.cfg.n_simulations
        task = self.graph.tasks[task_id]
        opt = task.duration * self.cfg.optimistic_factor
        ml  = task.duration + task.actual_delay
        pess = task.duration * self.cfg.pessimistic_factor

        # Degenerate case — no variance
        if pess - opt < 0.5:
            return np.full(n, ml, dtype=float)

        # PERT mean and std
        pert_mean = (opt + 4 * ml + pess) / 6.0
        pert_std  = (pess - opt) / 6.0

        # Normalise to [0, 1] for Beta distribution
        mean_n = (pert_mean - opt) / (pess - opt)
        std_n  = pert_std / (pess - opt)

        if not (0 < mean_n < 1) or std_n < 1e-4:
            return np.random.uniform(opt, pess, n)

        # Solve for α, β from mean/variance
        cv = std_n ** 2
        common = mean_n * (1 - mean_n) / cv - 1
        alpha = mean_n * common
        beta  = (1 - mean_n) * common

        if alpha <= 0 or beta <= 0:
            return np.random.uniform(opt, pess, n)

        raw = stats.beta.rvs(alpha, beta, size=n, random_state=None)
        return opt + raw * (pess - opt)

    # ── Main simulation ───────────────────────────────────────────────────────

    def run(self) -> MCResult:
        """Run the full Monte Carlo simulation and return result."""
        import networkx as nx

        n   = self.cfg.n_simulations
        g   = self.graph.graph
        tasks = self.graph.tasks

        if not tasks:
            raise ValueError("No tasks to simulate")

        topo: List[str] = list(nx.topological_sort(g))

        # ── Sample durations for every task ──────────────────────────────────
        samples: Dict[str, np.ndarray] = {
            tid: self._pert_beta_samples(tid) for tid in topo
        }

        # ── Apply vendor correlation ──────────────────────────────────────────
        # Group tasks by vendor_id; inject shared Gaussian noise
        vendor_groups: Dict[str, List[str]] = {}
        for tid, task in tasks.items():
            if task.vendor_id:
                vendor_groups.setdefault(task.vendor_id, []).append(tid)

        vendor_noise: Dict[str, np.ndarray] = {
            vid: np.random.standard_normal(n) for vid in vendor_groups
        }

        for vid, members in vendor_groups.items():
            noise = vendor_noise[vid]
            for tid in members:
                base = samples[tid]
                base_std = np.std(base)
                if base_std > 0.1:
                    corr_delta = noise * base_std * self.cfg.vendor_correlation
                    samples[tid] = np.clip(
                        base + corr_delta,
                        tasks[tid].duration * self.cfg.optimistic_factor,
                        tasks[tid].duration * self.cfg.pessimistic_factor,
                    )

        # ── Forward-pass N times ──────────────────────────────────────────────
        completion_days = np.zeros(n)

        for i in range(n):
            ef: Dict[str, float] = {}
            for tid in topo:
                dur = samples[tid][i]
                preds = list(g.predecessors(tid))
                es = max((ef[p] for p in preds), default=0.0)
                ef[tid] = es + dur
            completion_days[i] = max(ef.values())

        # ── Deterministic completion (CPM baseline) ───────────────────────────
        det_result = self.graph.compute_schedule()
        deterministic = det_result.project_completion_day

        # ── Percentiles ──────────────────────────────────────────────────────
        p50 = int(np.percentile(completion_days, 50))
        p80 = int(np.percentile(completion_days, 80))
        p90 = int(np.percentile(completion_days, 90))
        p95 = int(np.percentile(completion_days, 95))
        on_time_prob = float(np.mean(completion_days <= deterministic))

        # ── Histogram ────────────────────────────────────────────────────────
        int_days = np.round(completion_days).astype(int)
        unique, counts = np.unique(int_days, return_counts=True)
        histogram = {int(d): int(c) for d, c in zip(unique, counts)}

        # ── Sensitivity analysis ──────────────────────────────────────────────
        baseline_var = np.var(completion_days)
        sensitivity: Dict[str, float] = {}

        for tid in topo:
            fixed = samples.copy()
            fixed[tid] = np.full(n, np.mean(samples[tid]))

            fixed_completions = np.zeros(n)
            for i in range(n):
                ef = {}
                for t in topo:
                    d   = fixed[t][i]
                    preds = list(g.predecessors(t))
                    es  = max((ef[p] for p in preds), default=0.0)
                    ef[t] = es + d
                fixed_completions[i] = max(ef.values())

            variance_reduced = baseline_var - np.var(fixed_completions)
            sensitivity[tid] = float(max(0.0, variance_reduced / max(baseline_var, 1e-6)))

        return MCResult(
            p50=p50,
            p80=p80,
            p90=p90,
            p95=p95,
            mean=float(np.mean(completion_days)),
            std=float(np.std(completion_days)),
            deterministic=deterministic,
            on_time_probability=on_time_prob,
            sensitivity=sensitivity,
            histogram=histogram,
        )

    # ── What-if helper ────────────────────────────────────────────────────────

    def what_if(self, task_id: str, hypothetical_delay: int) -> MCResult:
        """
        Temporarily set a task's delay and re-run simulation.
        Useful for: "what if the cooling unit is delayed 15 days?"
        """
        orig = self.graph.tasks[task_id].actual_delay
        self.graph.tasks[task_id].actual_delay = hypothetical_delay
        result = self.run()
        self.graph.tasks[task_id].actual_delay = orig
        return result

    # ── Formatted output for API ──────────────────────────────────────────────

    def top_sensitivity_tasks(self, result: MCResult, top_n: int = 5) -> List[Dict]:
        """Return top-N tasks by variance contribution with names."""
        sorted_tasks = sorted(result.sensitivity.items(), key=lambda x: x[1], reverse=True)
        output = []
        for tid, score in sorted_tasks[:top_n]:
            name = self.graph.tasks[tid].name if tid in self.graph.tasks else tid
            output.append({
                "task_id": tid,
                "name": name,
                "variance_contribution": round(score * 100, 1),
            })
        return output
