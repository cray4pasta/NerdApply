import { useState } from 'react'
import NotesStep from './components/NotesStep.jsx'
import CriteriaStep from './components/CriteriaStep.jsx'
import PrioritiesStep from './components/PrioritiesStep.jsx'
import ListStep from './components/ListStep.jsx'
import { extractCriteria } from './lib/extract.js'
import { buildList } from './lib/engine.js'
import { getColleges } from './lib/colleges.js'
import { getRationales } from './lib/rationale.js'
import { assertList } from './lib/guardrails.js'

const DEFAULT_ORDER = [
  'affordability',
  'program',
  'proximity',
  'admissions_realism',
  'environment',
  'support',
]

export default function App() {
  const [step, setStep] = useState('notes')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [extraction, setExtraction] = useState(null)
  const [criteria, setCriteria] = useState([])
  const [homeState, setHomeState] = useState(null)
  const [incomeBand, setIncomeBand] = useState('75001-110000')
  const [maxOutOfPocket, setMaxOutOfPocket] = useState(25000)
  const [priorityOrder, setPriorityOrder] = useState(DEFAULT_ORDER)
  const [list, setList] = useState([])
  const [rationales, setRationales] = useState({})
  const [notesById, setNotesById] = useState({})

  async function onExtract() {
    setBusy(true)
    try {
      const result = await extractCriteria(notes)
      setExtraction(result)
      setCriteria(result.criteria ?? [])
      setHomeState(result.home_state ?? null)
      if (result.affordability_signal?.aid_needed) setIncomeBand('30001-48000')
      setStep('criteria')
    } finally {
      setBusy(false)
    }
  }

  async function onBuild() {
    setBusy(true)
    try {
      const built = assertList(
        buildList({
          schools: getColleges(),
          criteria,
          income_band: incomeBand,
          max_out_of_pocket: maxOutOfPocket,
          home_state: homeState,
          academic: extraction?.academic,
          priorityOrder,
        })
      )
      const sentences = await getRationales(built, criteria)
      setList(built)
      setRationales(sentences)
      setNotesById({})
      setStep('list')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full bg-paper px-6 py-8">
      {step === 'notes' && <NotesStep notes={notes} setNotes={setNotes} onSubmit={onExtract} busy={busy} />}

      {step === 'criteria' && (
        <div className="mx-auto max-w-wide">
          <button type="button" className="mb-4 font-sans text-14 text-ink-3 hover:text-ink" onClick={() => setStep('notes')}>
            Back to notes
          </button>
          <h1 className="mb-4 font-display text-22 text-ink">Criteria review</h1>
          <CriteriaStep
            extraction={extraction}
            criteria={criteria}
            setCriteria={setCriteria}
            incomeBand={incomeBand}
            setIncomeBand={setIncomeBand}
            maxOutOfPocket={maxOutOfPocket}
            setMaxOutOfPocket={setMaxOutOfPocket}
            homeState={homeState}
            setHomeState={setHomeState}
            onContinue={() => setStep('priorities')}
            continueLabel="Looks right — continue"
          />
        </div>
      )}

      {step === 'priorities' && (
        <div>
          <button
            type="button"
            className="mx-auto mb-4 block max-w-priorities font-sans text-14 text-ink-3 hover:text-ink"
            onClick={() => setStep('criteria')}
          >
            Back to criteria
          </button>
          <PrioritiesStep order={priorityOrder} setOrder={setPriorityOrder} onContinue={onBuild} />
          {busy && <p className="mx-auto mt-4 max-w-priorities font-sans text-14 text-ink-2">Building the list…</p>}
        </div>
      )}

      {step === 'list' && (
        <div>
          <div className="mx-auto mb-6 flex max-w-wide flex-wrap gap-4">
            <button type="button" className="font-sans text-14 text-ink-3 hover:text-ink" onClick={() => setStep('criteria')}>
              Edit criteria
            </button>
            <button type="button" className="font-sans text-14 text-ink-3 hover:text-ink" onClick={() => setStep('priorities')}>
              Edit ranking
            </button>
            <button
              type="button"
              className="font-sans text-14 text-ink-3 hover:text-ink"
              onClick={() => {
                setStep('notes')
                setList([])
              }}
            >
              Start over
            </button>
          </div>
          <ListStep
            list={list}
            criteria={criteria}
            rationales={rationales}
            notesById={notesById}
            setNotesById={setNotesById}
            onRemove={(id) => setList((prev) => prev.filter((s) => s.id !== id))}
          />
        </div>
      )}
    </div>
  )
}
