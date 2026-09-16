import { useEffect, useRef, useState } from 'react'
import { PanelLeftOpen } from 'lucide-react'
import Icon from './ui/Icon.jsx'
import CaseloadSidebar from './CaseloadSidebar.jsx'
import NotesEntry from './NotesEntry.jsx'
import PrioritiesCard from './PrioritiesCard.jsx'
import BuildProgress from './BuildProgress.jsx'
import BasisCard from './BasisCard.jsx'
import ListTable, { useColumns, useRows } from './ListTable.jsx'
import PrintPreview from './PrintPreview.jsx'
import { buildStages, listSizeFrom, programLabelFrom } from '../lib/listRows.js'

function resizeComposer(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function tokenPx(name) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

function tokenDurationMs(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return fallback
  if (raw.endsWith('ms')) return n
  if (raw.endsWith('s')) return n * 1000
  return n
}

function scrollThreadTo(el, to, ms) {
  const dest = Math.max(0, to)
  const from = el.scrollTop
  if (Math.abs(dest - from) < 1) return () => {}
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.scrollTop = dest
    return () => {}
  }
  let raf = 0
  const start = performance.now()
  const dist = dest - from
  function frame(now) {
    const t = Math.min(1, (now - start) / ms)
    el.scrollTop = from + dist * (1 - (1 - t) ** 3)
    if (t < 1) raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}

function Composer({ draft, setDraft, onSend, disabled, placeholder, autoFocus, caretNonce, dimmed }) {
  const ref = useRef(null)
  const hasText = draft.trim().length > 0

  useEffect(() => {
    resizeComposer(ref.current)
  }, [draft])

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    if (!caretNonce || !ref.current) return
    const el = ref.current
    el.focus()
    const n = el.value.length
    el.setSelectionRange(n, n)
  }, [caretNonce, draft])

  function submit() {
    if (disabled || !draft.trim()) return
    onSend(draft)
    setDraft('')
  }

  return (
    <form
      className={`rounded-composer border border-rule bg-surface ${dimmed ? 'pointer-events-none opacity-dimmed' : ''}`}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label className="sr-only" htmlFor="chat-composer">
        Message
      </label>
      <textarea
        id="chat-composer"
        ref={ref}
        rows={1}
        disabled={disabled}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        className={`max-h-composer w-full resize-none bg-transparent px-5 pt-4 font-sans text-15 leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none ${dimmed ? 'disabled:opacity-100' : 'disabled:opacity-40'}`}
      />
      <div className="flex items-center justify-between px-5 pb-4 pt-4">
        <span className="text-12 text-ink-3">Enter to send · Shift+Enter for a new line</span>
        <span className="flex h-create items-center justify-end">
          {hasText && (
            <button
              type="submit"
              disabled={disabled}
              className="btn-in inline-flex items-center justify-center rounded-control bg-ink px-4 py-2 text-body-sm font-medium text-surface hover:opacity-90 disabled:opacity-40"
            >
              Send
            </button>
          )}
        </span>
      </div>
    </form>
  )
}

function SettledLine({ text, actionLabel = 'Reopen', onReopen }) {
  return (
    <article className="mb-8">
      <p className="text-12 font-medium uppercase tracking-label text-ink-3">List builder</p>
      <div className="mt-2 flex items-baseline gap-4 border-b border-rule pb-4">
        <p className="m-0 flex-1 text-15 leading-relaxed text-ink-2">{text}</p>
        <button type="button" onClick={onReopen} className="text-14 text-ink">
          {actionLabel}
        </button>
      </div>
    </article>
  )
}

