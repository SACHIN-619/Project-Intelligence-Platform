"""
tests/conftest.py
==================
Shared pytest fixtures.

Provides:
  • In-memory graph engine pre-loaded with the DC project scenario
  • Sample parsed tasks + vendors
  • FastAPI async test client
"""

import pytest
import pytest_asyncio

from app.services.intelligence.graph_engine import (
    ProjectGraphEngine, TaskNode, TaskStatus,
)
from app.services.intelligence.risk_engine import VendorRiskInput
from app.services.parser.schema_mapper import SchemaMapper


# ── Fixture: standard DC project graph ───────────────────────────────────────

@pytest.fixture
def dc_graph() -> ProjectGraphEngine:
    """
    5-task data centre project with one delayed task.
    Mirrors the demo scenario from synthetic/generate_data.py (simplified).

    Site Prep → Electrical → Cooling(DELAYED +3) → Testing → Launch
    """
    engine = ProjectGraphEngine()

    tasks = [
        TaskNode("T1", "Site Preparation",  duration=5,  status=TaskStatus.COMPLETED, completion=100),
        TaskNode("T2", "Electrical Setup",  duration=7,  status=TaskStatus.COMPLETED, completion=100),
        TaskNode("T3", "Cooling Install",   duration=10, status=TaskStatus.DELAYED,   actual_delay=3),
        TaskNode("T4", "Testing",           duration=5,  status=TaskStatus.PENDING),
        TaskNode("T5", "Launch",            duration=2,  status=TaskStatus.PENDING),
    ]
    for t in tasks:
        engine.add_task(t)

    engine.add_dependency("T1", "T2")
    engine.add_dependency("T2", "T3")
    engine.add_dependency("T3", "T4")
    engine.add_dependency("T4", "T5")

    return engine


@pytest.fixture
def large_graph() -> ProjectGraphEngine:
    """
    25-task graph matching the full synthetic project.
    Used for performance / Monte Carlo tests.
    """
    engine = ProjectGraphEngine()

    tasks_def = [
        ("T01", "Site Preparation",          5,  0,  TaskStatus.COMPLETED),
        ("T02", "Civil Foundation",          12,  0,  TaskStatus.COMPLETED),
        ("T03", "Structural Steel",          10,  0,  TaskStatus.COMPLETED),
        ("T04", "Roofing",                    8,  0,  TaskStatus.COMPLETED),
        ("T05", "HV Switchgear",             14,  5,  TaskStatus.DELAYED),
        ("T06", "MV Distribution",           10,  0,  TaskStatus.PENDING),
        ("T07", "UPS System",                12,  0,  TaskStatus.PENDING),
        ("T08", "Generator Sets",            10,  8,  TaskStatus.DELAYED),
        ("T09", "Fuel Storage",               6,  0,  TaskStatus.PENDING),
        ("T10", "Cooling Tower",             15,  6,  TaskStatus.DELAYED),
        ("T11", "CRAC Units",                10,  0,  TaskStatus.PENDING),
        ("T12", "Chiller Commissioning",      7,  0,  TaskStatus.PENDING),
        ("T13", "IT Room Sub-floor",          5,  0,  TaskStatus.COMPLETED),
        ("T14", "Cable Tray",                 8,  0,  TaskStatus.RUNNING),
        ("T15", "Electrical Cabling",        12,  0,  TaskStatus.PENDING),
        ("T16", "BMS Cabling",                7,  0,  TaskStatus.PENDING),
        ("T17", "Fire Suppression",           9,  0,  TaskStatus.RUNNING),
        ("T18", "Security System",            5,  0,  TaskStatus.PENDING),
        ("T19", "Network Infrastructure",     8,  0,  TaskStatus.PENDING),
        ("T20", "Server Racks",              10,  0,  TaskStatus.PENDING),
        ("T21", "Integrated Testing",        14,  0,  TaskStatus.PENDING),
        ("T22", "Power-On Test",              5,  0,  TaskStatus.PENDING),
        ("T23", "Load Bank Testing",          7,  0,  TaskStatus.PENDING),
        ("T24", "Tier III Audit",            10,  0,  TaskStatus.PENDING),
        ("T25", "Handover",                   3,  0,  TaskStatus.PENDING),
    ]
    for tid, name, dur, delay, status in tasks_def:
        engine.add_task(TaskNode(tid, name, dur, status, actual_delay=delay))

    edges = [
        ("T01","T02"),("T02","T03"),("T03","T04"),("T03","T05"),
        ("T05","T06"),("T06","T07"),("T02","T08"),("T08","T09"),
        ("T02","T10"),("T10","T11"),("T11","T12"),("T04","T13"),
        ("T13","T14"),("T14","T15"),("T06","T15"),("T15","T16"),
        ("T13","T17"),("T16","T18"),("T15","T19"),("T19","T20"),
        ("T07","T21"),("T12","T21"),("T20","T21"),
        ("T21","T22"),("T22","T23"),("T23","T24"),
        ("T17","T24"),("T18","T24"),("T24","T25"),
    ]
    for src, dst in edges:
        engine.add_dependency(src, dst)

    return engine


@pytest.fixture
def sample_vendors():
    return [
        VendorRiskInput("V1", "ABB India",   0.72, "delayed",   45, 52),
        VendorRiskInput("V2", "Cummins",     0.68, "at_risk",   60, 68),
        VendorRiskInput("V3", "Emerson",     0.95, "on_track",  35, 28),
    ]


@pytest.fixture
def mapper():
    return SchemaMapper()
