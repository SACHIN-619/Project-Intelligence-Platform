"""
app/models/schemas.py
======================
Pydantic v2 request/response schemas.
UPDATED: added health_score, vendor_risk_summary, ai_memory_events,
         knowledge graph summary, weather risk fields.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────────────────────────
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginRequest(BaseModel):
    email: str
    password: str


# ─────────────────────────────────────────────────────────────────────────────
# PROJECT
# ─────────────────────────────────────────────────────────────────────────────
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_completion_day: Optional[int] = None


class ProjectSummary(OrmBase):
    id: str
    name: str
    status: str
    current_progress: int
    baseline_completion_day: Optional[int]
    predicted_completion_day: Optional[int]
    confidence_score: float
    health_score: Optional[float] = None        # NEW — Phase 9 health engine
    created_at: datetime


class ProjectDetail(ProjectSummary):
    description: Optional[str]
    extra_fields: Dict[str, Any]
    updated_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# TASK
# ─────────────────────────────────────────────────────────────────────────────
class TaskRead(OrmBase):
    id: str
    name: str
    planned_start_day: Optional[int]
    planned_duration: int
    actual_delay: int
    completion: int
    depends_on: List[str]
    status: str
    owner: Optional[str]
    criticality_score: float
    total_float: Optional[int]
    free_float: Optional[int]
    duration_confidence: float


# ─────────────────────────────────────────────────────────────────────────────
# UPLOAD
# ─────────────────────────────────────────────────────────────────────────────
class UploadResponse(OrmBase):
    id: str
    filename: str
    file_type: str
    status: str
    parse_quality_score: Optional[float]
    schema_mapping: Dict[str, str]
    unmapped_columns: List[str]
    row_count: Optional[int]
    error_message: Optional[str]
    created_at: datetime


class UploadPreview(BaseModel):
    filename: str
    detected_type: str
    row_count: int
    columns_detected: List[str]
    schema_mapping: Dict[str, str]
    unmapped_columns: List[str]
    quality_score: float
    warnings: List[str]
    sample_rows: List[Dict[str, Any]]


# ─────────────────────────────────────────────────────────────────────────────
# ANALYSIS — core
# ─────────────────────────────────────────────────────────────────────────────
class TaskGraphNode(BaseModel):
    task_id: str
    name: str
    es: int
    ef: int
    total_float: int
    free_float: int
    is_critical: bool
    actual_delay: int
    confidence: float


class RiskSummary(BaseModel):
    id: str
    task_name: Optional[str]
    risk_type: str
    severity: str
    probability: float
    impact_days: int
    risk_score: float
    explanation: str
    confidence: float


class AnalysisResult(BaseModel):
    project_id: str
    completion_day: int
    original_completion_day: int
    total_delay_days: int
    risk_level: str
    overall_confidence: float
    critical_path: List[str]
    tasks: List[TaskGraphNode]
    risks: List[RiskSummary]
    delay_breakdown: Dict[str, int]

    # Monte Carlo
    mc_p50: Optional[int] = None
    mc_p80: Optional[int] = None
    mc_p90: Optional[int] = None
    mc_on_time_probability: Optional[float] = None
    top_sensitivity_tasks: Optional[List[Dict]] = None

    # NEW — Phase 9: Project Health Engine
    health_score: Optional[float] = None
    health_level: Optional[str] = None          # healthy|watch|at_risk|critical
    health_summary: Optional[str] = None

    # NEW — Phase 20: Knowledge Graph summary
    knowledge_graph_summary: Optional[Dict[str, Any]] = None


# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO / SIMULATION
# ─────────────────────────────────────────────────────────────────────────────
class SimulationRequest(BaseModel):
    project_id: str
    action_type: str = Field(
        ...,
        description="backup_vendor | parallel_execution | reschedule | add_crew | accelerate",
    )
    action_params: Dict[str, Any] = Field(default_factory=dict)
    name: Optional[str] = None


class ScenarioResult(BaseModel):
    scenario_id: str
    name: str
    action_type: str
    old_delay_days: int
    new_delay_days: int
    days_saved: int
    days_saved_pct: float
    feasibility_score: float
    confidence: float
    cost_impact: float
    mc_p50: Optional[int]
    mc_p80: Optional[int]
    mc_p90: Optional[int]
    on_time_probability: Optional[float]
    explanation: str
    evidence: List[Dict[str, str]]

    # NEW — Phase 22: Decision Intelligence
    memory_similar_cases: Optional[List[Dict]] = None   # past similar decisions
    knowledge_impact: Optional[Dict] = None              # graph traversal impact


class RecoveryOption(BaseModel):
    action_type: str
    title: str
    description: str
    estimated_days_saved: int
    estimated_cost: str
    confidence: float
    feasibility: float
    opportunity_window: str

    # NEW — memory context
    memory_context: Optional[str] = None   # "Used in 3 past projects successfully"


# ─────────────────────────────────────────────────────────────────────────────
# RAG / QUERY
# ─────────────────────────────────────────────────────────────────────────────
class QueryRequest(BaseModel):
    project_id: str
    question: str
    context_hint: Optional[str] = None


class QueryResponse(BaseModel):
    answer: str
    confidence: float
    evidence: List[Dict[str, Any]]
    assumptions: List[str]
    missing_data: List[str]
    suggested_questions: List[str]

    # NEW — memory + knowledge graph context used
    memory_context_used: Optional[int] = None   # count of past decisions used
    knowledge_entities_found: Optional[int] = None


# ─────────────────────────────────────────────────────────────────────────────
# REPORT
# ─────────────────────────────────────────────────────────────────────────────
class ReportRequest(BaseModel):
    project_id: str
    include_monte_carlo: bool = True
    include_evidence: bool = True
    scenario_ids: List[str] = Field(default_factory=list)


class ReportResponse(BaseModel):
    report_id: str
    download_url: str
    generated_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH / METRICS
# ─────────────────────────────────────────────────────────────────────────────
class ProjectHealthDashboard(BaseModel):
    project_id: str
    name: str
    completion_pct: int
    predicted_delay_days: int
    risk_level: str
    confidence: float
    active_risks: int
    active_scenarios: int
    hours_saved_estimate: float
    last_analysed: Optional[datetime]
    critical_path_summary: List[str]

    # NEW — Phase 9 health + Phase 3 vendor
    health_score: Optional[float] = None
    vendor_risk_summary: Optional[Dict[str, int]] = None


class BusinessMetrics(BaseModel):
    tasks_analysed: int
    documents_indexed: int
    risks_detected: int
    actions_completed: int
    scenarios_approved_pct: float
    avg_confidence: float
    hours_saved_estimate: float
    manual_hours_baseline: float
    ai_hours_actual: float

    # NEW — AI Memory performance metrics
    ai_memory_events: int = 0
    ai_prediction_accuracy: float = 0.0


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN
# ─────────────────────────────────────────────────────────────────────────────
class AuditRow(BaseModel):
    id: str
    event_type: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    created_at: datetime


class SchemaMemoryRow(BaseModel):
    source_column: str
    canonical_column: str
    mapping_method: str
    confidence: float
    usage_count: int


# ─────────────────────────────────────────────────────────────────────────────
# ACTION
# ─────────────────────────────────────────────────────────────────────────────
class ActionRead(OrmBase):
    id: str
    action_type: str
    description: str
    priority: str
    status: str
    estimated_impact_days: Optional[int]
    confidence: Optional[float]
    created_at: datetime


class ApproveActionRequest(BaseModel):
    action_id: str


class RejectActionRequest(BaseModel):
    action_id: str
    reason: str


# ─────────────────────────────────────────────────────────────────────────────
# GENERIC
# ─────────────────────────────────────────────────────────────────────────────
class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int