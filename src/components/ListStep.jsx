// Screen 4 — the list as a table. College, its three strongest matches, admit rate, courses.
// Dual labels stay on the name so admissions and affordability are never blended.
import { X } from 'lucide-react'
import AdmissionsBand from './ui/AdmissionsBand.jsx'
import Icon from './ui/Icon.jsx'
import AffordabilityPill from './ui/AffordabilityPill.jsx'
import { checkBalance, summarize } from '../lib/balance.js'
import { DIMENSIONS, topMatchingDimensions } from '../lib/engine.js'
import { highlightCourses } from '../lib/highlights.js'

function admitRate(school) {
  return school.admit_rate == null ? null : Math.round(school.admit_rate * 100)
}

function matchedProgramLabels(school, criteria) {
  return highlightCourses(school, criteria)
    .filter((p) => p.kind === 'matched')
    .map((p) => p.label)
}

function matchValue(dim, school, criteria) {
  if (dim === 'affordability') return school.affordability.band
  if (dim === 'admissions_realism') return school.admissions.band
  if (dim === 'proximity') return school.travel?.text ?? '—'
  if (dim === 'program') {
    const hits = matchedProgramLabels(school, criteria)
    return hits.length ? hits.join(', ') : 'Programme fit'
  }
  if (dim === 'environment') {
    const sizeWord = school.size < 5000 ? 'small' : school.size > 20000 ? 'large' : 'mid-sized'
    return `${school.setting} · ${sizeWord}`
  }
  if (dim === 'support') return 'Support needs noted'
  return '—'
}

function padMatches(school, criteria, priorityOrder, ceiling) {
  const found = topMatchingDimensions(
    school,
    {
      criteria: criteria ?? [],
      admissions: school.admissions,
      affordability: school.affordability,
      priorityOrder: priorityOrder?.length ? priorityOrder : DIMENSIONS,
      ceiling,
    },
    3
  )
  while (found.length < 3) found.push(null)
  return found
}

