/**
 * components/intelligence/CriticalPathTab.tsx
 * =============================================
 * First tab on the Intelligence screen.
 *
 * Renders the project dependency graph using React Flow.
 * Clicking any node opens a detail side panel showing:
 *   - Schedule values (ES, EF, float)
 *   - Downstream delay impact
 *   - AI insight
 *   - "Go to Recovery Lab" button
 *
 * Node colours:
 *   Red    → task is delayed (actual_delay > 0)
 *   Orange → on the critical path (total_float === 0)
 *   Green  → healthy with float
 *   Grey   → pending, not yet started
 *
 * Edge colours:
 *   Red animated  → critical path connection
 *   Grey          → non-critical connection
 *
 * BUG FIX 7: edges are now built from analysis.critical_path (the ordered
 *   name array from the backend) rather than the ef===es heuristic which
 *   created false edges when multiple tasks shared the same day values.
 */
/**
 * components/intelligence/CriticalPathTab.tsx
 * =============================================
 * First tab on the Intelligence screen.
 *
 * Renders the project dependency graph using React Flow.
 * Clicking any node opens a detail side panel showing:
 * - Schedule values (ES, EF, float)
 * - Downstream delay impact
 * - AI insight
 * - "Go to Recovery Lab" button
 */
'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Position,
  Handle,
  NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { cn, formatPct } from '@/lib/utils'
import type { TaskGraphNode, AnalysisResult } from '@/types'
import { useRouter } from 'next/navigation'

interface CriticalPathTabProps {
  analysis: AnalysisResult
}

// ── Custom React Flow node ────────────────────────────────────────────────────
function TaskNode({ data }: NodeProps) {
  const task: TaskGraphNode = data.task
  const isSelected: boolean = data.isSelected

  // Pick node border colour by status
  const borderColour =
    task.actual_delay > 0   ? '#EF4444' :
    task.is_critical         ? '#F97316' :
    task.total_float < 3    ? '#EAB308' :
    task.total_float === 0  ? '#3B82F6' : '#22C55E'

  return (
    <div
      className={cn(
        'rounded-lg border-2 px-3 py-2 text-left shadow-lg',
        'min-w-[140px] max-w-[180px] cursor-pointer transition-all duration-150',
        isSelected && 'ring-2 ring-white ring-offset-1 ring-offset-[#0A0F1E]'
      )}
      style={{
        background:   `${borderColour}18`,
        borderColor:  borderColour,
        boxShadow: task.actual_delay > 0
          ? `0 0 14px ${borderColour}50`
          : undefined,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: borderColour, border: 'none', width: 8, height: 8 }}
      />

      <div className="mb-1">
        {task.actual_delay > 0 ? (
          <span className="badge-red rounded px-1.5 py-0.5 text-[9px] font-bold uppercase">
            +{task.actual_delay}d delay
          </span>
        ) : task.is_critical ? (
          <span className="rounded bg-[#F97316]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#F97316]">
            critical
          </span>
        ) : (
          <span className="rounded bg-[#22C55E]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#22C55E]">
            {task.total_float}d float
          </span>
        )}
      </div>

      <p className="text-xs font-semibold leading-tight text-white">{task.name}</p>

      <p className="mt-1 text-[10px] text-[#9CA3AF]">
        ES:{task.es} · EF:{task.ef}
      </p>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: borderColour, border: 'none', width: 8, height: 8 }}
      />
    </div>
  )
}

const nodeTypes = { taskNode: TaskNode }

