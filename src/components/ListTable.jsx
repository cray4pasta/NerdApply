import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X } from 'lucide-react'
import Icon from './ui/Icon.jsx'
import { decorateRows, priorityKeys } from '../lib/listRows.js'

const NAME_COL = { id: 'name', label: 'College', minWidth: 'var(--col-list-name)', printWidth: 'auto', short: true }
const RATE_COL = { id: 'rate', label: 'Admit rate', minWidth: 'var(--col-list-rate)', printWidth: 'var(--print-col-rate)', short: true }
const RATIONALE_COL = {
  id: 'rationale',
  label: 'Why it is here',
  minWidth: 'var(--col-list-rationale)',
  printWidth: 'var(--print-col-rationale)',
  short: false,
}

const PRIORITY_COLUMNS = {
  affordability: { id: 'cost', label: 'Est. cost', minWidth: 'var(--col-list-cost)', printWidth: 'var(--print-col-cost)', short: true },
  program: { id: 'program', label: 'Programme', minWidth: 'var(--col-list-extra)', printWidth: 'var(--print-col-extra)', short: true },
  proximity: { id: 'distance', label: 'Distance', minWidth: 'var(--col-list-distance)', printWidth: 'var(--print-col-distance)', short: true },
  admissions_realism: { id: 'band', label: 'Admissions', minWidth: 'var(--col-list-band)', printWidth: 'var(--print-col-band)', short: true },
  environment: { id: 'environment', label: 'Campus', minWidth: 'var(--col-list-extra)', printWidth: 'var(--print-col-extra)', short: true },
  support: { id: 'support', label: 'Support', minWidth: 'var(--col-list-extra)', printWidth: 'var(--print-col-extra)', short: true },
}

function columnsForPriorities(order) {
  const dims = priorityKeys(order)
  const top = dims.slice(0, 3).map((dim) => PRIORITY_COLUMNS[dim]).filter(Boolean)
  const rest = dims.slice(3).map((dim) => PRIORITY_COLUMNS[dim]).filter(Boolean)
  return { base: [NAME_COL, ...top, RATE_COL, RATIONALE_COL], leftover: rest }
}

function isLocked(col, studentCopy) {
  if (col?.id === 'rate') return true
  return Boolean(studentCopy && col?.id === 'name')
}

function lookupMs() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--duration-lookup').trim()
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return 1400
  return raw.endsWith('ms') ? n : n * 1000
}

