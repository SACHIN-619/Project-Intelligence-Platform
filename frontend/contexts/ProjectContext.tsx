// contexts/ProjectContext.tsx
'use client'

import {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react'
import { listProjects, getProject } from '@/lib/api'
import { useAuth } from './AuthContext'
import type { Project } from '@/types'

interface ProjectContextValue {
  projects: Project[]
  activeProject: Project | null
  isLoading: boolean
  error: string | null
  setActiveProjectId: (id: string) => void
  refreshProjects: () => Promise<void>
  refreshActiveProject: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined)

const ACTIVE_PROJECT_KEY = 'pii_active_project_id'

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Load all projects ────────────────────────────────────────────────────
  const refreshProjects = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const { data, error: err } = await listProjects()
    if (err) {
      setError(err)
      setIsLoading(false)
      return
    }
    setProjects(data || [])

    // Restore previously active project, or default to most recent
    const savedId = typeof window !== 'undefined'
      ? localStorage.getItem(ACTIVE_PROJECT_KEY)
      : null
    const found = data?.find(p => p.id === savedId) || data?.[0] || null
    setActiveProject(found)
    setIsLoading(false)
  }, [])

  // ── Refresh just the active project (after analysis completes etc.) ──────
  const refreshActiveProject = useCallback(async () => {
    if (!activeProject) return
    const { data } = await getProject(activeProject.id)
    if (data) setActiveProject(data)
  }, [activeProject])

  // ── Switch active project ────────────────────────────────────────────────
  const setActiveProjectId = useCallback((id: string) => {
    const found = projects.find(p => p.id === id)
    if (found) {
      setActiveProject(found)
      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_PROJECT_KEY, id)
      }
    }
  }, [projects])

  // ── Load on auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) {
      refreshProjects()
    } else {
      setProjects([])
      setActiveProject(null)
      setIsLoading(false)
    }
  }, [isAuthenticated, refreshProjects])

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        isLoading,
        error,
        setActiveProjectId,
        refreshProjects,
        refreshActiveProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjectContext must be used within ProjectProvider')
  return ctx
}
