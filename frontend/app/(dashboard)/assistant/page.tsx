// app/(dashboard)/assistant/page.tsx
'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useProjectContext } from '@/contexts/ProjectContext'
import { useRouter } from 'next/navigation'
import { queryProject, listUploads } from '@/lib/api'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn, timeAgo } from '@/lib/utils'
import type { QueryResponse, UploadResponse } from '@/types'
import { usePersistedInput } from '@/hooks/usePersistedInput'

interface Message {
  id: string; role: 'user' | 'ai'; content: string
  confidence?: number; evidence?: QueryResponse['evidence']
  missing_data?: string[]; suggested_questions?: string[]; createdAt: string
  // NEW — Phase 19/20 RAG Metadata fields
  memory_context_used?: number; knowledge_entities_found?: number
}
const DEFAULT_QUESTIONS = ['What is causing the current delay?','Which vendor has the highest delay risk?','Can commissioning start in parallel?','What does the critical path look like?']

function EvidenceRow({ ev }: { ev: QueryResponse['evidence'][0] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="cursor-pointer border-b border-[#1F2937] px-3 py-2 last:border-0 hover:bg-[#1F2937]" onClick={() => setOpen(v => !v)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0"><span className="material-symbols-outlined shrink-0 text-sm text-[#6B7280]">description</span><span className="truncate text-xs text-[#3B82F6]">{ev.source_file}{ev.page_number > 0 && ` · p.${ev.page_number}`}</span></div>
        <div className="flex shrink-0 items-center gap-1.5"><span className="font-mono text-[10px] text-[#6B7280]">{Math.round(ev.relevance_score*100)}%</span><span className="material-symbols-outlined text-sm text-[#6B7280]">{open?'expand_less':'expand_more'}</span></div>
      </div>
      {open && <div className="mt-2 rounded border border-[#14B8A6]/30 bg-[#0A0F1E] p-2.5"><p className="font-mono text-[11px] leading-relaxed text-[#dce2f7]">{ev.text}</p></div>}
    </div>
  )
}

function AIMessage({ msg }: { msg: Message }) {
  const [showSources, setShowSources] = useState(false)
  const confPct = msg.confidence ? Math.round(msg.confidence * 100) : null
  const isLowConf = confPct !== null && confPct < 60
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-[#14B8A6]">auto_awesome</span><span className="text-[11px] font-semibold text-[#14B8A6]">AI</span><span className="text-[10px] text-[#6B7280]">{timeAgo(msg.createdAt)}</span></div>
      <div className="rounded-lg border border-[#1F2937] bg-[#111827] px-4 py-3" style={{ borderLeft: '3px solid #14B8A6' }}>
        <p className="text-sm leading-relaxed text-[#dce2f7] whitespace-pre-wrap">{msg.content}</p>
        
        {confPct !== null && (<div className="mt-3"><div className="flex items-center justify-between"><span className="text-[10px] text-[#6B7280]">Confidence</span><span className="text-[10px] font-mono text-[#A855F7]">{confPct}%</span></div><ProgressBar value={confPct} colour="#A855F7" className="mt-1" height={3} /></div>)}
        
        {isLowConf && msg.missing_data && msg.missing_data.length > 0 && (
          <div className="mt-3 rounded border border-[#EAB308]/30 bg-[#EAB308]/10 p-2.5">
            <div className="flex items-start gap-1.5"><span className="material-symbols-outlined text-sm text-[#EAB308]">warning</span><div><p className="text-[11px] font-semibold text-[#EAB308]">Low confidence — more data would help</p>{msg.missing_data.slice(0,2).map((m,i) => <p key={i} className="mt-0.5 text-[11px] text-[#9CA3AF]">→ {m}</p>)}</div></div>
          </div>
        )}

        {/* NEW — Phase 19/20: Knowledge Graph and Memory Badges */}
        {((msg.memory_context_used ?? 0) > 0 || (msg.knowledge_entities_found ?? 0) > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(msg.memory_context_used ?? 0) > 0 && (
              <span className="flex items-center gap-1 rounded bg-[#14B8A6]/10 px-2 py-0.5 text-[10px] text-[#5EEAD4]">
                <span className="material-symbols-outlined text-[11px]">history</span>
                {msg.memory_context_used} past decision{msg.memory_context_used !== 1 ? 's' : ''} referenced
              </span>
            )}
            {(msg.knowledge_entities_found ?? 0) > 0 && (
              <span className="flex items-center gap-1 rounded bg-[#3B82F6]/10 px-2 py-0.5 text-[10px] text-[#93C5FD]">
                <span className="material-symbols-outlined text-[11px]">hub</span>
                {msg.knowledge_entities_found} graph entit{msg.knowledge_entities_found !== 1 ? 'ies' : 'y'} linked
              </span>
            )}
          </div>
        )}

        {msg.evidence && msg.evidence.length > 0 && (
          <div className="mt-3 border-t border-[#1F2937] pt-2">
            <button onClick={() => setShowSources(v => !v)} className="flex items-center gap-1.5 text-[11px] text-[#3B82F6] hover:underline">
              <span className="material-symbols-outlined text-sm">attach_file</span>{msg.evidence.length} source{msg.evidence.length !== 1 ? 's' : ''} used<span className="material-symbols-outlined text-sm">{showSources?'expand_less':'expand_more'}</span>
            </button>
            {showSources && <div className="mt-2 overflow-hidden rounded-md border border-[#374151] bg-[#0A0F1E]">{msg.evidence.map((ev,i) => <EvidenceRow key={i} ev={ev} />)}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

function UserMessage({ msg }: { msg: Message }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5"><span className="text-[10px] text-[#6B7280]">{timeAgo(msg.createdAt)}</span><span className="text-[11px] font-semibold text-[#9CA3AF]">YOU</span></div>
      <div className="max-w-[80%] rounded-lg bg-[#1F2937] px-4 py-3" style={{ borderRadius: '12px 12px 2px 12px' }}><p className="text-sm text-[#dce2f7]">{msg.content}</p></div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-[#14B8A6]">auto_awesome</span><span className="text-[11px] font-semibold text-[#14B8A6]">AI</span></div>
      <div className="w-16 rounded-lg border border-[#1F2937] bg-[#111827] px-4 py-3" style={{ borderLeft: '3px solid #14B8A6' }}>
        <div className="flex items-center gap-1">{[0,150,300].map(d => <span key={d} className="h-2 w-2 rounded-full bg-[#14B8A6]" style={{ animation: `pulse_dot 1.2s ease-in-out ${d}ms infinite` }} />)}</div>
      </div>
    </div>
  )
}

export default function AssistantPage() {
  const router = useRouter()
  const { activeProject } = useProjectContext()
  const [messages, setMessages] = useState<Message[]>([])
  const { value: input, setValue: setInput, clear: clearInput } = usePersistedInput('assistant-draft')
  const [isTyping, setIsTyping] = useState(false)
  const [uploads, setUploads] = useState<UploadResponse[]>([])
  const [showContext, setShowContext] = useState(false)
  const [suggestedQ, setSuggestedQ] = useState<string[]>(DEFAULT_QUESTIONS)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!activeProject) return
    listUploads(activeProject.id).then(({ data }) => { if (data) setUploads(data.filter(u => u.status === 'indexed')) })
  }, [activeProject])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isTyping])

  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || !activeProject || isTyping) return
    const userMsg: Message = { id: Math.random().toString(36).slice(2), role: 'user', content: question.trim(), createdAt: new Date().toISOString() }
    
    // FIXED: Using clearInput() here clears the localStorage cache on real submit
    setMessages(prev => [...prev, userMsg]); clearInput(); setIsTyping(true)
    
    const { data, error } = await queryProject({ project_id: activeProject.id, question: question.trim() })
    setIsTyping(false)
    if (error || !data) { setMessages(prev => [...prev, { id: Math.random().toString(36).slice(2), role: 'ai', content: error || 'Could not process that question. Please try again.', createdAt: new Date().toISOString() }]); return }
    
    // MODIFIED: Capturing the new metadata fields to render the RAG/Memory badges
    setMessages(prev => [...prev, { 
      id: Math.random().toString(36).slice(2), 
      role: 'ai', 
      content: data.answer, 
      confidence: data.confidence, 
      evidence: data.evidence, 
      missing_data: data.missing_data, 
      suggested_questions: data.suggested_questions, 
      createdAt: new Date().toISOString(),
      memory_context_used: data.memory_context_used,
      knowledge_entities_found: data.knowledge_entities_found
    }])
    if (data.suggested_questions?.length > 0) setSuggestedQ(data.suggested_questions.slice(0, 4))
  }, [activeProject, isTyping, clearInput])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  if (!activeProject) return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="material-symbols-outlined text-4xl text-[#374151]">folder_off</span>
      <p className="text-sm text-white">No project selected</p>
      <button onClick={() => router.push('/dashboard')} className="btn-primary text-sm">Go to Dashboard</button>
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#1F2937] px-4 py-3 lg:px-6">
        <div><h1 className="text-base font-bold text-white lg:text-lg">AI Assistant</h1><p className="text-xs text-[#6B7280]">{activeProject.name}</p></div>
        <div className="flex items-center gap-2">
          <span className="badge-teal rounded-full px-2 py-0.5 text-[10px] font-semibold">⟡ Powered by Gemini</span>
          <button onClick={() => setShowContext(v => !v)} className={cn('flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors', showContext ? 'bg-[#1F2937] text-white' : 'text-[#6B7280] hover:text-white')}><span className="material-symbols-outlined text-sm">folder</span>{uploads.length} docs</button>
        </div>
      </div>

      {showContext && (
        <div className="border-b border-[#1F2937] bg-[#111827] px-4 py-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div><p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Documents Indexed</p><p className="mt-0.5 text-sm font-bold text-white">{uploads.length}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Overall Confidence</p><div className="mt-1 flex items-center gap-2"><ProgressBar value={78} colour="#A855F7" className="w-24" height={4} /><span className="text-xs text-[#A855F7]">78%</span></div></div>
          </div>
          {uploads.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{uploads.map(u => <span key={u.id} className="flex items-center gap-1 rounded bg-[#1F2937] px-2 py-1 text-[11px] text-[#9CA3AF]"><span className="material-symbols-outlined text-xs text-[#22C55E]">check_circle</span>{u.filename}</span>)}</div>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#14B8A6]/15 border border-[#14B8A6]/30"><span className="material-symbols-outlined text-2xl text-[#14B8A6]">auto_awesome</span></div>
            <div><p className="text-base font-semibold text-white">Ask anything about {activeProject.name}</p><p className="mt-1 text-xs text-[#6B7280]">I search your uploaded documents and explain my reasoning</p></div>
          </div>
        )}
        <div className="flex flex-col gap-5">
          {messages.map(msg => msg.role === 'user' ? <UserMessage key={msg.id} msg={msg} /> : <AIMessage key={msg.id} msg={msg} />)}
          {isTyping && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-[#1F2937] px-4 py-2 lg:px-6">
        <p className="mb-2 text-[10px] text-[#6B7280]">Based on your project:</p>
        <div className="flex flex-wrap gap-2">
          {suggestedQ.map((q, i) => <button key={i} onClick={() => sendMessage(q)} disabled={isTyping} className="rounded-full border border-[#374151] bg-[#1F2937] px-3 py-1.5 text-xs text-white transition-colors hover:border-[#3B82F6] hover:bg-[#3B82F6]/10 disabled:opacity-40">{q}</button>)}
        </div>
      </div>

      <div className="border-t border-[#1F2937] px-4 py-3 lg:px-6">
        <div className="flex items-end gap-2">
          {/* BUG FIX 8: onInput auto-resizes textarea */}
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 128)}px` }}
            placeholder={`Ask anything about ${activeProject.name}...`} rows={1} disabled={isTyping}
            className="input-dark flex-1 resize-none max-h-32 min-h-[44px] py-3 leading-relaxed"
            style={{ scrollbarWidth: 'none', height: '44px', overflow: 'hidden' }} />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping} className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors', input.trim() && !isTyping ? 'bg-[#3B82F6] text-white hover:bg-[#2563EB]' : 'bg-[#374151] text-[#6B7280]')}><span className="material-symbols-outlined text-xl">send</span></button>
        </div>
        <p className="mt-1.5 text-[10px] text-[#6B7280]">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}