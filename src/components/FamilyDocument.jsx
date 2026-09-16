// Two documents, one component. The student copy is warm and second-person; the counselor copy
// is clinical and keeps the machinery. See files/03-DESIGN.md section 5.
import { checkBalance } from '../lib/balance.js'
import { DIMENSION_LABEL } from './PrioritiesStep.jsx'

const INCOME_LABEL = {
  '0-30000': '$0–$30,000',
  '30001-48000': '$30,001–$48,000',
  '48001-75000': '$48,001–$75,000',
  '75001-110000': '$75,001–$110,000',
  '110001-plus': '$110,001+',
}

const AFFORD_LABEL = {
  'Likely Affordable': 'Likely affordable',
  'Needs Review': 'Needs review',
  Unknown: 'Unknown',
}

function money(n) {
  return n == null ? null : `$${Math.round(n).toLocaleString('en-US')}`
}

function today() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function SchoolEntry({ school, rationale, note, variant, incomeBand }) {
  const netPrice = money(school.affordability.netPrice)
  const totalCost = money(school.totalAnnualCost)
  const afford = AFFORD_LABEL[school.affordability.band] ?? school.affordability.band

  return (
    <article className="school-entry border-b border-rule py-6">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-22 text-ink">{school.name}</h2>
        <p className="shrink-0 text-12 uppercase tracking-label text-ink-2">
          {school.admissions.band} · {afford}
        </p>
      </header>
      <p className="mt-1 text-14 text-ink-2">
        {school.city}, {school.state} · {school.ownership === 'community_college' ? 'community college' : school.ownership} · about{' '}
        {school.size.toLocaleString('en-US')} students
      </p>

      {rationale && <p className="mt-3 text-15 text-ink">{rationale}</p>}

      <dl className="mt-4 space-y-2 text-15">
        {netPrice && (
          <div>
            <dt className="text-12 uppercase tracking-label text-ink-3">Estimated cost</dt>
            <dd>
              about {netPrice} per year after typical aid, for a family in the {INCOME_LABEL[incomeBand]} income band
              {totalCost ? `. Full cost before aid is about ${totalCost}` : ''}. {school.source}, verified {school.last_verified}.
            </dd>
          </div>
        )}
        {!netPrice && (
          <div>
            <dt className="text-12 uppercase tracking-label text-ink-3">Estimated cost</dt>
            <dd>We do not have reliable cost data yet. Ask the school directly.</dd>
          </div>
        )}
        <div>
          <dt className="text-12 uppercase tracking-label text-ink-3">Getting there</dt>
          <dd>{school.travel.text}</dd>
        </div>
        {school.npc_display && (
          <div>
            <dt className="text-12 uppercase tracking-label text-ink-3">Check your price</dt>
            <dd>
              <a href={school.npc_url}>{school.npc_display}</a>
            </dd>
          </div>
        )}
        {note && (
          <div>
            <dt className="text-12 uppercase tracking-label text-ink-3">Counselor&apos;s note</dt>
            <dd>
              {note} <span className="text-12 text-ink-3">(counselor-added)</span>
            </dd>
          </div>
        )}
        {variant === 'counselor' && (
          <div>
            <dt className="text-12 uppercase tracking-label text-ink-3">Evidence</dt>
            <dd>
              {school.admissions.comparison} · evidence {school.admissions.evidence}
              {school.affordability.note ? ` · ${school.affordability.note}` : ''}
            </dd>
          </div>
        )}
      </dl>
    </article>
  )
}

