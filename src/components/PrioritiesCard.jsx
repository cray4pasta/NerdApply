import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PRIORITY_LABELS } from '../data/listBuilder.js'
import { STATE_NAMES } from '../lib/geo.js'
import Icon from './ui/Icon.jsx'

const HOME_STATES = ['Pennsylvania', 'New Jersey', 'Ohio', ...Object.values(STATE_NAMES)]
const UNIQUE_STATES = [...new Set(HOME_STATES)]
const INCOME_BANDS = ['$30,001 – $48,000', '$48,001 – $75,000', '$75,001 – $110,000', '$110,001 – $160,000']

function FancySelect({ value, onChange, children }) {
  return (
    <span className="relative flex max-w-full">
      <select
        value={value}
        onChange={onChange}
        className="w-full min-w-0 appearance-none rounded-lg border border-rule bg-surface py-2 pl-dock pr-select-pad text-15 text-ink outline-none"
      >
        {children}
      </select>
      <Icon
        icon={ChevronDown}
        size="xs"
        className="pointer-events-none absolute right-dock top-1/2 -translate-y-1/2 text-ink-3"
      />
    </span>
  )
}

function settingsFromInitial(initial) {
  const labels = initial?.order?.length ? initial.order : PRIORITY_LABELS
  const order = labels.map((label) => PRIORITY_LABELS.indexOf(label)).filter((i) => i >= 0)
  return {
    order: order.length === PRIORITY_LABELS.length ? order : [0, 1, 2, 3, 4, 5],
    homeState: initial?.homeState || '',
    incomeBand: initial?.incomeBand ?? '$75,001 – $110,000',
    maxOop: initial?.maxOop ?? '$25,000',
  }
}

export default function PrioritiesCard({ initial, onDraft, onBuild }) {
  const start = settingsFromInitial(initial)
  const [order, setOrder] = useState(start.order)
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const [homeState, setHomeState] = useState(start.homeState)
  const [incomeBand, setIncomeBand] = useState(start.incomeBand)
  const [maxOop, setMaxOop] = useState(start.maxOop)

  function currentSettings() {
    return { order: order.map((i) => PRIORITY_LABELS[i]), homeState, incomeBand, maxOop }
  }

  useEffect(() => {
    onDraft?.(currentSettings())
  }, [order, homeState, incomeBand, maxOop])

  function reorder(from, to) {
    setDragIndex(null)
    setOverIndex(null)
    if (from == null || from === to) return
    setOrder((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  return (
    <div className="card-in mb-dock w-notes-entry rounded-lg border border-rule bg-surface p-6">
      <p className="text-12 font-medium uppercase tracking-label text-ink-3">What matters most</p>

      <ol className="mt-4 flex list-none flex-col gap-2 p-0">
        {order.map((labelIdx, i) => (
          <li
            key={labelIdx}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', String(i))
              setDragIndex(i)
              setOverIndex(i)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (overIndex !== i) setOverIndex(i)
            }}
            onDrop={(e) => {
              e.preventDefault()
              const from = dragIndex ?? Number(e.dataTransfer.getData('text/plain'))
              reorder(from, i)
            }}
            onDragEnd={() => {
              setDragIndex(null)
              setOverIndex(null)
            }}
            className={[
              'drag-row flex items-center gap-4 rounded-lg border border-rule bg-surface px-dock py-2',
              dragIndex === i ? 'drag-row-source' : '',
              overIndex === i && dragIndex !== i ? 'drag-row-over' : '',
            ].join(' ')}
          >
            <span className="w-prose text-12 tabular-nums text-ink-3">{i + 1}</span>
            <span className="flex-1 text-15 text-ink">{PRIORITY_LABELS[labelIdx]}</span>
            <span className="inline-flex text-ink-3" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.4" />
                <circle cx="15" cy="6" r="1.4" />
                <circle cx="9" cy="12" r="1.4" />
                <circle cx="15" cy="12" r="1.4" />
                <circle cx="9" cy="18" r="1.4" />
                <circle cx="15" cy="18" r="1.4" />
              </svg>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-12 font-medium uppercase tracking-label text-ink-3">Money and home</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <label className="flex min-w-0 flex-col gap-2 text-14 text-ink-2">
          Home state
          <FancySelect value={homeState} onChange={(e) => setHomeState(e.target.value)}>
            <option value=""> </option>
            {UNIQUE_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FancySelect>
        </label>

        <label className="flex min-w-0 flex-col gap-2 text-14 text-ink-2">
          Family income
          <FancySelect value={incomeBand} onChange={(e) => setIncomeBand(e.target.value)}>
            {INCOME_BANDS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </FancySelect>
        </label>

        <label className="flex min-w-0 flex-col gap-2 text-14 text-ink-2">
          Max out-of-pocket / year
          <input
            type="text"
            value={maxOop}
            onChange={(e) => setMaxOop(e.target.value)}
            className="w-oop rounded-lg border border-rule bg-surface p-2 text-15 tabular-nums text-ink outline-none"
          />
        </label>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="m-0 flex-1 text-14 text-ink-3">
          A best estimate is fine. It only changes the labels, never which schools qualify.
        </p>
        <button
          type="button"
          onClick={() => onBuild(currentSettings())}
          className="rounded-lg bg-ink px-4 py-2 text-14 font-medium text-surface"
        >
          Build the list
        </button>
      </div>
    </div>
  )
}
