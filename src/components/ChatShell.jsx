import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import Icon from './ui/Icon.jsx'
import { SAMPLE_A, SAMPLE_B, SAMPLE_SHORT } from '../lib/samples.js'
import CaseloadSidebar from './CaseloadSidebar.jsx'

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

function Composer({ draft, setDraft, onSend, disabled, placeholder, autoFocus }) {
  const ref = useRef(null)

  useEffect(() => {
    resizeComposer(ref.current)
  }, [draft])

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  function submit() {
    if (disabled || !draft.trim()) return
    onSend(draft)
    setDraft('')
  }

  return (
    <form
      className="rounded-composer border border-rule bg-surface focus-within:border-brand"
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
        className="max-h-composer w-full resize-none bg-transparent px-4 pt-4 font-sans text-15 leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none disabled:opacity-40"
      />
      <div className="flex items-center justify-between px-3 pb-3">
        <span className="text-12 text-ink-3">Enter to send · Shift+Enter for a new line</span>
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          className="inline-flex items-center gap-1 rounded-control bg-brand px-4 py-2 text-body-sm font-medium text-surface hover:bg-brand-hover disabled:opacity-40"
        >
          <Icon icon={ArrowUp} size="sm" />
          Send
        </button>
      </div>
    </form>
  )
}

function MessageBlock({ message, children }) {
  const isYou = message.role === 'user'
  return (
    <article className="mb-8">
      <p className="text-12 font-medium uppercase tracking-label text-ink-3">{isYou ? 'You' : 'List builder'}</p>
      {message.text && message.card !== 'status' && (
        <p
          className={`mt-2 whitespace-pre-wrap font-sans text-15 leading-relaxed ${
            message.tone === 'flag' ? 'text-flag' : isYou ? 'text-ink' : 'text-ink-2'
          }`}
        >
          {message.text}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </article>
  )
}

export default function ChatShell({
  sidebarWidth,
  onSidebarWidth,
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
  progressIndex,
  onSend,
  renderCard,
}) {
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)
  const empty = messages.length === 0
  const busy = phase === 'extracting' || phase === 'generating'

  useEffect(() => {
    setDraft('')
  }, [activeId])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    endRef.current?.scrollIntoView({ block: 'end', behavior: reduce ? 'auto' : 'smooth' })
  }, [messages.length, phase, progressIndex])

  const liveStatus = [...messages].reverse().find((m) => m.card === 'status')
  const placeholder =
    liveStatus?.text
      ? `${liveStatus.text}…`
      : phase === 'extracting'
        ? 'Reading the student profile…'
        : phase === 'generating'
          ? 'Building the list…'
          : phase === 'criteria'
          ? 'Edit the table above, or type continue'
          : phase === 'priorities'
            ? 'Reorder above, or type build'
            : phase === 'list'
              ? 'Edit the list above, or open another student from a school folder'
              : 'Paste what you know — grades, interests, distance, budget…'

  const composer = (
    <Composer
      draft={draft}
      setDraft={setDraft}
      onSend={onSend}
      disabled={busy}
      placeholder={placeholder}
      autoFocus
    />
  )

  const samples = (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {[SAMPLE_A, SAMPLE_B, SAMPLE_SHORT].map((sample) => (
        <button
          key={sample.label}
          type="button"
          disabled={busy}
          className="rounded-control border border-rule bg-surface px-3 py-2 text-12 text-ink-2 hover:border-ink-3 hover:text-ink disabled:opacity-40"
          onClick={() => onSend(sample.notes)}
        >
          {sample.label}
        </button>
      ))}
    </div>
  )

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

  return (
    <div
      className="flex h-full overflow-hidden bg-paper"
      style={sidebarWidth != null ? { ['--history-width']: `${sidebarWidth}px` } : undefined}
    >
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
      />
      <button
        type="button"
        aria-label="Resize the caseload column"
        className="history-resize shrink-0 self-stretch border-0 p-0"
        onPointerDown={onResizePointerDown}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6">
            <div className="w-full max-w-chat">
              <h1 className="mb-8 text-center font-sans text-28 font-normal text-ink">Tell me about the student</h1>
              <p className="mb-6 text-center font-sans text-15 text-ink-2">
                Paste the file in your own words. I will extract criteria for you to confirm before any school is chosen.
              </p>
              {composer}
              {samples}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex min-h-0 w-full max-w-chat flex-1 flex-col px-6">
            <div className="min-h-0 flex-1 overflow-y-auto py-8">
              {messages.map((message) => (
                <MessageBlock key={message.id} message={message}>
                  {message.card ? renderCard(message) : null}
                </MessageBlock>
              ))}
              <div ref={endRef} />
            </div>
            <div className="shrink-0 pb-6 pt-2">{composer}</div>
          </div>
        )}
      </main>
    </div>
  )
}