function SchoolRows({ school, criteria, rationale, note, priorityOrder, ceiling, onNoteChange, onRemove }) {
  const matches = padMatches(school, criteria, priorityOrder, ceiling)
  const rate = admitRate(school)
  const offered = highlightCourses(school, criteria)

  return (
    <tr className="align-top">
      <td className="sticky left-0 z-10 min-w-college border-b border-r border-rule bg-surface px-5 py-4">
          <p className="font-display text-15 text-ink">{school.name}</p>
          <p className="mt-1 font-sans text-12 text-ink-2">
            {school.city}, {school.state} ·{' '}
            {school.ownership === 'community_college' ? 'Community college' : school.ownership}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AdmissionsBand band={school.admissions.band} />
            <AffordabilityPill band={school.affordability.band} />
          </div>
          {rationale && <p className="mt-2 font-sans text-12 text-ink-3">{rationale}</p>}
          <input
            type="text"
            placeholder="Counselor note…"
            className="mt-2 w-full rounded-control border border-rule bg-paper px-2 py-1 font-sans text-12 text-ink focus:border-brand focus:outline-none"
            value={note ?? ''}
            onChange={(e) => onNoteChange(e.target.value)}
          />
        </td>
        {matches.map((match, i) => (
          <td key={match?.dim ?? `empty-${i}`} className="min-w-match border-b border-rule py-4 pr-4">
            {match ? (
              <>
                <p className="text-12 font-medium uppercase tracking-label text-ink-3">{match.label}</p>
                <div className="mt-1 font-sans text-14 text-ink">{matchValue(match.dim, school, criteria)}</div>
              </>
            ) : (
              <span className="text-ink-3">—</span>
            )}
          </td>
        ))}
        <td className="min-w-rate border-b border-rule py-4 pr-4">
          {rate == null ? (
            <span className="text-ink-3">—</span>
          ) : (
            <p className="tabular font-sans text-15 text-ink">
              {rate}%<span className="sr-only"> admit rate</span>
            </p>
          )}
          {school.sat_p25 != null && school.sat_p75 != null && (
            <p className="mt-1 font-sans text-12 text-ink-3">
              Mid-50% SAT {school.sat_p25}–{school.sat_p75}
            </p>
          )}
        </td>
        <td className="min-w-highlights border-b border-rule py-4 pr-4">
          {offered.length === 0 ? (
            <span className="text-ink-3">—</span>
          ) : (
            <div className="space-y-2">
              {offered.map((p) => (
                <div key={p.key}>
                  <p
                    className={`font-sans text-14 ${
                      p.kind === 'matched' ? 'font-medium text-ink' : p.kind === 'missing' ? 'text-ink-3' : 'text-ink-2'
                    }`}
                  >
                    {p.label}
                  </p>
                  {p.awards != null && (
                    <p className="mt-1 font-sans text-12 text-ink-3">
                      Awarded {p.awards} bachelor&apos;s degrees ({school.source}
                      {school.last_verified ? ` · ${school.last_verified}` : ''})
                    </p>
                  )}
                  {p.courses?.length > 0 && (
                    <ul className="mt-1 font-sans text-12 text-ink-2">
                      {p.courses.map((course) => (
                        <li key={course}>{course}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </td>
        <td className="border-b border-rule px-5 py-4 text-right">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-body-sm text-ink-3 hover:text-flag"
            onClick={onRemove}
          >
            <Icon icon={X} size="sm" />
            Remove
          </button>
        </td>
    </tr>
  )
}

export default function ListStep({
  list,
  setList,
  criteria,
  rationales,
  counselorNotes,
  priorityOrder,
  maxOutOfPocket,
  catalogNote,
  onNoteChange,
  onPrintStudent,
  onPrintCounselor,
}) {
  function removeSchool(id) {
    setList((prev) => prev.filter((s) => s.id !== id))
  }

  const summary = summarize(list)
  const warnings = checkBalance(list)

  return (
    <div className="space-y-4">
      <aside className="rounded-card border border-rule bg-surface p-5">
        <h2 className="font-sans text-18 font-medium text-ink">Balance</h2>
        {catalogNote && <p className="mt-2 font-sans text-12 text-ink-2">{catalogNote}</p>}
        <p className="mt-2 font-sans text-14 text-ink-2">
          {summary.likely} Likely · {summary.target} Target · {summary.reach} Reach · {summary.affordable} affordable
        </p>

        {warnings.length === 0 ? (
          <p className="mt-3 font-sans text-14 text-ink-2">No balance concerns on this list.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {warnings.map((w, i) => (
              <li key={i} className="rounded-control bg-flag-bg px-3 py-2 font-sans text-12 text-flag">
                {w}
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="overflow-x-auto rounded-card border border-rule bg-surface">
        <table className="w-full min-w-list border-separate border-spacing-0 font-sans text-15">
          <caption className="sr-only">College list with matched criteria, admit rate, and courses</caption>
          <thead>
            <tr className="text-left text-12 uppercase tracking-label text-ink-3">
              <th className="sticky left-0 z-10 min-w-college border-b border-r border-rule bg-surface px-5 py-3 font-medium">
                College
              </th>
              <th className="min-w-match border-b border-rule py-3 pr-4 font-medium">First match</th>
              <th className="min-w-match border-b border-rule py-3 pr-4 font-medium">Second match</th>
              <th className="min-w-match border-b border-rule py-3 pr-4 font-medium">Third match</th>
              <th className="min-w-rate border-b border-rule py-3 pr-4 font-medium">Admit rate</th>
              <th className="min-w-highlights border-b border-rule py-3 pr-4 font-medium">Highlights</th>
              <th className="border-b border-rule px-5 py-3">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-5 font-sans text-15 text-ink-2">
                  No schools in this snapshot matched the required filters. Mark the major Preferred instead of Required,
                  pick a program this dataset actually has, or set a home state for driving distance.
                </td>
              </tr>
            )}
            {list.map((school) => (
              <SchoolRows
                key={school.id}
                school={school}
                criteria={criteria}
                rationale={rationales?.[school.id]}
                note={counselorNotes?.[school.id]}
                priorityOrder={priorityOrder}
                ceiling={maxOutOfPocket}
                onNoteChange={(v) => onNoteChange(school.id, v)}
                onRemove={() => removeSchool(school.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-control bg-brand px-4 py-2 font-sans text-14 font-medium text-surface hover:bg-brand-hover"
          onClick={onPrintStudent}
        >
          Preview &amp; print — student copy
        </button>
        <button
          type="button"
          className="rounded-control border border-rule px-4 py-2 font-sans text-14 text-ink-2 hover:border-ink-3 hover:text-ink"
          onClick={onPrintCounselor}
        >
          Preview &amp; print — counselor copy
        </button>
      </div>
    </div>
  )
}
