import { useLayoutEffect, useRef, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import Icon from './ui/Icon.jsx'
import { PROGRAM_CHOICES } from '../lib/extract.js'

const ROW_MS = 260

function blankCriterion() {
  return {
    id: `manual-${crypto.randomUUID()}`,
    category: 'other',
    label: '',
    value: '',
    confidence: 'high',
    source_phrase: '',
    strength: 'preferred',
    understood: '',
  }
}

function withGuess(row) {
  const text = String(row.understood || row.label || '').trim()
  if (!text) return row
  const hit = PROGRAM_CHOICES.find((p) => text.toLowerCase().includes(p.label.toLowerCase()))
  if (hit) return { ...row, category: 'academic_interest', label: hit.label, value: hit.value, understood: row.understood || hit.label }
  return { ...row, label: text, value: row.value || text }
}

function durationMs(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return fallback
  return raw.endsWith('ms') ? n : n * 1000
}

export default function CriteriaCard({ criteria = [], onChange, onNext, pending = 0 }) {
  const [editing, setEditing] = useState(false)
  const [labels, setLabels] = useState({})
  const [phrases, setPhrases] = useState({})
  const [leavingId, setLeavingId] = useState(null)
  const [shown, setShown] = useState(0)
  const [found, setFound] = useState(criteria.length)
  const shownRef = useRef(0)

  const ids = criteria.map((c) => c.id).join('|')

  useLayoutEffect(() => {
    setFound((n) => Math.max(n, criteria.length))
    if (!criteria.length) {
      shownRef.current = 0
      setShown(0)
      return undefined
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      shownRef.current = criteria.length
      setShown(criteria.length)
      return undefined
    }
    let i = shownRef.current
    if (i >= criteria.length) {
      shownRef.current = criteria.length
      setShown(criteria.length)
      return undefined
    }
    if (i <= 0) {
      i = 1
      shownRef.current = 1
      setShown(1)
    }
    if (i >= criteria.length) return undefined
    const step = durationMs('--duration-row-in', ROW_MS)
    const id = setInterval(() => {
      i += 1
      shownRef.current = i
      setShown(i)
      if (i >= criteria.length) clearInterval(id)
    }, step)
    return () => clearInterval(id)
  }, [ids])

  const visible = criteria.slice(0, Math.max(shown, 0))
  const remaining = criteria.length
  const skeletons = Math.max(0, Math.max(pending, remaining) - visible.length)
  const foundCount = Math.max(found, remaining)
  const visibleCount = Math.min(shown, remaining)
  const footer =
    pending && remaining === 0
      ? 'Finding criteria…'
      : visibleCount < remaining
        ? `${visibleCount} of ${foundCount} criteria found`
        : remaining === foundCount || foundCount === 0
          ? `${remaining} of ${foundCount} criteria found`
          : `${remaining} criteria kept`

  function remove(id) {
    if (leavingId || !onChange) return
    setLeavingId(id)
    const wait = durationMs('--duration-row-out', 320)
    setTimeout(() => {
      setLeavingId(null)
      onChange(criteria.filter((c) => c.id !== id))
    }, wait)
  }

  function addCriterion() {
    if (!onChange) return
    const next = [...criteria, blankCriterion()]
    shownRef.current = next.length
    setShown(next.length)
    setFound((n) => Math.max(n, next.length))
    setEditing(true)
    onChange(next)
  }

  function save() {
    setEditing(false)
    if (!onChange) return
    onChange(
      criteria
        .map((c) => {
          const understood = labels[c.id] ?? c.understood ?? c.label ?? ''
          const phrase = phrases[c.id] ?? c.source_phrase ?? ''
          return withGuess({ ...c, understood, label: understood || c.label, source_phrase: phrase || null })
        })
        .filter((c) => String(c.understood || c.label || '').trim())
    )
    setLabels({})
    setPhrases({})
  }

  return (
    <div className="card-in mb-dock w-full max-w-notes-entry rounded-control border border-rule bg-surface p-5">
      <div className="flex items-center gap-4 border-b border-rule pb-4 text-12 font-medium uppercase tracking-label text-ink-3">
        <span className="w-phrase shrink-0">From this phrase</span>
        <span className="flex flex-1 items-center gap-2">
          What I understood
          {onChange && (
            <button
              type="button"
              aria-label="Edit the criteria"
              onClick={() => setEditing((v) => !v)}
              className={editing ? 'inline-flex text-ink' : 'inline-flex text-ink-3 hover:text-ink'}
            >
              <Icon icon={Pencil} size="pencil" />
            </button>
          )}
        </span>
        <span className="w-actions shrink-0" />
      </div>

      {visible.map((c) => {
        const leaving = c.id === leavingId
        const understood = labels[c.id] ?? c.understood ?? c.label ?? ''
        const phrase = phrases[c.id] ?? c.source_phrase ?? c.phrase ?? ''
        const added = String(c.id).startsWith('manual-')
        const phraseOpen = editing && !leaving && (added || !c.source_phrase)
        return (
          <div
            key={c.id}
            data-criteria-row=""
            className={`${leaving ? 'row-out' : 'row-in'} flex items-baseline gap-4 border-b border-rule py-4`}
          >
            {phraseOpen ? (
              <input
                type="text"
                value={phrase}
                placeholder="From this phrase"
                onChange={(e) => setPhrases((m) => ({ ...m, [c.id]: e.target.value }))}
                className="w-phrase shrink-0 rounded-control border border-rule bg-surface p-2 font-sans text-body-sm text-ink focus:outline-none"
              />
            ) : (
              <span className="w-phrase shrink-0 font-sans text-body-sm text-ink-2">{phrase || '—'}</span>
            )}
            {editing && !leaving ? (
              <input
                type="text"
                value={understood}
                placeholder="What I understood"
                onChange={(e) => setLabels((m) => ({ ...m, [c.id]: e.target.value }))}
                className="min-w-0 flex-1 rounded-control border border-rule bg-surface p-2 text-15 text-ink focus:outline-none"
              />
            ) : (
              <span className="flex-1 font-sans text-15 text-ink">{understood || '—'}</span>
            )}
            <span className="flex w-actions shrink-0 items-center justify-end">
              {onChange && !leaving && (
                <button
                  type="button"
                  aria-label={`Remove ${understood || c.label}`}
                  onClick={() => remove(c.id)}
                  className="inline-flex text-ink-3 hover:text-ink"
                >
                  <Icon icon={Trash2} size="sm" />
                </button>
              )}
            </span>
          </div>
        )
      })}

      {Array.from({ length: skeletons }, (_, i) => (
        <div key={`sk-${i}`} className="flex items-center gap-4 border-b border-rule py-4">
          <span className="h-3 w-phrase shrink-0 rounded-control bg-paper" />
          <span className="h-3 flex-1 rounded-control bg-paper" />
          <span className="w-actions shrink-0" />
        </div>
      ))}

      {onChange && !pending && (
        <button
          type="button"
          onClick={addCriterion}
          className="mt-4 inline-flex items-center gap-2 font-sans text-body-sm text-ink-2 hover:text-ink"
        >
          <Icon icon={Plus} size="sm" />
          Add a criterion
        </button>
      )}

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="font-sans text-body-sm text-ink-3">{footer}</p>
        <span className="flex items-center gap-4">
          {editing && (
            <button type="button" onClick={save} className="btn-in font-sans text-body-sm font-medium text-ink">
              Save
            </button>
          )}
          {onNext && !editing && (
            <button
              type="button"
              onClick={onNext}
              className="rounded-control bg-ink px-4 py-2 font-sans text-body-sm font-medium text-surface hover:opacity-90"
            >
              Next
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
