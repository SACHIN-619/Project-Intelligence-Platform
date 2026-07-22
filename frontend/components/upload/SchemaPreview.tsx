// components/upload/SchemaPreview.tsx
'use client'

import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn, formatFileSize } from '@/lib/utils'
import type { UploadPreview } from '@/types'

interface SchemaPreviewProps {
  file: File
  preview: UploadPreview
  onCancel: () => void
  onConfirm: () => void
  isCommitting: boolean
}

function confidenceLabel(confidence: number): string {
  const filled = Math.round(confidence * 5)
  return '●'.repeat(filled) + '○'.repeat(5 - filled)
}

export function SchemaPreview({
  file, preview, onCancel, onConfirm, isCommitting,
}: SchemaPreviewProps) {
  const qualityColour =
    preview.quality_score >= 80 ? '#22C55E' :
    preview.quality_score >= 60 ? '#F97316' : '#EF4444'

  const mappedEntries = Object.entries(preview.schema_mapping)
  const taskCount = preview.sample_rows.length > 0 && 'task' in preview.sample_rows[0]
    ? preview.row_count : preview.row_count

  return (
    <div className="animate-slide-in-up">
      {/* Compact file strip */}
      <div className="card-panel flex items-center justify-between p-3">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#3B82F6]">description</span>
          <div>
            <p className="text-sm text-white">{file.name}</p>
            <p className="text-xs text-[#6B7280]">{formatFileSize(file.size)}</p>
          </div>
        </div>
        <button onClick={onCancel} className="text-xs text-[#6B7280] hover:text-white">
          × Remove
        </button>
      </div>

      {/* Divider with label */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="h-px w-full bg-[#374151]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[#0A0F1E] px-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Schema Mapping Preview
          </span>
        </div>
      </div>

      {/* Data quality score */}
      <div className="card-panel p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white">Data Quality Score</span>
          <span className="text-sm font-bold text-white">
            {Math.round(preview.quality_score)} / 100
          </span>
        </div>
        <ProgressBar
          value={preview.quality_score}
          colour={qualityColour}
          gradient={preview.quality_score >= 60}
          className="mt-2"
          height={8}
        />
      </div>

      {/* Mapping table */}
      <div className="card-panel mt-4 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#1F2937] text-[10px] uppercase tracking-wider text-[#9CA3AF]">
              <th className="px-3 py-2.5 font-semibold">Your Column</th>
              <th className="px-3 py-2.5 font-semibold">We Detected</th>
              <th className="px-3 py-2.5 text-right font-semibold">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {mappedEntries.map(([source, canonical], i) => {
              const isUnmapped = canonical === 'unmapped'
              return (
                <tr
                  key={i}
                  className="border-t border-[#1F2937] transition-colors hover:bg-[#1F2937]"
                >
                  <td className="px-3 py-2.5 font-mono text-[#dce2f7]">{source}</td>
                  <td className="px-3 py-2.5">
                    {isUnmapped ? (
                      <span className="flex items-center gap-1 text-[#F97316]">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        Unmapped
                        <span className="ml-1 italic text-[#6B7280]">— kept as extra data</span>
                      </span>
                    ) : (
                      <span className="text-[#3B82F6]">{canonical}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {!isUnmapped && (
                      <span className="font-mono text-[#3B82F6]">●●●●●</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Sample rows */}
      {preview.sample_rows.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Sample rows ({preview.sample_rows.length})
          </p>
          <div className="card-panel overflow-x-auto p-3">
            <table className="w-full min-w-[400px] text-left text-xs">
              <tbody>
                {preview.sample_rows.map((row, i) => (
                  <tr key={i} className="border-b border-[#1F2937] last:border-0">
                    {Object.entries(row).map(([key, val]) => (
                      <td key={key} className="px-2 py-2 text-[#dce2f7]">
                        {key === 'status' && val === 'Delayed' ? (
                          <span className="badge-red rounded px-1.5 py-0.5 text-[10px]">
                            {String(val)}
                          </span>
                        ) : key === 'status' && val === 'Completed' ? (
                          <span className="badge-green rounded px-1.5 py-0.5 text-[10px]">
                            {String(val)}
                          </span>
                        ) : (
                          String(val ?? '—')
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warnings */}
      <div className="mt-4 flex flex-col gap-2">
        {preview.unmapped_columns.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-[#F97316]">
            <span className="material-symbols-outlined text-sm">warning</span>
            {preview.unmapped_columns.length} column(s) unmapped — saved as extra data
          </div>
        )}
        {preview.warnings
          .filter(w => !w.toLowerCase().includes('circular'))
          .map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-[#9CA3AF]">
              <span className="material-symbols-outlined text-sm">info</span>
              {w}
            </div>
          ))}
        {!preview.warnings.some(w => w.toLowerCase().includes('circular')) && (
          <div className="flex items-center gap-2 text-xs text-[#22C55E]">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Circular dependency check: None detected
          </div>
        )}
      </div>

      {/* Stats row */}
      <p className="mt-4 text-xs text-[#9CA3AF]">
        {preview.row_count} row{preview.row_count !== 1 ? 's' : ''} detected
        {' · '}
        {mappedEntries.filter(([, c]) => c !== 'unmapped').length} field(s) mapped
      </p>

      {/* Action buttons */}
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost text-sm" disabled={isCommitting}>
          Cancel
        </button>
        <button onClick={onConfirm} disabled={isCommitting} className="btn-primary text-sm">
          {isCommitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Uploading...
            </>
          ) : (
            'Confirm & Upload'
          )}
        </button>
      </div>
    </div>
  )
}
