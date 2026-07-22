'use client'
import { useState, useEffect, useCallback } from 'react'
import { useProjectContext } from '@/contexts/ProjectContext'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { useWebSocket } from '@/hooks/useWebSocket'
import { previewUpload, commitUpload, listUploads } from '@/lib/api'
import { DropZone } from '@/components/upload/DropZone'
import { SchemaPreview } from '@/components/upload/SchemaPreview'
import { ProcessingSteps } from '@/components/upload/ProcessingSteps'
import { CompleteCard } from '@/components/upload/CompleteCard'
import { canUpload } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'
import type { UploadPreview, UploadResponse } from '@/types'

type UploadState = 'empty' | 'previewing' | 'preview' | 'processing' | 'complete'

export default function UploadPage() {
  const router = useRouter()
  const { activeProject, refreshActiveProject } = useProjectContext()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [state, setState] = useState<UploadState>('empty')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<UploadPreview | null>(null)
  const [recentUploads, setRecentUploads] = useState<UploadResponse[]>([])
  const [isCommitting, setIsCommitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [completionStats, setCompletionStats] = useState({ tasksAnalysed: 0, risksDetected: 0, delayDays: 0 })

  // Only connect WebSocket when actively processing — saves connection overhead
  const wsProjectId = state === 'processing' ? activeProject?.id ?? null : null
  const { lastEvent, isConnected } = useWebSocket(wsProjectId)
  const userCanUpload = user ? canUpload(user.role) : false

  const loadRecent = useCallback(async () => {
    if (!activeProject) return
    const { data } = await listUploads(activeProject.id)
    if (data) setRecentUploads(data)
  }, [activeProject])

  useEffect(() => { loadRecent() }, [loadRecent])

  async function handleFileSelected(file: File) {
    setSelectedFile(file); setState('previewing'); setErrorMessage(null)
    const { data, error } = await previewUpload(file)
    if (error || !data) { setErrorMessage(error || 'Could not read this file. Please check the format and try again.'); setState('empty'); setSelectedFile(null); return }
    setPreview(data); setState('preview')
  }

  function handleCancelPreview() { setSelectedFile(null); setPreview(null); setState('empty') }

  async function handleConfirmUpload() {
    if (!selectedFile || !activeProject) return
    setIsCommitting(true)
    const { data, error } = await commitUpload(selectedFile, activeProject.id)
    setIsCommitting(false)
    if (error || !data) { showToast('error', error || 'Upload failed. Please try again.'); return }
    showToast('success', `${selectedFile.name} uploaded — analysis starting`)
    setState('processing')
  }

  function handleProcessingComplete() {
    if (lastEvent?.type === 'analysis_complete') {
      setCompletionStats({ tasksAnalysed: lastEvent.tasks_analysed ?? 0, risksDetected: lastEvent.risks_found ?? 0, delayDays: lastEvent.delay_days ?? 0 })
    }
    refreshActiveProject(); setState('complete')
  }

  if (user && !userCanUpload) return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="material-symbols-outlined text-4xl text-[#374151]">lock</span>
      <h2 className="text-base font-semibold text-white">Read-only access</h2>
      <p className="max-w-sm text-sm text-[#6B7280]">Your role ({user.role}) cannot upload files.</p>
    </div>
  )

  if (!activeProject) return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="material-symbols-outlined text-4xl text-[#374151]">folder_off</span>
      <h2 className="text-base font-semibold text-white">No project selected</h2>
      <button onClick={() => router.push('/dashboard')} className="btn-primary mt-2">Go to Dashboard</button>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl p-4 lg:p-6">
      <div className="mb-5"><h1 className="text-xl font-bold text-white lg:text-2xl">Upload Center</h1><p className="mt-0.5 text-sm text-[#6B7280]">Add files to begin project intelligence analysis</p></div>
      {errorMessage && (<div className="mb-4 flex items-start gap-2 rounded-md border border-[#EF4444]/30 bg-[#EF4444]/10 p-3"><span className="material-symbols-outlined text-base text-[#EF4444]">error</span><p className="text-sm text-[#EF4444]">{errorMessage}</p></div>)}

      {state === 'empty' && <DropZone onFileSelected={handleFileSelected} recentUploads={recentUploads} />}
      {state === 'previewing' && (<div className="flex flex-col items-center justify-center gap-3 py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#374151] border-t-[#3B82F6]" /><p className="text-sm text-[#6B7280]">Reading {selectedFile?.name}...</p></div>)}
      {state === 'preview' && selectedFile && preview && (<SchemaPreview file={selectedFile} preview={preview} onCancel={handleCancelPreview} onConfirm={handleConfirmUpload} isCommitting={isCommitting} />)}
      {state === 'processing' && selectedFile && (
        <div className="space-y-4">
          <div className="card-panel flex items-center gap-2.5 p-3 opacity-35">
            <span className="material-symbols-outlined text-[#3B82F6]">description</span>
            <p className="text-sm text-white">{selectedFile.name}</p>
            <span className="badge-green ml-auto rounded px-2 py-0.5 text-[10px]">✓ Uploaded</span>
          </div>
          <div className="h-px w-full bg-[#374151]" />
          <ProcessingSteps lastEvent={lastEvent} isConnected={isConnected} onComplete={handleProcessingComplete} />
        </div>
      )}
      {state === 'complete' && <CompleteCard tasksAnalysed={completionStats.tasksAnalysed} risksDetected={completionStats.risksDetected} delayDays={completionStats.delayDays} />}
    </div>
  )
}
