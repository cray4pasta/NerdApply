// Screen 2 — Criteria review. A table, not chips: the counselor is auditing, and auditing wants
// rows. See docs/03-DESIGN.md 4.2 and docs/01-PRD.md 4.3 — nothing generates until Continue.
import { Plus, X } from 'lucide-react'
import ConfidenceDots from './ui/ConfidenceDots.jsx'
import Icon from './ui/Icon.jsx'
import { PROGRAM_CHOICES } from '../lib/extract.js'
import { STATE_NAMES } from '../lib/geo.js'

const STRENGTHS = ['required', 'preferred', 'flexible']
const STRENGTH_LABEL = { required: 'Required', preferred: 'Preferred', flexible: 'Flexible' }

const INCOME_BANDS = [
  { value: '0-30000', label: '$0 – $30,000' },
  { value: '30001-48000', label: '$30,001 – $48,000' },
  { value: '48001-75000', label: '$48,001 – $75,000' },
  { value: '75001-110000', label: '$75,001 – $110,000' },
  { value: '110001-plus', label: '$110,001+' },
]

let nextNewId = 1000

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
  function updateCriterion(id, patch) {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function removeCriterion(id) {
    setCriteria((prev) => prev.filter((c) => c.id !== id))
  }

  function addCriterion() {
    const first = PROGRAM_CHOICES.find((p) => p.value === 'nursing') ?? PROGRAM_CHOICES[0]
    setCriteria((prev) => [
      ...prev,
      {
        id: `manual-${nextNewId++}`,
        category: 'academic_interest',
        label: first.label,
        value: first.value,
        confidence: 'high',
        source_phrase: null,
        strength: 'preferred',
      },
    ])
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
            <th className="py-2 pr-4 font-medium">What I understood</th>
            <th className="py-2 pr-4 font-medium">From this phrase</th>
            <th className="py-2 pr-4 font-medium">Confidence</th>
            <th className="py-2 pr-4 font-medium">Importance</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c) => (
            <tr
              key={c.id}
              className={`border-b border-rule ${c.confidence === 'low' ? 'border-l-8 border-l-ink-3 border-dashed' : ''}`}
            >
              <td className="py-3 pr-4">
                {c.category === 'academic_interest' && PROGRAM_CHOICES.some((p) => p.value === c.value) ? (
                  <select
                    className="w-full rounded-control border border-rule bg-surface px-2 py-1 font-sans text-15 text-ink focus:border-brand focus:outline-none"
                    value={c.value}
                    disabled={locked}
                    onChange={(e) => {
                      const picked = PROGRAM_CHOICES.find((p) => p.value === e.target.value)
                      updateCriterion(c.id, { value: e.target.value, label: picked?.label ?? e.target.value })
                    }}
                  >
                    {PROGRAM_CHOICES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="w-full rounded-control border border-transparent bg-transparent px-2 py-1 font-sans text-ink hover:border-rule focus:border-brand focus:outline-none"
                    value={c.label}
                    disabled={locked}
                    onChange={(e) => updateCriterion(c.id, { label: e.target.value })}
                  />
                )}
              </td>
              <td className="py-3 pr-4 font-sans text-14 text-ink-2">
                {c.source_phrase ? `"${c.source_phrase}"` : '—'}
              </td>
              <td className="py-3 pr-4">
                <ConfidenceDots level={c.confidence} />
              </td>
              <td className="py-3 pr-4">
                <select
                  className="rounded-control border border-rule bg-surface px-2 py-1 font-sans text-14 text-ink focus:border-brand focus:outline-none"
                  value={c.strength}
                  disabled={locked}
                  onChange={(e) => updateCriterion(c.id, { strength: e.target.value })}
                >
                  {STRENGTHS.map((s) => (
                    <option key={s} value={s}>
                      {STRENGTH_LABEL[s]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-3 text-right">
                {!locked && (
                  <button
                    type="button"
                    className="px-2 text-ink-3 hover:text-ink"
                    aria-label={`Remove ${c.label}`}
                    onClick={() => removeCriterion(c.id)}
                  >
                    <Icon icon={X} size="sm" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {!locked && (
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1 font-sans text-body-sm text-brand hover:text-brand-hover"
          onClick={addCriterion}
        >
          <Icon icon={Plus} size="sm" />
          Add a criterion
        </button>
      )}

      <div className="mt-8 rounded-card border border-rule bg-paper p-5">
        <h3 className="font-sans text-18 font-medium text-ink">Affordability and home</h3>
        <p className="mt-1 font-sans text-14 text-ink-2">This drives every affordability label and every travel estimate. A best estimate is fine.</p>
        {extraction?.affordability_signal?.aid_needed && (
          <p className="mt-2 text-12 text-ink-3">
            Pre-filled from: "{extraction.affordability_signal.source_phrase}" (low confidence)
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