function MessageBlock({ message }) {
  const isYou = message.role === 'user'
  if (message.card === 'status') {
    return (
      <article className="mb-8">
        <p className="text-12 font-medium uppercase tracking-label text-ink-3">List builder</p>
        <p className="pulse-dim mt-2 font-sans text-15 leading-relaxed text-ink-2">{message.text}…</p>
      </article>
    )
  }
  if (isYou) {
    return (
      <article className="mb-8 ml-auto w-full max-w-you">
        <p className="text-right text-12 font-medium uppercase tracking-label text-ink-3">You</p>
        {message.text && (
          <p className="mt-2 whitespace-pre-wrap text-right font-sans text-15 leading-relaxed text-ink">{message.text}</p>
        )}
      </article>
    )
  }
  return (
    <article className="mb-8">
      <p className="text-12 font-medium uppercase tracking-label text-ink-3">List builder</p>
      {message.text && (
        <p className={`mt-2 whitespace-pre-wrap font-sans text-15 leading-relaxed ${message.tone === 'flag' ? 'text-flag' : 'text-ink-2'}`}>
          {message.text}
        </p>
      )}
    </article>
  )
}

function skipCard(message, phase) {
  if (message.card === 'criteria' || message.card === 'priorities' || message.card === 'list') return true
  if (message.card === 'status' && phase !== 'extracting') return true
  return false
}

