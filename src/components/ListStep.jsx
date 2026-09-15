import AdmissionsBand from './ui/AdmissionsBand.jsx'
import AffordabilityPill from './ui/AffordabilityPill.jsx'
import EvidenceDots from './ui/EvidenceDots.jsx'
import { balanceWarnings } from '../lib/balance.js'

function matchedChips(school, criteria) {
  const chips = []
  for (const c of criteria) {
    if (c.category === 'academic_interest' && school.programs?.includes(c.value)) chips.push(c.label)
    if (c.category === 'geography') chips.push(c.label)
    const val = c.value
    if (val === school.setting) chips.push(c.label)
    else if (val === 'small' && school.size < 5000) chips.push(c.label)
    else if (val === 'large' && school.size > 20000) chips.push(c.label)
    else if (val === 'warm') chips.push(c.label)
  }
  return [...new Set(chips)].slice(0, 4)
}

function SchoolRow({ school, criteria, rationale, note, onNoteChange, onRemove }) {
  const chips = matchedChips(school, criteria)
  const sat = school.sat_p25 != null ? `middle 50% is ${school.sat_p25}–${school.sat_p75}` : 'no SAT range on file'
  const admit = school.admit_rate != null ? `${Math.round(school.admit_rate * 100)}% admit rate` : 'admit rate unknown'

  return (
    <article className="rounded-card border border-rule bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-18 text-ink">{school.name}</h3>
          <p className="mt-1 font-sans text-14 text-ink-2">
            {school.city}, {school.state} · {school.ownership} · {school.size.toLocaleString()} students
          </p>
        </div>
        <button type="button" className="font-sans text-14 text-ink-3 hover:text-ink" onClick={() => onRemove(school.id)}>
          Remove
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <AdmissionsBand band={school.admissions.band} />
        <EvidenceDots level={school.admissions.evidence} />
        <span className="font-sans text-12 text-ink-3">
          {sat} · {admit}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <AffordabilityPill band={school.affordability.band} />
        {school.affordability.net != null ? (
          <span className="font-sans text-14 text-ink-2">About ${school.affordability.net.toLocaleString()} / year</span>
        ) : (
          <span className="font-sans text-14 text-ink-3">Net price not published for this income band</span>
        )}
        <span className="font-sans text-12 text-ink-3">Last verified {school.last_verified}</span>
      </div>
      {school.affordability.outOfStatePublic && (
        <p className="mt-2 font-sans text-12 text-ink-3">
          Net price shown is in-state. Out-of-state cost is typically higher — verify with the school.
        </p>
      )}
      <p className="mt-3 font-sans text-14 text-ink-2">{school.travel.label}</p>
      <p className="mt-2 font-sans text-15 text-ink">{rationale}</p>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span key={chip} className="rounded-control bg-brand-tint px-2 py-1 font-sans text-12 text-ink-2">
              {chip}
            </span>
          ))}
        </div>
      )}
      <label className="mt-4 flex flex-col gap-1 font-sans text-12 text-ink-3">
        Counselor note
        <input
          className="rounded-control border border-rule bg-surface px-3 py-2 font-sans text-14 text-ink focus:border-brand focus:outline-none"
          value={note ?? ''}
          onChange={(e) => onNoteChange(school.id, e.target.value)}
        />
      </label>
    </article>
  )
}

export default function ListStep({ list, criteria, rationales, notesById, setNotesById, onRemove }) {
  const warnings = balanceWarnings(list)

  return (
    <div className="mx-auto max-w-wide">
      {warnings.length > 0 && (
        <aside className="mb-6 rounded-card border border-flag bg-flag-bg p-4">
          <h2 className="font-sans text-15 font-medium text-flag">Balance check</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 font-sans text-14 text-flag">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </aside>
      )}
      {list.length === 0 && (
        <p className="font-sans text-15 text-ink-2">
          No schools in this snapshot matched the required filters. Use Edit on an academic row to pick a program this
          snapshot has, or add a criterion the list can score.
        </p>
      )}
      <div className="space-y-4">
        {list.map((school) => (
          <SchoolRow
            key={school.id}
            school={school}
            criteria={criteria}
            rationale={rationales[school.id]}
            note={notesById[school.id]}
            onNoteChange={(id, value) => setNotesById((prev) => ({ ...prev, [id]: value }))}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  )
}