export function useColumns({
  studentCopy,
  resetKey,
  columnLibrary = [],
  studentColumns = [],
  priorityOrder,
  incoming,
  onIncomingConsumed,
}) {
  const [hiddenBase, setHiddenBase] = useState([])
  const [added, setAdded] = useState([])
  const [droppedStudent, setDroppedStudent] = useState([])
  const [pending, setPending] = useState(null)
  const orderKey = (priorityOrder ?? []).join('|')
  const { base, leftover } = useMemo(() => columnsForPriorities(priorityOrder), [orderKey])

  useEffect(() => {
    setHiddenBase([])
    setAdded([])
    setDroppedStudent([])
    setPending(null)
  }, [resetKey])

  function addColumn(spec) {
    const col = spec.id ? spec : { id: `c${Date.now()}`, label: spec.label, prompt: spec.prompt, values: {} }
    if (base.some((c) => c.id === col.id)) {
      setHiddenBase((p) => p.filter((x) => x !== col.id))
      return
    }
    setAdded((prev) => (prev.some((c) => c.id === col.id) ? prev : [...prev, col]))
    if (!col.values) return
    setPending(col.id)
    const wait = lookupMs()
    setTimeout(() => setPending((p) => (p === col.id ? null : p)), wait)
  }

  useEffect(() => {
    if (!incoming) return undefined
    addColumn(incoming)
    const t = window.setTimeout(() => onIncomingConsumed?.(), 0)
    return () => window.clearTimeout(t)
  }, [incoming])

  const studentCols = studentCopy
    ? studentColumns.filter((c) => !droppedStudent.includes(c.id) && !added.some((a) => a.id === c.id))
    : []
  const extras = [...studentCols, ...added]
  if (incoming && !extras.some((c) => c.id === incoming.id) && !base.some((c) => c.id === incoming.id)) {
    extras.push(incoming)
  }
  const bases = base.filter((c) => isLocked(c, studentCopy) || !hiddenBase.includes(c.id))
  const visibleIds = new Set([...bases, ...extras].map((c) => c.id))

  function removeColumn(col) {
    if (isLocked(col, studentCopy)) return
    if (base.some((c) => c.id === col.id)) setHiddenBase((p) => [...p, col.id])
    else if (studentColumns.some((c) => c.id === col.id)) setDroppedStudent((p) => [...p, col.id])
    else setAdded((p) => p.filter((c) => c.id !== col.id))
  }

  const suggestions = [
    ...base.filter((c) => hiddenBase.includes(c.id) && !isLocked(c, studentCopy)).map((c) => ({
      text: `Put back “${c.label}”`,
      onPick: () => setHiddenBase((p) => p.filter((x) => x !== c.id)),
    })),
    ...(studentCopy
      ? studentColumns.filter((c) => droppedStudent.includes(c.id)).map((c) => ({
          text: `Put back “${c.label}”`,
          onPick: () => setDroppedStudent((p) => p.filter((x) => x !== c.id)),
        }))
      : []),
    ...leftover.filter((c) => !visibleIds.has(c.id)).map((c) => ({
      text: `Add “${c.label}”`,
      onPick: () => addColumn(c),
    })),
    ...columnLibrary.filter((c) => !visibleIds.has(c.id)).map((c) => ({
      text: c.prompt,
      onPick: () => addColumn(c),
    })),
  ]

  return { bases, extras, columns: [...bases, ...extras], pending, addColumn, removeColumn, suggestions }
}

export function useRows({ schools, maxOop, removed }) {
  return useMemo(() => decorateRows(schools, maxOop, removed ?? []), [schools, maxOop, removed])
}

function extraCellColor(pending, col, schoolId) {
  if (pending === col.id) return 'var(--ink-3)'
  return col.values?.[schoolId] ? 'var(--ink-2)' : 'var(--band-reach)'
}

function menuStyle(anchor, kind) {
  if (!anchor) return { display: 'none' }
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (kind === 'add') {
    return { position: 'fixed', right: vw - anchor.right, top: anchor.bottom, zIndex: 'var(--z-menu)' }
  }
  if (kind === 'ask-bottom') {
    return {
      position: 'fixed',
      right: vw - anchor.left,
      bottom: vh - anchor.bottom,
      zIndex: 'var(--z-ask)',
    }
  }
  return {
    position: 'fixed',
    right: vw - anchor.left,
    top: anchor.top,
    zIndex: 'var(--z-ask)',
  }
}

