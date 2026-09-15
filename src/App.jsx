import { useMemo, useState } from 'react'
import CriteriaStep from './components/CriteriaStep.jsx'
import { extractFallback } from './lib/extract.js'

const LAW_NOTES = 'wants to pursue law but not sure. SAT 1500, Pennsylvania, far from home.'
const SHORT_NOTES =
  'Interested in nursing but may change direction. Needs strong financial support. Close-knit, not too large. Driving distance. Anxious about reaches.'

export default function App() {
  const [notes, setNotes] = useState(LAW_NOTES)
  const extraction = useMemo(() => extractFallback(notes), [notes])
  const [criteria, setCriteria] = useState(extraction.criteria)
  const [homeState, setHomeState] = useState(extraction.home_state)
  const [incomeBand, setIncomeBand] = useState('75001-110000')
  const [maxOutOfPocket, setMaxOutOfPocket] = useState(25000)
  const [confirmed, setConfirmed] = useState(false)

  function load(nextNotes) {
    const next = extractFallback(nextNotes)
    setNotes(nextNotes)
    setCriteria(next.criteria)
    setHomeState(next.home_state)
    setConfirmed(false)
  }

  const activeExtraction = { ...extraction, criteria }

  return (
    <div className="mx-auto max-w-wide px-6 py-8">
      <h1 className="font-display text-22 text-ink">Criteria review</h1>
      <p className="mt-2 font-sans text-14 text-ink-2">
        Phrase first, then a one-line paraphrase, then edit and delete together.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-control border border-rule bg-surface px-3 py-2 font-sans text-14 text-ink hover:border-brand"
          onClick={() => load(LAW_NOTES)}
        >
          Load law / not sure
        </button>
        <button
          type="button"
          className="rounded-control border border-rule bg-surface px-3 py-2 font-sans text-14 text-ink hover:border-brand"
          onClick={() => load(SHORT_NOTES)}
        >
          Load short counselor notes
        </button>
      </div>
      <div className="mt-6">
        <CriteriaStep
          extraction={activeExtraction}
          criteria={criteria}
          setCriteria={setCriteria}
          incomeBand={incomeBand}
          setIncomeBand={setIncomeBand}
          maxOutOfPocket={maxOutOfPocket}
          setMaxOutOfPocket={setMaxOutOfPocket}
          homeState={homeState}
          setHomeState={setHomeState}
          onContinue={() => setConfirmed(true)}
        />
      </div>
      {confirmed && (
        <div className="mt-6 rounded-card border border-rule bg-surface p-5">
          <h2 className="font-sans text-18 font-medium text-ink">Fields the list builder still receives</h2>
          <p className="mt-1 font-sans text-14 text-ink-2">
            Confidence and importance are hidden on the table. Category, value, and strength stay on each row.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 font-sans text-14 text-ink-2">
            {criteria.map((c) => (
              <li key={c.id}>
                {c.category}: {typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value)} ({c.strength})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
