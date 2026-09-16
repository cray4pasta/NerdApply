import {
  advisingFor,
  deadlinesFor,
  printIntro,
  shortCellText,
  visitQuestions as visitQs,
} from '../lib/listRows.js'

export default function PrintPreview({
  rows,
  cols,
  studentCopy,
  onClose,
  onPrint,
  studentName = 'Student',
  schoolLabel = 'High school',
  programLabel = 'the requested program',
  academic = {},
  homeState,
  clubs,
}) {
  const summaryCols = cols.bases.filter((c) => c.short)
  const proseCols = [...cols.bases.filter((c) => !c.short), ...cols.extras]
  const pageTotal = rows.length + 1
  const title = studentCopy ? 'Student copy' : 'Counselor copy'
  const intro = printIntro({ studentCopy, studentName, programLabel, academic, homeState })
  const questions = visitQs(programLabel, clubs)

  return (
    <div className="print-preview-root absolute inset-0 z-preview flex flex-col overflow-hidden bg-desk">
      <div className="print-preview-toolbar flex flex-shrink-0 items-center gap-4 border-b border-rule bg-surface px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-rule bg-surface px-4 py-2 text-14 text-ink-2"
        >
          <svg className="h-icon-compact w-icon-compact" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to the list
        </button>
        <span className="flex flex-col">
          <span className="text-14 text-ink">{title}</span>
          <span className="text-12 text-ink-3">Summary page + {rows.length} college pages</span>
        </span>
        <span className="flex-1" />
        <button type="button" onClick={onPrint} className="rounded-lg bg-ink px-4 py-2 text-14 font-medium text-surface">
          Print / Save as PDF
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center gap-6 overflow-y-auto p-6">
        <div className="print-sheet w-sheet flex-shrink-0 border border-rule bg-surface px-sheet-x py-sheet-y shadow-sheet">
          <div className="flex items-baseline justify-between gap-4 border-b border-ink pb-dock">
            <span className="text-20 text-ink">{studentCopy ? `${studentName} — college list` : `${studentName} — advising notes`}</span>
            <span className="text-12 text-ink-3">
              {studentCopy ? `${schoolLabel} · prepared with your counselor` : `${schoolLabel} · counselor copy, not for the student`}
            </span>
          </div>

          <p className="mt-prose text-13 leading-relaxed text-ink-2">{intro}</p>

          <table className="mt-6 w-full border-collapse text-12">
            <thead>
              <tr className="text-left text-ink-3">
                {summaryCols.map((c) => (
                  <th key={c.id} style={{ width: c.printWidth }} className="border-b border-rule p-2 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="align-baseline">
                  {summaryCols.map((c) => (
                    <td
                      key={c.id}
                      className="border-b border-rail p-2 tabular-nums"
                      style={{ color: c.id === 'band' ? s.bandInk : c.id === 'name' || c.id === 'cost' ? 'var(--ink)' : 'var(--ink-2)' }}
                    >
                      <span className="block">{shortCellText(s, c.id)}</span>
                      {c.id === 'name' && <span className="mt-0.5 block text-11 text-ink-3">{s.meta}</span>}
                      {c.id === 'rate' && <span className="mt-0.5 block text-11 text-ink-3">{s.midSat}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-4 text-12 leading-normal text-ink-2">
            {proseCols.length ? `${proseCols.map((c) => c.label).join(', ')} — one page per school, from page 2.` : 'One page per school follows, from page 2.'}
          </p>
          <p className="mt-dock text-11 leading-normal text-ink-3">
            Page 1 of {pageTotal} · Cost figures are estimates from the income band on file, not a filed FAFSA. Confirm every
            deadline on the school’s own admissions page.
          </p>
        </div>

        {rows.map((s, i) => {
          const d = deadlinesFor(s)
          const a = advisingFor(s, academic)
          return (
            <div key={s.id} className="print-sheet w-sheet flex-shrink-0 border border-rule bg-surface px-sheet-x py-sheet-y shadow-sheet">
              <div className="flex items-baseline justify-between gap-4 border-b border-ink pb-dock">
                <span className="text-18 text-ink">{s.name}</span>
                <span className="text-12" style={{ color: s.bandInk }}>
                  {s.band}
                </span>
              </div>
              <p className="mt-2 text-12 text-ink-3">{s.meta}</p>

              <div className="mt-6 grid grid-cols-3 gap-4">
                <Stat label="Est. cost / yr" value={s.oopText} note={s.tuitionLine} />
                <Stat label="Admit rate" value={s.rate} note={s.midSat} />
                <Stat label="Distance" value={s.distance} note={s.capNote} />
              </div>

              <div className="mt-6 flex flex-col gap-dock">
                {proseCols.map((c) => (
                  <div key={c.id}>
                    <p className="m-0 text-11 uppercase tracking-label text-ink-3">{c.label}</p>
                    <p className="mt-1 text-13 leading-relaxed text-ink-2">
                      {c.id === 'rationale' ? s.rationale : c.values?.[s.id] || s.clubs || s.campus_life || 'Not published — flagged for review'}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4 border-t border-rule pt-4">
                <Stat label="Early" value={d.ea} />
                <Stat label="Regular" value={d.rd} />
                <Stat label="Financial aid" value={d.aid} />
              </div>

              {studentCopy ? (
                <>
                  <Section label="What to do next">
                    <ol className="mt-2 flex list-decimal flex-col gap-dot pl-prose">
                      {[
                        `Create the application account and add ${s.name.split(' ')[0]} to your list`,
                        s.band === 'Reach'
                          ? 'Ask a teacher for a recommendation early — reaches read them closely'
                          : 'Request your transcript through the counseling office',
                        'Run the school’s net price calculator with your family’s numbers',
                      ].map((t) => (
                        <li key={t} className="text-13 leading-normal text-ink-2">
                          {t}
                        </li>
                      ))}
                    </ol>
                  </Section>

                  <Section label="Ask on a campus visit">
                    <ul className="mt-2 flex list-disc flex-col gap-dot pl-prose">
                      {questions.map((q) => (
                        <li key={q} className="text-13 leading-normal text-ink-2">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </Section>

                  <Section label="Your notes">
                    <div className="mt-dock flex flex-col gap-prose">
                      {[0, 1, 2, 3].map((n) => (
                        <span key={n} className="block border-b border-rule" />
                      ))}
                    </div>
                  </Section>
                </>
              ) : (
                <>
                  <Section label="Acceptance stats">
                    <ul className="mt-2 grid list-none grid-cols-2 gap-x-6 gap-y-dot p-0">
                      {a.stats.map((t) => (
                        <li key={t} className="text-13 leading-normal tabular-nums text-ink-2">
                          {t}
                        </li>
                      ))}
                    </ul>
                  </Section>

                  <Section label="Where the file is short">
                    <p className="mt-2 text-13 leading-relaxed text-ink-2">{a.gap}</p>
                  </Section>

                  <Section label="What to advise">
                    <p className="mt-2 text-13 leading-relaxed text-ink">{a.advise}</p>
                  </Section>

                  <Section label="What to improve">
                    <p className="mt-2 text-13 leading-relaxed text-ink-2">{a.improve}</p>
                  </Section>
                </>
              )}

              <p className="mt-6 text-11 text-ink-3">
                Page {i + 2} of {pageTotal} · {title} · {studentName}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value, note }) {
  return (
    <span className="flex flex-col gap-hit">
      <span className="text-11 uppercase tracking-label text-ink-3">{label}</span>
      <span className="text-16 text-ink">{value}</span>
      {note && <span className="text-11 text-ink-3">{note}</span>}
    </span>
  )
}

function Section({ label, children }) {
  return (
    <>
      <p className="mt-6 text-11 uppercase tracking-label text-ink-3">{label}</p>
      {children}
    </>
  )
}