export default function ListTable({ rows, cols, studentCopy, onToggleCopy, onAsk, onPreview }) {
  const [askOpen, setAskOpen] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuBox, setMenuBox] = useState(null)
  const [askBox, setAskBox] = useState(null)
  const addRef = useRef(null)
  const askRefs = useRef({})
  const cellPad = 'px-6 py-4'

  useLayoutEffect(() => {
    function sync() {
      if (menuOpen && addRef.current) setMenuBox(addRef.current.getBoundingClientRect())
      else if (!menuOpen) setMenuBox(null)
      if (askOpen) {
        const el = askRefs.current[askOpen]
        setAskBox(el ? el.getBoundingClientRect() : null)
      } else setAskBox(null)
    }
    sync()
    if (!menuOpen && !askOpen) return undefined
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [menuOpen, askOpen, rows])

  return (
    <>
      <div className="card-in-lg relative overflow-x-auto rounded-lg border border-rule bg-surface">
        <table className="w-full table-auto border-separate border-spacing-0 text-15">
          <thead>
            <tr className="text-left text-12 uppercase tracking-label text-ink-3">
              {cols.columns.map((c) => (
                <th key={c.id} style={{ minWidth: c.minWidth ?? 'var(--col-list-extra)' }} className={`border-b border-rule font-medium ${cellPad}`}>
                  <span className="flex items-baseline gap-2">
                    <span className="flex-1">{c.label}</span>
                    {!isLocked(c, studentCopy) && (
                      <button
                        type="button"
                        aria-label={`Remove ${c.label} column`}
                        onClick={() => cols.removeColumn(c)}
                        className="-m-hit inline-flex p-hit text-ink-3 hover:text-ink"
                      >
                        <Icon icon={X} size="xs" />
                      </button>
                    )}
                  </span>
                </th>
              ))}

              <th className="sticky right-0 z-sticky w-actions border-b border-rule bg-surface px-6 py-4 shadow-sticky">
                <button
                  ref={addRef}
                  type="button"
                  aria-label="Add a column"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="inline-flex rounded-lg border border-rule bg-surface p-hit text-ink-2"
                >
                  <Icon icon={Plus} size="compact" />
                </button>

                {menuOpen &&
                  createPortal(
                    <div
                      className="card-in-sm w-add-menu rounded-lg border border-rule bg-surface p-4 text-left normal-case tracking-normal shadow-popover"
                      style={menuStyle(menuBox, 'add')}
                    >
                      <p className="text-12 font-medium uppercase tracking-label text-ink-3">Add a column</p>
                      <div className="mt-dock flex flex-col gap-2">
                        {cols.suggestions.map((s) => (
                          <button
                            key={s.text}
                            type="button"
                            onClick={() => {
                              s.onPick()
                              setMenuOpen(false)
                            }}
                            className="rounded-lg border border-rule bg-surface px-dock py-2 text-left text-14 font-normal leading-snug text-ink-2 hover:bg-rail"
                          >
                            {s.text}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Or describe the column you want"
                        onKeyDown={(e) => {
                          const v = e.target.value.trim()
                          if (e.key === 'Enter' && v) {
                            e.target.value = ''
                            cols.addColumn({ label: v.length > 24 ? `${v.slice(0, 24)}…` : v, prompt: v })
                            setMenuOpen(false)
                          }
                        }}
                        className="mt-dock w-full rounded-lg border border-rule bg-surface px-dock py-2 text-14 text-ink outline-none"
                      />
                      <p className="mt-dock text-12 leading-normal text-ink-3">
                        Columns are filled from published data. Anything unverified is flagged rather than guessed.
                      </p>
                    </div>,
                    document.body,
                  )}
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((s, i) => (
              <tr key={s.id} className="row-in relative align-top" style={{ zIndex: askOpen === s.id ? 'var(--z-ask-row)' : 'var(--z-row)' }}>
                {cols.columns.map((c) => (
                  <td key={c.id} className={`border-b border-rule ${cellPad}`}>
                    {c.id === 'name' && (
                      <>
                        <p className="m-0 text-15 text-ink">{s.name}</p>
                        <p className="mt-2 text-12 text-ink-3">{s.meta}</p>
                      </>
                    )}
                    {c.id === 'band' && (
                      <span className="text-15" style={{ color: s.bandInk }}>
                        {s.band}
                      </span>
                    )}
                    {c.id === 'cost' && (
                      <>
                        <p className="m-0 text-15 tabular-nums" style={{ color: s.oopInk }}>
                          {s.oopText} <span className="text-12 text-ink-3">/ yr</span>
                        </p>
                        <p className="mt-1 text-12" style={{ color: s.oopInk }}>
                          {s.capNote}
                        </p>
                        <p className="mt-2 text-12 tabular-nums text-ink-2">{s.tuitionLine}</p>
                        <p className="mt-1 text-12 tabular-nums text-ink-3">{s.altLine}</p>
                      </>
                    )}
                    {c.id === 'distance' && <span className="text-14 text-ink-2">{s.distance}</span>}
                    {c.id === 'rate' && (
                      <>
                        <p className="m-0 text-15 tabular-nums text-ink">{s.rate}</p>
                        <p className="mt-2 text-12 text-ink-3">{s.midSat}</p>
                      </>
                    )}
                    {c.id === 'program' && <span className="text-14 text-ink-2">{s.programLine}</span>}
                    {c.id === 'environment' && <span className="text-14 text-ink-2">{s.environmentLine}</span>}
                    {c.id === 'support' && <span className="text-14 text-ink-2">{s.supportLine}</span>}
                    {c.id === 'rationale' && <span className="text-14 text-ink-2">{s.rationale}</span>}
                    {c.values && (
                      <span className="block text-14 leading-normal" style={{ color: extraCellColor(cols.pending, c, s.id) }}>
                        {cols.pending === c.id ? 'Looking it up…' : c.values[s.id] || 'Not published — flagged for review'}
                      </span>
                    )}
                  </td>
                ))}

                <td className="sticky right-0 z-sticky border-b border-rule bg-surface px-6 py-4 text-right shadow-sticky">
                  <button
                    ref={(el) => {
                      askRefs.current[s.id] = el
                    }}
                    type="button"
                    aria-label="Ask about this school"
                    onClick={() => setAskOpen((v) => (v === s.id ? null : s.id))}
                    className="inline-flex"
                    style={{ color: askOpen === s.id ? 'var(--ink)' : 'var(--ink-3)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 10 4 15l5 5" />
                      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                    </svg>
                  </button>

                  {askOpen === s.id &&
                    createPortal(
                    <div
                      className="card-in-sm w-ask rounded-lg border border-rule bg-surface p-4 text-left text-15 shadow-popover"
                      style={menuStyle(askBox, i >= rows.length - 3 ? 'ask-bottom' : 'ask')}
                    >
                      <div className="flex items-baseline gap-2">
                        <p className="m-0 flex-1 text-12 font-medium uppercase tracking-label text-ink-3">Ask about this school</p>
                        <button type="button" aria-label="Close" onClick={() => setAskOpen(null)} className="inline-flex text-ink-3">
                          <Icon icon={X} size="compact" />
                        </button>
                      </div>
                      <p className="mt-2 text-14 text-ink">{s.name}</p>
                      <div className="mt-dock flex flex-col gap-2">
                        {[
                          'Scholarships available here',
                          'Show NCAA Division I athletics',
                          `Why is this a ${s.band.toLowerCase()}?`,
                          'What would this cost after aid?',
                        ].map((text) => (
                          <button
                            key={text}
                            type="button"
                            onClick={() => {
                              onAsk(s, text)
                              setAskOpen(null)
                            }}
                            className="rounded-lg border border-rule bg-surface px-dock py-2 text-left text-14 leading-snug text-ink-2 hover:bg-rail"
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Or ask something else"
                        onKeyDown={(e) => {
                          const v = e.target.value.trim()
                          if (e.key === 'Enter' && v) {
                            onAsk(s, v)
                            setAskOpen(null)
                          }
                        }}
                        className="mt-dock w-full rounded-lg border border-rule bg-surface px-dock py-2 text-14 text-ink outline-none"
                      />
                    </div>,
                    document.body,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-2">
          {['Counselor copy', 'Student copy'].map((label) => {
            const active = (label === 'Student copy') === studentCopy
            return (
              <button
                key={label}
                type="button"
                onClick={() => onToggleCopy(label === 'Student copy')}
                className={
                  active
                    ? 'rounded-lg bg-ink-2 px-4 py-2 text-14 font-medium text-surface'
                    : 'rounded-lg border border-rule px-4 py-2 text-14 text-ink-2'
                }
              >
                {label}
              </button>
            )
          })}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false)
            setAskOpen(null)
            onPreview()
          }}
          className="rounded-lg bg-ink px-4 py-2 text-14 font-medium text-surface"
        >
          Preview &amp; print
        </button>
      </div>
    </>
  )
}