// ── Layout & Topology builder strategy function ──────────────────────────────
function buildNodesEdges(
  analysis: AnalysisResult,
  selectedId: string | null
): { nodes: Node[]; edges: Edge[] } {
  const tasks       = analysis.tasks
  const criticalSet = new Set(analysis.critical_path)

  if (tasks.length === 0) return { nodes: [], edges: [] }

  const esBuckets: Record<number, TaskGraphNode[]> = {}
  tasks.forEach(t => {
    const key = t.es ?? 0
    if (!esBuckets[key]) esBuckets[key] = []
    esBuckets[key].push(t)
  })

  const sortedEs = Object.keys(esBuckets).map(Number).sort((a, b) => a - b)

  // Redistribution check if all tasks fall on matching ES values
  const useIndexLayout = sortedEs.length <= 1 && tasks.length > 1
  const COL_WIDTH  = 220
  const ROW_HEIGHT = 120
  const PADDING    = 50
  const COL_SIZE   = 4

  const nodes: Node[] = []

  if (useIndexLayout) {
    tasks.forEach((task, idx) => {
      const colIdx = Math.floor(idx / COL_SIZE)
      const rowIdx = idx % COL_SIZE
      nodes.push({
        id:   task.task_id,
        type: 'taskNode',
        position: {
          x: PADDING + colIdx * COL_WIDTH,
          y: PADDING + rowIdx * ROW_HEIGHT,
        },
        data: { task, isSelected: task.task_id === selectedId },
        draggable: true,
      })
    })
  } else {
    sortedEs.forEach((es, colIdx) => {
      esBuckets[es].forEach((task, rowIdx) => {
        nodes.push({
          id:   task.task_id,
          type: 'taskNode',
          position: {
            x: PADDING + colIdx * COL_WIDTH,
            y: PADDING + rowIdx * ROW_HEIGHT,
          },
          data: { task, isSelected: task.task_id === selectedId },
          draggable: true,
        })
      })
    })
  }

  const edges: Edge[] = []
  const nameToId: Record<string, string> = {}
  tasks.forEach(t => { nameToId[t.name] = t.task_id })

  // Critical path edges
  const cpNames = analysis.critical_path
  for (let i = 0; i < cpNames.length - 1; i++) {
    const srcId = nameToId[cpNames[i]]
    const dstId = nameToId[cpNames[i + 1]]
    if (srcId && dstId) {
      edges.push({
        id:       `cp-${srcId}-${dstId}`,
        source:   srcId,
        target:   dstId,
        animated: true,
        type:     'smoothstep',
        style:    { stroke: '#EF4444', strokeWidth: 2.5 },
      })
    }
  }

  // Non-critical structural edges
  if (!useIndexLayout) {
    tasks
      .filter(b => !criticalSet.has(b.name))
      .forEach(b => {
        const pred = tasks
          .filter(a => a.task_id !== b.task_id && (a.ef ?? 0) <= (b.es ?? 0))
          .sort((x, y) => (y.ef ?? 0) - (x.ef ?? 0))[0]
        if (pred) {
          const edgeId = `${pred.task_id}-${b.task_id}`
          if (!edges.find(e => e.id === edgeId)) {
            edges.push({
              id:     edgeId,
              source: pred.task_id,
              target: b.task_id,
              type:   'smoothstep',
              style:  { stroke: '#2D3748', strokeWidth: 1 },
            })
          }
        }
      })
  }

  return { nodes, edges }
}

