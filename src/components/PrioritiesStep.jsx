// Priorities as a chat card. Up/down buttons instead of drag — per docs/03-DESIGN.md 4.3:
// "Reordering has to work; it does not have to feel like iOS."
// Labels stay icon-free. Arrows are the reorder control, not decoration.
import { ArrowDown, ArrowUp } from 'lucide-react'
import Icon from './ui/Icon.jsx'

const DIMENSION_LABEL = {
  affordability: 'Affordability',
  program: 'Academic programme strength',
  proximity: 'Closeness to home',
  admissions_realism: 'Admissions realism',
  environment: 'Campus environment and fit',
  support: 'Student support services',
}

export default function PrioritiesStep({
  priorityOrder,
  setPriorityOrder,
  locked = false,
  onContinue,
  continueLabel = 'Build the list',
}) {
  function move(index, direction) {
    const next = [...priorityOrder]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setPriorityOrder(next)
  }

  return (
    <div className="rounded-card border border-rule bg-surface p-5">
      <ol className="space-y-2">
        {priorityOrder.map((dim, i) => (
          <li key={dim} className="flex items-center gap-4 rounded-card border border-rule bg-paper px-4 py-3">
            <span className="tabular font-sans text-12 text-ink-3">{i + 1}</span>
            <span className="flex-1 font-sans text-18 text-ink">{DIMENSION_LABEL[dim]}</span>
            {!locked && (
              <span className="flex flex-col">
                <button
                  type="button"
                  className="px-2 text-ink-3 hover:text-ink disabled:opacity-30"
                  aria-label={`Move ${DIMENSION_LABEL[dim]} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <Icon icon={ArrowUp} size="sm" />
                </button>
                <button
                  type="button"
                  className="px-2 text-ink-3 hover:text-ink disabled:opacity-30"
                  aria-label={`Move ${DIMENSION_LABEL[dim]} down`}
                  disabled={i === priorityOrder.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <Icon icon={ArrowDown} size="sm" />
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-4 font-sans text-14 text-ink-2">Reorder with the arrows. This changes which schools rise to the top.</p>

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

export { DIMENSION_LABEL }