export default function FamilyDocument({
  variant,
  studentName,
  list,
  rationales,
  counselorNotes,
  extraction,
  incomeBand,
  priorityOrder,
  catalogNote,
  onBack,
}) {
  const name = studentName || 'this student'
  const page1 = list.slice(0, 5)
  const page2 = list.slice(5)
  const warnings = variant === 'counselor' ? checkBalance(list) : []
  const isStudent = variant === 'student'

  return (
    <div className="print-shell min-h-screen bg-paper py-8">
      <div className="no-print mx-auto flex max-w-print items-center justify-between px-6 pb-4">
        <button
          type="button"
          className="rounded-control border border-rule px-4 py-2 text-14 text-ink-2 hover:border-ink-3 hover:text-ink"
          onClick={onBack}
        >
          Back to the list
        </button>
        <p className="text-12 text-ink-3">For the cleanest copy, turn off Headers and footers in the print dialog.</p>
        <button
          type="button"
          className="rounded-control bg-brand px-4 py-2 text-14 font-medium text-surface hover:bg-brand-hover"
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>

      <div className="print-page mx-auto max-w-print bg-surface px-10 py-10 shadow-none">
        <header className="mb-8 text-center">
          <h1 className="font-display text-28 text-ink">A college list for {name}</h1>
          <p className="mt-2 text-14 text-ink-2">Prepared {today()}</p>
          <p className="mt-4 text-14 text-ink-2">
            Reviewed together on <span className="inline-block min-w-write border-b border-ink-3">&nbsp;</span>
          </p>
        </header>

        {isStudent && (
          <section className="mb-8 rounded-card border border-rule p-5 text-15">
            <h2 className="font-display text-18 text-ink">How to read this list</h2>
            <dl className="mt-3 space-y-2">
              <div>
                <dt className="font-medium">Likely</dt>
                <dd>students with a profile like yours are usually admitted.</dd>
              </div>
              <div>
                <dt className="font-medium">Target</dt>
                <dd>a realistic possibility, not a certainty.</dd>
              </div>
              <div>
                <dt className="font-medium">Reach</dt>
                <dd>worth applying to, but plan on other options.</dd>
              </div>
              <div>
                <dt className="font-medium">Likely affordable</dt>
                <dd>based on what your family shared, the estimated cost fits.</dd>
              </div>
              <div>
                <dt className="font-medium">Needs review</dt>
                <dd>the cost may work, but it depends on aid. Check before applying.</dd>
              </div>
              <div>
                <dt className="font-medium">Unknown</dt>
                <dd>we don&apos;t have reliable cost data yet. Ask the school directly.</dd>
              </div>
            </dl>
            <p className="mt-4 italic text-ink-2">
              None of these are guarantees. They are informed estimates based on public data and your counselor&apos;s
              judgment.
            </p>
          </section>
        )}

        {variant === 'counselor' && (
          <section className="mb-8 text-14 text-ink-2">
            <h2 className="font-display text-18 text-ink">How this list was built</h2>
            <p className="mt-2">
              Priority order: {priorityOrder.map((d) => DIMENSION_LABEL[d]).join(' → ')}.
            </p>
            {catalogNote && <p className="mt-2">{catalogNote}</p>}
            {extraction?.degraded && (
              <p className="mt-2">Extraction was keyword-only. Review the criteria table before sharing.</p>
            )}
            {warnings.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-flag">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {page1.map((school) => (
          <SchoolEntry
            key={school.id}
            school={school}
            rationale={rationales[school.id]}
            note={counselorNotes[school.id]}
            variant={variant}
            incomeBand={incomeBand}
          />
        ))}

        <section className="page-2">
          {page2.map((school) => (
            <SchoolEntry
              key={school.id}
              school={school}
              rationale={rationales[school.id]}
              note={counselorNotes[school.id]}
              variant={variant}
              incomeBand={incomeBand}
            />
          ))}

          {isStudent && (
            <>
              <section className="mt-8">
                <h2 className="font-display text-18 text-ink">What to do next</h2>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-15">
                  <li>Run the net price calculator for each school using the short link above.</li>
                  <li>File the FAFSA when it opens, even if you are not sure you will qualify.</li>
                  <li>Ask each school specifically about the program you care about.</li>
                  <li>Visit if you can, or join a virtual information session.</li>
                  <li>
                    Confirm application and aid deadlines on each college&apos;s own admissions page. They change year
                    to year, so they are not printed here.
                  </li>
                </ol>
              </section>

              <section className="mt-8">
                <h2 className="font-display text-18 text-ink">Questions worth asking each school</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-15">
                  <li>What would my actual first-year cost be at our income?</li>
                  <li>How do students in this major find internships or research?</li>
                  <li>What does support look like in the first semester?</li>
                  <li>If this is a public school out of state, what is the out-of-state net price?</li>
                </ul>
              </section>
            </>
          )}

          <footer className="mt-10 border-t border-rule pt-4 text-12 text-ink-3">
            <p>Where this came from</p>
            <p className="mt-2">
              Costs are estimates from public federal data (College Scorecard / IPEDS) and are not a quote. Your actual
              price depends on your family&apos;s finances and each school&apos;s aid policies. Distance is estimated
              from home state, not a street address.
            </p>
          </footer>
        </section>
      </div>
    </div>
  )
}
