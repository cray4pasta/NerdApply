const DIMENSION_LABEL = {
  affordability: 'Affordability',
  program: 'Academic programme strength',
  proximity: 'Closeness to home',
  admissions_realism: 'Admissions realism',
  environment: 'Campus environment and fit',
  support: 'Student support services',
}

export default function PrioritiesStep({ order, setOrder, onContinue }) {
  function move(index, dir) {
    const next = index + dir
    if (next < 0 || next >= order.length) return
    setOrder((prev) => {
      const copy = [...prev]
      const [row] = copy.splice(index, 1)
      copy.splice(next, 0, row)
      return copy
    })
  }

  return (
    <div className="mx-auto max-w-priorities">
      <h2 className="font-display text-22 text-ink">What matters most for this student?</h2>
      <p className="mt-2 font-sans text-14 text-ink-2">
        Move rows to reorder. This changes which schools rise to the top.
      </p>
      <ol className="mt-6 space-y-2">
        {order.map((dim, i) => (
          <li key={dim} className="flex items-center gap-3 rounded-card border border-rule bg-surface px-4 py-3">
            <span className="w-6 font-sans text-12 tabular text-ink-3">{i + 1}</span>
            <span className="flex-1 font-sans text-18 text-ink">{DIMENSION_LABEL[dim]}</span>
            <div className="flex gap-1">
              <button
                type="button"
                className="rounded-control px-2 py-1 text-ink-3 hover:text-ink"
                aria-label={`Move ${DIMENSION_LABEL[dim]} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="rounded-control px-2 py-1 text-ink-3 hover:text-ink"
                aria-label={`Move ${DIMENSION_LABEL[dim]} down`}
                disabled={i === order.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="mt-6 rounded-control bg-brand px-5 py-3 font-sans text-15 font-medium text-surface hover:bg-brand-hover"
        onClick={onContinue}
      >
        Build the list
      </button>
    </div>
  )
}
