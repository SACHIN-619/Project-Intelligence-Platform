// lib/api.ts
// Single source of truth for all backend communication.
// Every function maps 1:1 to a FastAPI endpoint we built.
//
// Error handling philosophy:
//   - Never throw raw fetch errors to components
//   - Always return { data, error } so UI can show plain-English messages
//   - Network failures get a friendly message, not a stack trace

import { getToken, removeToken } from './auth'
import type {
  TokenResponse, Project, ProjectCreate, UploadResponse, UploadPreview,
  AnalysisResult, ProjectHealthDashboard, ScenarioResult, RecoveryOption,
  QueryRequest, QueryResponse, Action, BusinessMetrics, SystemHealth,
  VendorScoreResponse,
} from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const API_V1 = `${API_BASE}/api/v1`

// ── Result wrapper type ──────────────────────────────────────────────────
export interface ApiResult<T> {
  data: T | null
  error: string | null
  status: number
}

// ── User-friendly error messages by status code ──────────────────────────
function friendlyError(status: number, detail?: string): string {
  if (detail) return detail
  switch (status) {
    case 0:   return 'Cannot reach the server. Check your connection and try again.'
    case 401: return 'Your session has expired. Please log in again.'
    case 403: return 'You do not have permission to do this.'
    case 404: return 'We could not find what you were looking for.'
    case 413: return 'This file is too large. Maximum size is 50 MB.'
    case 415: return 'This file type is not supported.'
    case 422: return 'Some information is missing or invalid.'
    case 429: return 'Too many requests. Please wait a moment and try again.'
    case 500: return 'Something went wrong on our end. Please try again.'
    case 503: return 'This feature is temporarily unavailable.'
    default:  return 'Something unexpected happened. Please try again.'
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  const token = getToken()
  const headers: HeadersInit = {
    ...(options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  try {
    const res = await fetch(`${API_V1}${path}`, { ...options, headers })

    // Session expired — clear token, let app redirect to login
    if (res.status === 401) {
      removeToken()
      return { data: null, error: friendlyError(401), status: 401 }
    }

    // No content (204) — success with no body
    if (res.status === 204) {
      return { data: null, error: null, status: 204 }
    }

    const isJson = res.headers.get('content-type')?.includes('application/json')
    const body = isJson ? await res.json().catch(() => null) : null

    if (!res.ok) {
      const detail = body?.detail || body?.message
      return { data: null, error: friendlyError(res.status, detail), status: res.status }
    }

    return { data: body as T, error: null, status: res.status }
  } catch (err) {
    // Network failure (server down, no internet, CORS, etc.)
    return { data: null, error: friendlyError(0), status: 0 }
  }
}

// ═════════════════════════════════════════════════════════════════════════
// AUTH
// ═════════════════════════════════════════════════════════════════════════

export async function demoLogin(): Promise<ApiResult<TokenResponse>> {
  return request<TokenResponse>('/auth/demo-login', { method: 'POST' })
}

export async function login(email: string, password: string): Promise<ApiResult<TokenResponse>> {
  return request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

// ═════════════════════════════════════════════════════════════════════════
// PROJECTS
// ═════════════════════════════════════════════════════════════════════════

export async function createProject(body: ProjectCreate): Promise<ApiResult<Project>> {
  return request<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function listProjects(): Promise<ApiResult<Project[]>> {
  return request<Project[]>('/projects')
}

export async function getProject(projectId: string): Promise<ApiResult<Project>> {
  return request<Project>(`/projects/${projectId}`)
}

export async function archiveProject(projectId: string): Promise<ApiResult<{ message: string }>> {
  return request(`/projects/${projectId}`, { method: 'DELETE' })
}

// ═════════════════════════════════════════════════════════════════════════
// UPLOAD
// ═════════════════════════════════════════════════════════════════════════

export async function previewUpload(file: File): Promise<ApiResult<UploadPreview>> {
  const formData = new FormData()
  formData.append('file', file)
  return request<UploadPreview>('/upload/preview', {
    method: 'POST',
    body: formData,
  })
}

export async function commitUpload(
  file: File,
  projectId: string
): Promise<ApiResult<UploadResponse>> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('project_id', projectId)
  return request<UploadResponse>('/upload/commit', {
    method: 'POST',
    body: formData,
  })
}

export async function getUploadStatus(uploadId: string): Promise<ApiResult<UploadResponse>> {
  return request<UploadResponse>(`/upload/${uploadId}`)
}

export async function listUploads(projectId: string): Promise<ApiResult<UploadResponse[]>> {
  return request<UploadResponse[]>(`/upload/project/${projectId}`)
}

export async function deleteUpload(uploadId: string): Promise<ApiResult<{ message: string }>> {
  return request(`/upload/${uploadId}`, { method: 'DELETE' })
}

// ═════════════════════════════════════════════════════════════════════════
// ANALYSIS
// ═════════════════════════════════════════════════════════════════════════

export async function getAnalysis(projectId: string): Promise<ApiResult<AnalysisResult>> {
  return request<AnalysisResult>(`/analysis/${projectId}`)
}

export async function getDashboard(projectId: string): Promise<ApiResult<ProjectHealthDashboard>> {
  return request<ProjectHealthDashboard>(`/analysis/${projectId}/dashboard`)
}

export async function triggerAnalysis(projectId: string): Promise<ApiResult<{ message: string }>> {
  return request(`/analysis/${projectId}/run`, { method: 'POST' })
}

export async function queryProject(body: QueryRequest): Promise<ApiResult<QueryResponse>> {
  return request<QueryResponse>('/analysis/query', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ═════════════════════════════════════════════════════════════════════════
// SIMULATION / RECOVERY
// ═════════════════════════════════════════════════════════════════════════

export async function autoRecover(projectId: string): Promise<ApiResult<RecoveryOption[]>> {
  return request<RecoveryOption[]>(`/simulation/auto-recover/${projectId}`, { method: 'POST' })
}

export async function runSimulation(body: {
  project_id: string
  action_type: string
  action_params: Record<string, unknown>
  name?: string
}): Promise<ApiResult<ScenarioResult>> {
  return request<ScenarioResult>('/simulation/run', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function approveScenario(scenarioId: string): Promise<ApiResult<{ message: string; detail: string }>> {
  return request(`/simulation/${scenarioId}/approve`, { method: 'POST' })
}

export async function rejectScenario(
  scenarioId: string,
  reason: string
): Promise<ApiResult<{ message: string }>> {
  return request(`/simulation/${scenarioId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ scenario_id: scenarioId, reason }),
  })
}

export async function listScenarios(projectId: string): Promise<ApiResult<ScenarioResult[]>> {
  return request<ScenarioResult[]>(`/simulation/project/${projectId}`)
}

export async function compoundScenario(
  projectId: string,
  scenarioIds: [string, string]
): Promise<ApiResult<{
  combined_days_saved: number
  independent_sum: number
  synergy_days: number
  new_delay_days: number
  message: string
}>> {
  return request(`/simulation/compound/${projectId}`, {
    method: 'POST',
    body: JSON.stringify(scenarioIds),
  })
}

// ═════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═════════════════════════════════════════════════════════════════════════

export async function createAction(body: {
  project_id: string
  action_type: string
  description: string
  target_task_id?: string
  priority?: string
  estimated_impact_days?: number
  confidence?: number
  scenario_id?: string
}): Promise<ApiResult<Action>> {
  return request<Action>('/actions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getAction(actionId: string): Promise<ApiResult<Action>> {
  return request<Action>(`/actions/${actionId}`)
}

export async function approveAction(actionId: string): Promise<ApiResult<{ message: string; detail: string }>> {
  return request(`/actions/${actionId}/approve`, { method: 'POST' })
}

export async function rejectAction(
  actionId: string,
  reason: string
): Promise<ApiResult<{ message: string }>> {
  return request(`/actions/${actionId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ action_id: actionId, reason }),
  })
}

export async function completeAction(
  actionId: string,
  actualImpactDays: number,
  notes?: string
): Promise<ApiResult<Action>> {
  return request<Action>(`/actions/${actionId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ actual_impact_days: actualImpactDays, notes }),
  })
}

export async function listActions(
  projectId: string,
  statusFilter?: string
): Promise<ApiResult<Action[]>> {
  const qs = statusFilter ? `?status_filter=${statusFilter}` : ''
  return request<Action[]>(`/actions/project/${projectId}${qs}`)
}

export interface KanbanColumn {
  status: string
  label: string
  actions: Action[]
  count: number
}

export async function getActionBoard(projectId: string): Promise<ApiResult<KanbanColumn[]>> {
  return request<KanbanColumn[]>(`/actions/project/${projectId}/board`)
}

// ═════════════════════════════════════════════════════════════════════════
// REPORT
// ═════════════════════════════════════════════════════════════════════════

export async function generateReport(body: {
  project_id: string
  include_monte_carlo?: boolean
  include_evidence?: boolean
  scenario_ids?: string[]
}): Promise<ApiResult<{ report_id: string; download_url: string; generated_at: string }>> {
  return request('/report/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getReportDownloadUrl(reportId: string): string {
  const token = getToken()
  return `${API_V1}/report/download/${reportId}${token ? `?token=${token}` : ''}`
}

// ═════════════════════════════════════════════════════════════════════════
// ADMIN
// ═════════════════════════════════════════════════════════════════════════

export async function getMetrics(projectId: string): Promise<ApiResult<BusinessMetrics>> {
  return request<BusinessMetrics>(`/admin/metrics/${projectId}`)
}

export async function getAuditTrail(
  projectId: string,
  limit = 50
): Promise<ApiResult<{
  id: string
  event_type: string
  entity_type?: string
  user_id?: string
  created_at: string
  before_state?: Record<string, unknown>
  after_state?: Record<string, unknown>
}[]>> {
  return request(`/admin/audit/${projectId}?limit=${limit}`)
}

export async function getSystemHealth(): Promise<ApiResult<SystemHealth>> {
  return request<SystemHealth>('/admin/health')
}

export async function toggleFeatureFlag(
  flag: string,
  enabled: boolean
): Promise<ApiResult<{ flag: string; enabled: boolean }>> {
  return request(`/admin/feature-flags/${flag}`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  })
}

export async function getFeatureFlags(): Promise<ApiResult<{
  rag: boolean
  monte_carlo: boolean
  pdf_export: boolean
  weather_agent: boolean
  vendor_scoring: boolean
  ai_memory: boolean
}>> {
  return request('/admin/feature-flags')
}

export async function getSchemaMemory(): Promise<ApiResult<{
  source_column: string
  canonical_column: string
  mapping_method: string
  confidence: number
  usage_count: number
}[]>> {
  return request('/admin/schema-memory')
}

// NEW — Phase 3: cross-project vendor reliability scoring
export async function getVendorScores(): Promise<ApiResult<VendorScoreResponse>> {
  return request<VendorScoreResponse>('/admin/vendor-scores')
}

// ═════════════════════════════════════════════════════════════════════════
// WEBSOCKET URL builder (used by hooks/useWebSocket.ts)
// ═════════════════════════════════════════════════════════════════════════

export function getWebSocketUrl(projectId: string): string {
  const token = getToken()
  const wsBase = API_BASE.replace('http://', 'ws://').replace('https://', 'wss://')
  return `${wsBase}/api/v1/ws/${projectId}?token=${token ?? ''}`
}