// ── Task detail side panel ────────────────────────────────────────────────────
function TaskDetailPanel({
  task,
  analysis,
  onClose,
}: {
  task:     TaskGraphNode
  analysis: AnalysisResult
  onClose:  () => void
}) {
  const router = useRouter()

  return (
    <div className="slide-over-panel animate-slide-in-right">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1F2937] bg-[#111827] px-4 py-3">
        <h3 className="text-sm font-semibold text-white truncate">{task.name}</h3>
        <button onClick={onClose} className="ml-2 shrink-0 text-[#6B7280] hover:text-white">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap gap-2">
          {task.actual_delay > 0 ? (
            <span className="badge-red rounded-md px-2 py-1 text-xs font-bold">
              DELAYED +{task.actual_delay} days
            </span>
          ) : task.is_critical ? (
            <span className="badge-orange rounded-md px-2 py-1 text-xs font-bold">
              CRITICAL PATH
            </span>
          ) : (
            <span className="badge-green rounded-md px-2 py-1 text-xs font-bold">
              HEALTHY
            </span>
          )}
          <span className="badge-purple rounded-md px-2 py-1 text-xs">
            {formatPct(task.confidence)} confidence
          </span>
        </div>

        <div className="card-panel p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
            Schedule
          </p>
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            {[
              ['Earliest Start',    `Day ${task.es}`],
              ['Earliest Finish',   `Day ${task.ef}`],
              ['Total Float',       `${task.total_float} days`],
              ['Free Float',        `${task.free_float} days`],
              ['Actual Delay',      `${task.actual_delay} days`],
              ['Critical Path',     task.is_critical ? 'Yes' : 'No'],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-[#6B7280]">{label}</p>
                <p className={cn(
                  'font-medium',
                  label === 'Critical Path'  && task.is_critical   ? 'text-[#F97316]' :
                  label === 'Actual Delay'   && task.actual_delay > 0 ? 'text-[#EF4444]' :
                  'text-white'
                )}>
                  {val}
                </p>
              </div>
            ))}
          </div>
        </div>

        {analysis.delay_breakdown[task.task_id] && (
          <div className="card-panel p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Downstream Impact
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#EF4444]">
                +{analysis.delay_breakdown[task.task_id]}
              </span>
              <span className="text-sm text-[#9CA3AF]">days added to project end</span>
            </div>
          </div>
        )}

        {task.actual_delay > 0 && (
          <div className="ai-insight-box">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-base text-[#14B8A6]">
                auto_awesome
              </span>
              <p className="text-xs text-[#dce2f7]">
                This task has <strong>{task.actual_delay} day(s)</strong> of actual delay
                and {task.is_critical
                  ? 'sits on the critical path — every additional day extends project completion.'
                  : `has ${task.total_float} day(s) of float remaining before becoming critical.`
                }
              </p>
            </div>
          </div>
        )}

        <button
          onClick={() => router.push('/recovery')}
          className="btn-primary w-full justify-center text-sm"
        >
          <span className="material-symbols-outlined text-base">biotech</span>
          Go to Recovery Lab →
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function CriticalPathTab({ analysis }: CriticalPathTabProps) {
  const [selectedTask, setSelectedTask] = useState<TaskGraphNode | null>(null)

  const { nodes: builtNodes, edges: builtEdges } = useMemo(
    () => buildNodesEdges(analysis, selectedTask?.task_id ?? null),
    [analysis, selectedTask?.task_id]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(builtNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(builtEdges)

  // Sync internal viewport topology states explicitly on updates
  useEffect(() => {
    setNodes(builtNodes)
    setEdges(builtEdges)
  }, [builtNodes, builtEdges, setNodes, setEdges])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const task = analysis.tasks.find(t => t.task_id === node.id)
      setSelectedTask(prev =>
        prev?.task_id === node.id ? null : (task ?? null)
      )
    },
    [analysis.tasks]
  )

  const delayedCount  = analysis.tasks.filter(t => t.actual_delay > 0).length
  const criticalCount = analysis.critical_path.length

  return (
    <div className="relative flex h-[calc(100vh-220px)] min-h-[400px]">
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          className="bg-[#0A0F1E]"
          deleteKeyCode={null}
        >
          <Background
            variant={BackgroundVariant.Dots}
            color="#1F2937"
            gap={24}
            size={1}
          />
          <Controls
            className="border-[#374151] bg-[#111827]"
            showInteractive={false}
          />
          <MiniMap
            className="border border-[#374151] bg-[#0A0F1E]"
            nodeColor={node => {
              const task = analysis.tasks.find(t => t.task_id === node.id)
              if (!task) return '#374151'
              if (task.actual_delay > 0)  return '#EF4444'
              if (task.is_critical)        return '#F97316'
              return '#22C55E'
            }}
            maskColor="rgba(10,15,30,0.8)"
          />
        </ReactFlow>

        <div className="absolute bottom-16 left-3 z-10 flex flex-col gap-1.5 rounded-lg border border-[#374151] bg-[#111827]/90 p-3 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
            Legend
          </p>
          {[
            { colour: '#EF4444', label: `Delayed (${delayedCount})` },
            { colour: '#F97316', label: `Critical path (${criticalCount})` },
            { colour: '#22C55E', label: 'Healthy' },
            { colour: '#374151', label: 'Pending' },
          ].map(({ colour, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colour }} />
              <span className="text-[11px] text-[#9CA3AF]">{label}</span>
            </div>
          ))}
          <p className="mt-1 text-[10px] italic text-[#4B5563]">
            Click any node for details
          </p>
        </div>
      </div>

      {selectedTask && (
        <>
          <div
            className="slide-over-overlay"
            onClick={() => setSelectedTask(null)}
          />
          <TaskDetailPanel
            task={selectedTask}
            analysis={analysis}
            onClose={() => setSelectedTask(null)}
          />
        </>
      )}
    </div>
  )
}