export default function ChatShell({
  sidebarWidth,
  onSidebarWidth,
  sidebarCollapsed,
  onSidebarCollapsed,
  conversations,
  schools,
  activeId,
  query,
  onQuery,
  onSelectConversation,
  onNewConversation,
  onNewSchool,
  onRenameSchool,
  onToggleSchool,
  onMoveStudent,
  onDeleteStudent,
  onDeleteSchool,
  messages,
  phase,
  onSend,
  dockedCard,
  listSettings,
  criteriaSummary,
  criteria = [],
  academic = {},
  generatedList = [],
  extras = { columnLibrary: [], studentColumns: [] },
  studentName = 'Student',
  schoolLabel,
  removedSchoolIds,
  studentCopy,
  onStudentCopy,
  listSent,
  onMarkSent,
  onBuildList,
  onBuildDone,
  onReopenCriteria,
  onReopenPriorities,
  onPrioritiesDraft,
  onRebuild,
  editingPriorities = false,
  pendingColumn = null,
  onConsumeColumn,
  followupBusy = false,
}) {
  const [draft, setDraft] = useState('')
  const [caretNonce, setCaretNonce] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const threadRef = useRef(null)
  const listTopRef = useRef(null)
  const prevPhase = useRef(phase)
  const empty = messages.length === 0
  const settings = listSettings
  const removed = removedSchoolIds ?? []
  const extraCols = extras ?? { columnLibrary: [], studentColumns: [] }
  const programLabel = programLabelFrom(criteria)
  const cols = useColumns({
    studentCopy,
    resetKey: `${activeId}:${(generatedList ?? []).map((s) => s.id).join(',')}:${(settings?.order ?? []).join(',')}`,
    columnLibrary: extraCols.columnLibrary,
    studentColumns: extraCols.studentColumns,
    priorityOrder: settings?.order,
    incoming: pendingColumn,
    onIncomingConsumed: onConsumeColumn,
  })
  const rows = useRows({ schools: generatedList ?? [], maxOop: settings?.maxOop ?? '$25,000', removed })

  useEffect(() => {
    setDraft('')
  }, [activeId, phase])

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    if (phase === 'list') {
      prevPhase.current = phase
      return
    }
    const edge = tokenPx('--scroll-edge') ?? 80
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < edge
    if (prevPhase.current !== phase || atBottom) el.scrollTop = el.scrollHeight
    prevPhase.current = phase
  })

  useEffect(() => {
    if (phase !== 'list') return undefined
    const el = threadRef.current
    const target = listTopRef.current
    if (!el || !target) return undefined
    const ms = tokenDurationMs('--duration-scroll', 560)
    let stop = () => {}
    const raf = requestAnimationFrame(() => {
      const dest = el.scrollTop + target.getBoundingClientRect().top - el.getBoundingClientRect().top
      stop = scrollThreadTo(el, dest, ms)
    })
    return () => {
      cancelAnimationFrame(raf)
      stop()
    }
  }, [phase, activeId])

  useEffect(() => {
    if (phase !== 'list') setPreviewOpen(false)
  }, [phase])

  const placeholder = {
    extracting: 'Reading the student profile…',
    criteria: 'Start typing...',
    priorities: 'Start typing...',
    building: 'Building…',
    list: followupBusy ? 'Looking that up…' : 'Ask a follow-up, add a column, or rebuild with different priorities…',
  }[phase] ?? 'Paste what you know — grades, interests, distance, budget…'

  const head = messages.filter((m) => m.chapter !== 'list' && !skipCard(m, phase))
  const tail = messages.filter((m) => m.chapter === 'list' && !skipCard(m, phase))

  useEffect(() => {
    if (phase !== 'list' || tail.length === 0) return undefined
    const el = threadRef.current
    if (!el) return undefined
    el.scrollTop = el.scrollHeight
    return undefined
  }, [phase, tail.length])

  function ask(school, text) {
    setDraft('')
    onSend(`${school.name} — ${text}`)
  }

  function onResizePointerDown(e) {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarWidth ?? tokenPx('--width-history')
    const min = tokenPx('--width-history-min')
    const max = tokenPx('--width-history-max')
    if (startW == null || min == null || max == null) return
    document.body.classList.add('is-resizing-history')

    function move(ev) {
      const next = Math.min(max, Math.max(min, startW + ev.clientX - startX))
      onSidebarWidth(next)
    }

    function up() {
      document.body.classList.remove('is-resizing-history')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const reading = phase === 'extracting' || phase === 'criteria'

  return (
    <div
      className="flex h-full overflow-hidden bg-paper"
      style={sidebarWidth != null ? { ['--history-width']: `${sidebarWidth}px` } : undefined}
    >
      {sidebarCollapsed ? (
        <button
          type="button"
          aria-label="Show the caseload column"
          className="shrink-0 self-start p-2 text-ink-3 hover:text-ink"
          onClick={() => onSidebarCollapsed(false)}
        >
          <Icon icon={PanelLeftOpen} size="sm" />
        </button>
      ) : (
        <>
          <CaseloadSidebar
            schools={schools}
            conversations={conversations}
            activeId={activeId}
            query={query}
            onQuery={onQuery}
            onSelectStudent={onSelectConversation}
            onNewStudent={onNewConversation}
            onNewSchool={onNewSchool}
            onRenameSchool={onRenameSchool}
            onToggleSchool={onToggleSchool}
            onMoveStudent={onMoveStudent}
            onDeleteStudent={onDeleteStudent}
            onDeleteSchool={onDeleteSchool}
            onCollapse={() => onSidebarCollapsed(true)}
          />
          <button
            type="button"
            aria-label="Resize the caseload column"
            className="history-resize shrink-0 self-stretch border-0 p-0"
            onPointerDown={onResizePointerDown}
          />
        </>
      )}

      <main className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {empty ? (
          <NotesEntry onSend={onSend} disabled={false} />
        ) : (
          <>
          <div
            className={`flex min-h-0 flex-1 flex-col ${previewOpen ? 'invisible pointer-events-none no-print' : ''}`}
            aria-hidden={previewOpen || undefined}
          >
            <div ref={threadRef} className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-8">
              <div className="w-full max-w-notes-entry">
                {head.map((message) => (
                  <MessageBlock key={message.id} message={message} />
                ))}

                {!reading && <SettledLine text={`Criteria settled — ${criteriaSummary}`} onReopen={onReopenCriteria} />}

                {phase === 'priorities' && (
                  <article className="mb-8">
                    <p className="text-12 font-medium uppercase tracking-label text-ink-3">List builder</p>
                    <p className="mt-2 text-15 leading-relaxed text-ink-2">
                      Two things decide the order before I search. Rank what matters most for this student, and confirm the
                      money and distance facts I will label every school against.
                    </p>
                  </article>
                )}

                {(phase === 'building' || phase === 'list') && settings && (
                  <SettledLine
                    text={`Priorities settled — ${settings.order[0].toLowerCase()} first, then ${settings.order[1].toLowerCase()}${settings.homeState ? ` · ${settings.homeState}` : ''} · under ${settings.maxOop} a year`}
                    actionLabel={editingPriorities ? 'Close' : 'Revise'}
                    onReopen={onReopenPriorities}
                  />
                )}

                {phase === 'building' && (
                  <BuildProgress
                    key={activeId}
                    onDone={onBuildDone}
                    stages={buildStages(programLabel, settings?.listSize ?? listSizeFrom({ criteria }))}
                  />
                )}

                {phase === 'list' && settings && (
                  <article className="mb-8">
                    <p className="text-12 font-medium uppercase tracking-label text-ink-3">List builder</p>
                    <p className="mt-2 text-15 leading-relaxed text-ink-2">
                      Here is the list. Admissions and affordability are separate labels — a reach can still be affordable.
                      Remove a school and the balance updates.
                    </p>
                    <div className="mt-4">
                      <BasisCard
                        rows={rows}
                        priorities={settings.order}
                        homeState={settings.homeState}
                        incomeBand={settings.incomeBand}
                        maxOop={settings.maxOop}
                        programLabel={programLabel}
                        academic={academic}
                        onRebuild={onRebuild}
                      />
                    </div>
                  </article>
                )}
              </div>

              {phase === 'list' && (
                <div ref={listTopRef} className="mt-4 w-full">
                  <ListTable
                    rows={rows}
                    cols={cols}
                    studentCopy={studentCopy}
                    onToggleCopy={onStudentCopy}
                    onAsk={ask}
                    onPreview={() => setPreviewOpen(true)}
                  />
                </div>
              )}

              {(tail.length > 0 || listSent) && (
                <div className="mt-8 w-full max-w-notes-entry">
                  {tail.map((message) => (
                    <MessageBlock key={message.id} message={message} />
                  ))}
                  {listSent && (
                    <SettledLine
                      text={`Sent to ${studentName} · ${rows.length} schools · ${studentCopy ? 'student' : 'counselor'} copy`}
                      actionLabel="View"
                      onReopen={() => setPreviewOpen(true)}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-col items-center px-6 pb-6 pt-2">
              <div className="min-h-0 w-full max-w-notes-entry overflow-y-auto">
                {dockedCard}
                {(phase === 'priorities' || (phase === 'list' && editingPriorities)) && (
                  <PrioritiesCard
                    key={`${activeId}:${editingPriorities ? 'revise' : 'first'}`}
                    initial={settings}
                    onDraft={onPrioritiesDraft}
                    onBuild={onBuildList}
                  />
                )}
              </div>
              <div className="w-full max-w-notes-entry shrink-0">
                <Composer
                  draft={draft}
                  setDraft={setDraft}
                  onSend={onSend}
                  disabled={phase === 'extracting' || phase === 'building' || followupBusy}
                  placeholder={placeholder}
                  autoFocus
                  caretNonce={caretNonce}
                  dimmed={phase === 'building' || followupBusy}
                />
              </div>
            </div>
          </div>
          {previewOpen && phase === 'list' && (
            <PrintPreview
              rows={rows}
              cols={cols}
              studentCopy={studentCopy}
              studentName={studentName}
              schoolLabel={schoolLabel}
              programLabel={programLabel}
              academic={academic}
              homeState={settings?.homeState}
              clubs={extraCols.columnLibrary?.filter((c) => /club|robotics|social/i.test(c.label)).map((c) => c.label)}
              onClose={() => setPreviewOpen(false)}
              onPrint={() => {
                onMarkSent()
                window.print()
                setPreviewOpen(false)
              }}
            />
          )}
          </>
        )}
      </main>
    </div>
  )
}
