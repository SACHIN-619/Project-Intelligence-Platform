/**
 * types/index.ts
 * ==============
 * Single source of truth for all TypeScript types in the frontend.
 * Every type here mirrors the corresponding Pydantic schema in the backend.
 *
 * RULE: if you add a field to a backend schema, add it here too.
 * RULE: never use `any` — use `unknown` and narrow it at usage point.
 */

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string
  token_type:   string
  expires_in:   number
}

export interface User {
  id:          string
  org_id:      string
  email:       string
  full_name:   string
  role:        UserRole
  is_active:   boolean
  preferences: UserPreferences
}

export type UserRole =
  | 'engineer'
  | 'manager'
  | 'quality'
  | 'procurement'
  | 'executive'
  | 'admin'

export interface UserPreferences {
  answer_style?:             'concise' | 'balanced' | 'technical'
  default_intelligence_tab?: 'critical_path' | 'risk_register' | 'monte_carlo'
  notifications?: {
    risk_alerts:        boolean
    analysis_complete:  boolean
    approval_needed:    boolean
    weekly_digest:      boolean
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT
// ─────────────────────────────────────────────────────────────────────────────

export interface Project {
  id:                      string
  name:                    string
  description?:            string
  status:                  'draft' | 'active' | 'completed' | 'archived'
  current_progress:        number
  baseline_completion_day?: number
  predicted_completion_day?: number
  confidence_score:        number
  created_at:              string
  updated_at:              string
}

export interface ProjectCreate {
  name:                   string
  description?:           string
  target_completion_day?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

export type UploadStatus = 'queued' | 'parsing' | 'parsed' | 'indexed' | 'failed'

export interface UploadResponse {
  id:                  string
  filename:            string
  file_type:           string
  status:              UploadStatus
  parse_quality_score?: number
  schema_mapping:      Record<string, string>
  unmapped_columns:    string[]
  row_count?:          number
  error_message?:      string
  created_at:          string
}

/**
 * Returned by POST /upload/preview before the user commits.
 * Shows the detected column mapping so users can verify before ingestion.
 */
export interface UploadPreview {
  filename:          string
  detected_type:     string             // "schedule" | "vendor" | "spec" | "general"
  row_count:         number
  columns_detected:  string[]
  schema_mapping:    Record<string, string>  // source_col → canonical_col
  unmapped_columns:  string[]
  quality_score:     number             // 0-100: how well columns mapped
  warnings:          string[]
  sample_rows:       Record<string, unknown>[]
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESSING STEPS (driven by WebSocket events during upload)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProcessingStep {
  label:     string
  status:    'waiting' | 'running' | 'done' | 'error'
  duration?: string   // e.g. "1.2s" — shown after step completes
}

/**
 * These labels must match what the backend broadcasts in job progress events.
 * Backend: app/services/queue/jobs.py → broadcast_progress(stage=...)
 */
export const PROCESSING_STEPS: ProcessingStep[] = [
  { label: 'Reading file',                      status: 'waiting' },
  { label: 'Loading schema memory',             status: 'waiting' },
  { label: 'Detecting column structure',        status: 'waiting' },
  { label: 'Saving tasks to database',          status: 'waiting' },
  { label: 'Embedding documents for AI search', status: 'waiting' },
  { label: 'Computing critical path',           status: 'waiting' },
  { label: 'Scoring risks',                     status: 'waiting' },
  { label: 'Running Monte Carlo simulation',    status: 'waiting' },
  { label: 'Generating AI explanations',        status: 'waiting' },
]

// ─────────────────────────────────────────────────────────────────────────────
// ANALYSIS (CPM + Risk + Monte Carlo)
// ─────────────────────────────────────────────────────────────────────────────

export type RiskLevel  = 'low' | 'medium' | 'high' | 'critical'
export type RiskType   = 'schedule' | 'vendor' | 'quality' | 'procurement'
export type TaskStatus = 'pending' | 'running' | 'delayed' | 'completed'

/**
 * One task node as computed by the CPM graph engine.
 * ES/EF = earliest start/finish (forward pass).
 * total_float: how many days this task can slip before affecting project end.
 * free_float:  how many days before affecting successor.
 */
export interface TaskGraphNode {
  task_id:      string
  name:         string
  es:           number   // earliest start day
  ef:           number   // earliest finish day
  total_float:  number   // 0 = critical path
  free_float:   number
  is_critical:  boolean
  actual_delay: number   // days currently delayed
  confidence:   number   // 0-1 float
}

export interface RiskSummary {
  id:           string
  task_name?:   string
  risk_type:    RiskType
  severity:     RiskLevel
  probability:  number    // 0-1
  impact_days:  number
  risk_score:   number    // 0-10
  explanation:  string
  confidence:   number    // 0-1 — how certain the model is
}

/**
 * Full analysis result returned by GET /analysis/{project_id}
 * Contains CPM schedule, risks, and Monte Carlo forecast.
 * BUG FIX 2: top_sensitivity_tasks — task_id is optional, backend returns only name
 */
export interface AnalysisResult {
  project_id:             string
  completion_day:         number
  original_completion_day: number
  total_delay_days:       number
  risk_level:             RiskLevel
  overall_confidence:     number
  critical_path:          string[]   // task names in critical path order
  tasks:                  TaskGraphNode[]
  risks:                  RiskSummary[]
  delay_breakdown:        Record<string, number>  // task_name → days it adds
  // Monte Carlo results — only present if feature_monte_carlo_enabled=true
  mc_p50?:                number
  mc_p80?:                number
  mc_p90?:                number
  mc_on_time_probability?: number
  top_sensitivity_tasks?: {
    task_id?:              string   // BUG FIX 2: optional, backend may not include
    name:                  string
    variance_contribution: number
  }[]
}

/** Lightweight summary for the dashboard header — avoids re-running full analysis */
export interface ProjectHealthDashboard {
  project_id:             string
  name:                   string
  completion_pct:         number
  predicted_delay_days:   number
  risk_level:             RiskLevel
  confidence:             number
  active_risks:           number
  active_scenarios:       number
  hours_saved_estimate:   number   // computed: manual hours - AI hours
  last_analysed?:         string
  critical_path_summary:  string[]
  //  health engine +  vendor scoring
  health_score?:          number
  vendor_risk_summary?: {
    total:    number
    critical: number
    high:     number
    medium:   number
    low:      number
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION / RECOVERY
// ─────────────────────────────────────────────────────────────────────────────

export type ActionType =
  | 'backup_vendor'
  | 'parallel_execution'
  | 'add_crew'
  | 'reschedule'
  | 'accelerate'
  | 'defer_non_critical'

/** One auto-generated recovery suggestion before the user runs a simulation */
export interface RecoveryOption {
  action_type:          ActionType
  title:                string
  description:          string
  estimated_days_saved: number
  estimated_cost:       'low' | 'medium' | 'high'
  confidence:           number
  feasibility:          number
  opportunity_window:   'now' | 'within_7_days' | 'within_30_days' | 'too_late'
  // AI Memory context
  memory_context?:      string   // e.g. "Used successfully in 3 past projects"
}
/**
 * Result of a run simulation — returned by POST /simulation/run
 * BUG FIX 1 + 10: added `status` field — backend stores it in DB and
 * the /simulation/project/{id} list endpoint returns it.
 */
export interface ScenarioResult {
  scenario_id:         string
  name:                string
  action_type:         string
  old_delay_days:      number
  new_delay_days:      number
  days_saved:          number
  days_saved_pct:      number
  feasibility_score:   number
  confidence:          number
  cost_impact:         number
  mc_p50?:             number
  mc_p80?:             number
  mc_p90?:             number
  on_time_probability?: number
  explanation:         string
  evidence:            { source: string; text: string }[]
  // BUG FIX 1: status field — present when fetching from DB (list endpoint)
  // Not present in immediate run response. Make optional.
 status?: 'draft' | 'approved' | 'rejected'
  //  memory + knowledge context behind this scenario
  memory_similar_cases?: { action_type: string; description: string; days_saved: number }[]
  knowledge_impact?: {
    entity: string
    impacted_tasks: string[]
    impacted_risks: string[]
    root_cause_vendors: string[]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS (Kanban)
// ─────────────────────────────────────────────────────────────────────────────

export type ActionStatus   = 'pending' | 'approved' | 'rejected' | 'completed'
export type ActionPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Action {
  id:                     string
  action_type:            string
  description:            string
  priority:               ActionPriority
  status:                 ActionStatus
  estimated_impact_days?: number
  confidence?:            number
  created_at:             string
}

// ─────────────────────────────────────────────────────────────────────────────
// RAG / AI ASSISTANT
// ─────────────────────────────────────────────────────────────────────────────

export interface QueryRequest {
  project_id:    string
  question:      string
  context_hint?: string
}

/** Response from POST /analysis/query — includes citations for transparency */
export interface QueryResponse {
  answer:    string
  confidence: number   // 0-1 — model's self-assessed confidence
  evidence: {
    source_file:     string
    page_number:     number
    text:            string    // the chunk that informed the answer
    relevance_score: number    // cosine similarity 0-1
  }[]
  assumptions:         string[]  // what the model assumed when data was missing
  missing_data:        string[]  // what would improve confidence
  suggested_questions: string[]  // follow-up questions the user might want to ask
  //  memory + knowledge graph grounding
  memory_context_used?:      number   // count of past decisions surfaced
  knowledge_entities_found?: number   // count of graph entities matched
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBSOCKET EVENTS
// Matches events broadcast by backend: app/api/websocket.py
// ─────────────────────────────────────────────────────────────────────────────

export interface WSEvent {
  type:
    | 'connected'
    | 'progress'
    | 'analysis_complete'
    | 'risk_found'
    | 'error'
    | 'heartbeat'
    | 'pong'
  // Progress event fields
  stage?:                   string   // e.g. "Embedding documents for AI search"
  pct?:                     number   // 0-100
  detail?:                  string
  // Analysis complete event fields (BUG FIX: added tasks_analysed)
  delay_days?:              number
  risk_level?:              RiskLevel
  confidence?:              number
  risks_found?:             number
  tasks_analysed?:          number   // added via backend patch in jobs.py
  critical_path?:           string[]
  mc_p80?:                  number
  mc_on_time_probability?:  number
  message?:                 string
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────

export interface BusinessMetrics {
  tasks_analysed:          number
  documents_indexed:       number
  risks_detected:          number
  actions_completed:       number
  scenarios_approved_pct:  number
  avg_confidence:          number
  hours_saved_estimate:    number   // vs manual process baseline
  manual_hours_baseline:   number
  ai_hours_actual:         number
  // AI Memory performance metrics (Phase 19)
  ai_memory_events:        number
  ai_prediction_accuracy:  number   // % — actual vs estimated days saved on completed actions
}

/** BUG FIX 6: proper type for audit rows instead of any */
export interface AuditRow {
  id:           string
  event_type:   string
  entity_type?: string
  user_id?:     string
  created_at:   string
  before_state?: Record<string, unknown>
  after_state?:  Record<string, unknown>
}

export interface ComponentHealth {
  name:   'database' | 'pgvector' | 'redis' | 'gemini_ai' | 'embeddings'
  status: 'ok' | 'degraded' | 'down'
  detail: string
}

export interface SystemHealth {
  overall:     'ok' | 'degraded' | 'down'
  components:  ComponentHealth[]
  checked_at:  string
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR RELIABILITY — Phase 3 cross-project scoring
// ─────────────────────────────────────────────────────────────────────────────

export interface VendorScore {
  vendor_name:        string
  reliability_score:  number   // 0-100, % on-time
  avg_delay_days:     number
  total_tasks:        number
  on_time:            number
  late:               number
  risk_level:         'low' | 'medium' | 'high' | 'critical'
}

export interface VendorScoreResponse {
  summary: {
    total:    number
    critical: number
    high:     number
    medium:   number
    low:      number
  }
  vendors: VendorScore[]
}

// ─────────────────────────────────────────────────────────────────────────────
// UI NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

export interface NavItem {
  label: string
  href:  string
  icon:  string        // Material Symbol name
  roles: UserRole[]   // role-based nav visibility
}

/**
 * All 9 screens in display order.
 * The roles array controls which roles see each nav item in the sidebar.
 * Executive gets read-only access (no upload, recovery, assistant).
 * Admin sees everything.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     href: '/dashboard',    icon: 'dashboard',            roles: ['engineer','manager','quality','procurement','executive','admin'] },
  { label: 'Upload',        href: '/upload',       icon: 'upload_file',          roles: ['engineer','manager','quality','procurement','admin'] },
  { label: 'Intelligence',  href: '/intelligence', icon: 'psychology',           roles: ['engineer','manager','quality','procurement','executive','admin'] },
  { label: 'Recovery Lab',  href: '/recovery',     icon: 'biotech',              roles: ['engineer','manager','procurement','admin'] },
  { label: 'Actions',       href: '/actions',      icon: 'view_kanban',          roles: ['engineer','manager','quality','procurement','executive','admin'] },
  { label: 'AI Assistant',  href: '/assistant',    icon: 'smart_toy',            roles: ['engineer','manager','quality','procurement','admin'] },
  { label: 'Report',        href: '/report',       icon: 'description',          roles: ['engineer','manager','quality','procurement','executive','admin'] },
  { label: 'Admin',         href: '/admin',        icon: 'admin_panel_settings', roles: ['manager','admin'] },
  { label: 'System Health', href: '/health',       icon: 'query_stats',          roles: ['admin'] },
]

// ── Risk level display helpers ─────────────────────────────────────────────
export const RISK_COLOURS: Record<RiskLevel, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#EAB308',
  low:      '#22C55E',
}

export const RISK_BADGE_CLASS: Record<RiskLevel, string> = {
  critical: 'badge-red',
  high:     'badge-orange',
  medium:   'badge-amber',
  low:      'badge-green',
}

export const RISK_BORDER_CLASS: Record<RiskLevel, string> = {
  critical: 'risk-border-critical',
  high:     'risk-border-high',
  medium:   'risk-border-medium',
  low:      'risk-border-low',
}
