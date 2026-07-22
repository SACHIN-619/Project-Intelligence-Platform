// components/upload/DropZone.tsx
'use client'

import { useState, useRef, DragEvent } from 'react'
import { cn, formatFileSize, timeAgo } from '@/lib/utils'
import type { UploadResponse } from '@/types'

interface DropZoneProps {
  onFileSelected: (file: File) => void
  recentUploads: UploadResponse[]
}

const ALLOWED_EXTENSIONS = ['csv', 'xlsx', 'xls', 'pdf', 'docx']
const MAX_SIZE_MB = 50

export function DropZone({ onFileSelected, recentUploads }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function validateAndSelect(file: File) {
    setValidationError(null)
    const ext = file.name.split('.').pop()?.toLowerCase() || ''

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setValidationError(
        `"${file.name}" is not a supported file type. Please use CSV, XLSX, PDF, or DOCX.`
      )
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setValidationError(
        `"${file.name}" is too large (${formatFileSize(file.size)}). Maximum size is ${MAX_SIZE_MB} MB.`
      )
      return
    }
    onFileSelected(file)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) validateAndSelect(file)
  }

  function handleBrowseChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) validateAndSelect(file)
    e.target.value = ''   // allow re-selecting same file
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-all',
          isDragging
            ? 'border-[#3B82F6] bg-[#3B82F6]/10'
            : 'border-[#374151] bg-transparent'
        )}
      >
        <span
          className={cn(
            'material-symbols-outlined text-5xl transition-transform',
            isDragging ? 'scale-110 text-[#3B82F6]' : 'text-[#6B7280]'
          )}
        >
          cloud_upload
        </span>

        <p className="mt-4 text-base text-white">
          Drag and drop your files here
        </p>
        <p className="mt-1 text-sm text-[#6B7280]">or</p>

        <button
          onClick={() => inputRef.current?.click()}
          className="btn-ghost mt-3 border-[#3B82F6] text-[#3B82F6] hover:bg-[#3B82F6]/10"
        >
          Browse Files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.pdf,.docx"
          onChange={handleBrowseChange}
          className="hidden"
        />

        <p className="mt-5 text-xs text-[#6B7280]">
          Supported: CSV · XLSX · PDF · DOCX &nbsp;·&nbsp; Max {MAX_SIZE_MB}MB per file
        </p>
      </div>

      {validationError && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-[#EF4444]/30 bg-[#EF4444]/10 p-3">
          <span className="material-symbols-outlined text-base text-[#EF4444]">error</span>
          <p className="text-sm text-[#EF4444]">{validationError}</p>
        </div>
      )}

      {recentUploads.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Recently Uploaded
          </p>
          <div className="flex flex-wrap gap-3">
            {recentUploads.slice(0, 4).map(u => (
              <div
                key={u.id}
                className="card-panel flex w-40 flex-col gap-1.5 p-3"
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-[#6B7280]">
                    description
                  </span>
                  <p className="truncate text-xs text-white">{u.filename}</p>
                </div>
                <span
                  className={cn(
                    'inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
                    u.status === 'indexed' ? 'badge-green' :
                    u.status === 'failed' ? 'badge-red' : 'badge-blue'
                  )}
                >
                  {u.status === 'indexed' && '✓ Indexed'}
                  {u.status === 'failed' && '✕ Failed'}
                  {!['indexed', 'failed'].includes(u.status) && '⟳ Processing'}
                </span>
                <span className="text-[10px] text-[#6B7280]">{timeAgo(u.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
