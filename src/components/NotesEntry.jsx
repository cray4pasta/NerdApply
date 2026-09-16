import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import Icon from './ui/Icon.jsx'

const PROMPTS = [
  'Build a list of 15 colleges that offer full ride for design programs',
  'Quiet kid, really into marine biology, needs financial aid, somewhere warm',
  'Wants nursing but may change direction. Family wants driving distance.',
  '1230 SAT, 3.5 GPA, loves programming, nothing too far from home',
]

function promptIntervalMs() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--duration-ph').trim()
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return 3500
  return raw.endsWith('ms') ? n : n * 1000
}

export default function NotesEntry({ onSend, disabled }) {
  const [draft, setDraft] = useState('')
  const [tick, setTick] = useState(0)
  const ref = useRef(null)
  const hasText = draft.trim().length > 0

  useEffect(() => {
    if (hasText) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return undefined
    const id = setInterval(() => setTick((t) => t + 1), promptIntervalMs())
    return () => clearInterval(id)
  }, [hasText])

  useEffect(() => {
    ref.current?.focus()
  }, [])

  function submit() {
    if (disabled || !hasText) return
    onSend(draft)
    setDraft('')
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-chat flex-col items-center">
        <h1 className="text-center font-sans text-28 font-normal text-ink">Who are we helping today?</h1>

        <form
          className="mt-5 w-full max-w-notes-entry rounded-composer border border-rule bg-surface"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label className="sr-only" htmlFor="chat-composer">
            Notes about the student
          </label>
          <div className="relative">
            <textarea
              id="chat-composer"
              ref={ref}
              rows={4}
              disabled={disabled}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              className="h-notes-entry w-full resize-none bg-transparent px-5 pt-5 font-sans text-16 leading-relaxed text-ink focus:outline-none disabled:opacity-40"
            />
            {!hasText && (
              <div
                key={tick}
                aria-hidden="true"
                className="ph-rise pointer-events-none absolute left-5 right-5 top-5 font-sans text-16 leading-relaxed text-ink-3"
              >
                {PROMPTS[tick % PROMPTS.length]}
              </div>
            )}
          </div>

          <div className="flex w-full items-center justify-between px-5 pb-5 pt-4">
            <span className="text-12 text-ink-3">Enter to send · Shift+Enter for a new line</span>

            <span className="flex h-create items-center justify-end gap-2">
              <button type="button" aria-label="Dictate notes" className="inline-flex text-ink-3 hover:text-ink">
                <Icon icon={Mic} size="sm" />
              </button>
              {hasText && (
                <button
                  type="submit"
                  disabled={disabled}
                  className="btn-in inline-flex items-center justify-center rounded-control bg-ink px-4 py-2 text-body-sm font-medium text-surface hover:opacity-90 disabled:opacity-40"
                >
                  Create
                </button>
              )}
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
