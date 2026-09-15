// Screen 2 — Criteria review. Phrase first, then a one-line paraphrase, then edit and delete
// together. Confidence and Required/Preferred stay on the row object for scoring, not in the table.
import { useState } from 'react'
import { PROGRAM_CHOICES } from '../lib/extract.js'
import { STATE_NAMES } from '../lib/geo.js'

const INCOME_BANDS = [
  { value: '0-30000', label: '$0 – $30,000' },
  { value: '30001-48000', label: '$30,001 – $48,000' },
  { value: '48001-75000', label: '$48,001 – $75,000' },
  { value: '75001-110000', label: '$75,001 – $110,000' },
  { value: '110001-plus', label: '$110,001+' },
]

let nextNewId = 1000

function IconPencil() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L8.25 18.402 3 19.5l1.098-5.25L16.862 4.487z"
      />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 7h12M9 7V5.25A1.25 1.25 0 0110.25 4h3.5A1.25 1.25 0 0115 5.25V7m-8 0l.8 12.5A1.5 1.5 0 009.3 21h5.4a1.5 1.5 0 001.5-1.5L16.9 7"
      />
    </svg>
  )
}

export default function CriteriaStep({
  extraction,
  criteria,
  setCriteria,
  incomeBand,
  setIncomeBand,
  maxOutOfPocket,
  setMaxOutOfPocket,
  homeState,
  setHomeState,
  locked = false,
  onContinue,
  continueLabel = 'Looks right — continue',
}) {
  const [editingId, setEditingId] = useState(null)

  function updateCriterion(id, patch) {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function removeCriterion(id) {
    setCriteria((prev) => prev.filter((c) => c.id !== id))
    setEditingId((current) => (current === id ? null : current))
  }

  function addCriterion() {
    const first = PROGRAM_CHOICES.find((p) => p.value === 'nursing') ?? PROGRAM_CHOICES[0]
    const id = `manual-${nextNewId++}`
    setCriteria((prev) => [
      ...prev,
      {
        id,
        category: 'academic_interest',
        label: first.label,
        value: first.value,
        confidence: 'high',
        source_phrase: null,
        strength: 'preferred',
        understood: '',
      },
    ])
    setEditingId(id)
  }

  function onHomeState(abbr) {
    const next = abbr || null
    setHomeState(next)
    setCriteria((prev) =>
      prev.map((c) =>
        c.category === 'geography' ? { ...c, value: { ...(c.value ?? {}), home_state: next } } : c
      )
    )
  }

  return (
    <div className="rounded-card border border-rule bg-surface p-5">
      {extraction?.degraded && (
        <div className="mb-4 rounded-card border border-dashed border-ink-3 bg-paper p-4 font-sans text-14 text-ink-2">
          AI extraction unavailable — criteria were matched by keyword. Please review carefully.
        </div>
      )}

      {extraction?.unresolved?.length > 0 && (
        <ul className="mb-4 list-disc space-y-1 pl-5 font-sans text-12 text-ink-3">
          {extraction.unresolved.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-sans text-15">
          <thead>
            <tr className="border-b border-rule text-left text-12 uppercase tracking-label text-ink-3">
              <th className="py-2 pr-4 font-medium">Phrase</th>
              <th className="py-2 pr-4 font-medium">What I understood</th>
              <th className="py-2 font-medium">
                <span className="sr-only">Edit or delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => {
              const editing = !locked && editingId === c.id
              const understoodDisplay = c.understood || c.label || ''
              const showProgram =
                editing &&
                c.category === 'academic_interest' &&
                PROGRAM_CHOICES.some((p) => p.value === c.value)

              return (
                <tr key={c.id} className="border-b border-rule align-top">
                  <td className="py-3 pr-4">
                    {editing ? (
                      <input
                        className="w-full rounded-control border border-rule bg-surface px-2 py-1 font-display text-15 text-ink-2 focus:border-brand focus:outline-none"
                        value={c.source_phrase ?? ''}
                        placeholder="Exact words from the notes"
                        onChange={(e) =>
                          updateCriterion(c.id, { source_phrase: e.target.value.trim() ? e.target.value : null })
                        }
                      />
                    ) : (
                      <span className="font-display text-15 text-ink-2">
                        {c.source_phrase ? `"${c.source_phrase}"` : '—'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {editing ? (
                      <div className="flex flex-col gap-2">
                        <input
                          className="w-full rounded-control border border-rule bg-surface px-2 py-1 font-sans text-15 text-ink focus:border-brand focus:outline-none"
                          value={c.understood ?? ''}
                          placeholder="What this means for the search"
                          onChange={(e) => updateCriterion(c.id, { understood: e.target.value })}
                        />
                        {showProgram && (
                          <label className="flex flex-col gap-1 text-12 text-ink-3">
                            Program used for the list
                            <select
                              className="w-full rounded-control border border-rule bg-surface px-2 py-1 font-sans text-15 text-ink focus:border-brand focus:outline-none"
                              value={c.value}
                              onChange={(e) => {
                                const picked = PROGRAM_CHOICES.find((p) => p.value === e.target.value)
                                updateCriterion(c.id, {
                                  value: e.target.value,
                                  label: picked?.label ?? e.target.value,
                                })
                              }}
                            >
                              {PROGRAM_CHOICES.map((p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    ) : (
                      <span className="font-sans text-15 text-ink">{understoodDisplay || '—'}</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    {!locked && (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded-control p-1 text-ink-3 hover:text-ink"
                          aria-label={
                            editing
                              ? `Done editing ${understoodDisplay || c.label}`
                              : `Edit ${understoodDisplay || c.label}`
                          }
                          onClick={() => setEditingId(editing ? null : c.id)}
                        >
                          {editing ? <IconCheck /> : <IconPencil />}
                        </button>
                        <button
                          type="button"
                          className="rounded-control p-1 text-ink-3 hover:text-ink"
                          aria-label={`Remove ${understoodDisplay || c.label}`}
                          onClick={() => removeCriterion(c.id)}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!locked && (
        <button type="button" className="mt-3 font-sans text-14 text-brand hover:text-brand-hover" onClick={addCriterion}>
          + Add a criterion
        </button>
      )}

      <div className="mt-8 rounded-card border border-rule bg-paper p-5">
        <h3 className="font-sans text-18 font-medium text-ink">Affordability and home</h3>
        <p className="mt-1 font-sans text-14 text-ink-2">
          This drives every affordability label and every travel estimate. A best estimate is fine.
        </p>
        {extraction?.affordability_signal?.aid_needed && (
          <p className="mt-2 text-12 text-ink-3">
            Pre-filled from: "{extraction.affordability_signal.source_phrase}"
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-6">
          <label className="flex flex-col gap-1 text-14 text-ink-2">
            Home state
            <select
              className="rounded-control border border-rule bg-surface px-3 py-2 font-sans text-15 text-ink focus:border-brand focus:outline-none"
              value={homeState ?? ''}
              disabled={locked}
              onChange={(e) => onHomeState(e.target.value)}
            >
              <option value="">Not set</option>
              {Object.entries(STATE_NAMES).map(([abbr, name]) => (
                <option key={abbr} value={abbr}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-14 text-ink-2">
            Family income band
            <select
              className="rounded-control border border-rule bg-surface px-3 py-2 font-sans text-15 text-ink focus:border-brand focus:outline-none"
              value={incomeBand}
              disabled={locked}
              onChange={(e) => setIncomeBand(e.target.value)}
            >
              {INCOME_BANDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-14 text-ink-2">
            Maximum annual out-of-pocket
            <input
              type="number"
              min="0"
              step="500"
              className="rounded-control border border-rule bg-surface px-3 py-2 font-sans text-15 text-ink tabular focus:border-brand focus:outline-none"
              value={maxOutOfPocket}
              disabled={locked}
              onChange={(e) => setMaxOutOfPocket(Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      {!locked && (
        <div className="mt-6">
          <button
            type="button"
            className="rounded-control bg-brand px-5 py-3 font-sans text-15 font-medium text-surface hover:bg-brand-hover"
            onClick={onContinue}
          >
            {continueLabel}
          </button>
        </div>
      )}
    </div>
  )
}
