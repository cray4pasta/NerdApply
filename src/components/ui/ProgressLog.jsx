export default function ProgressLog({ steps = [], activeIndex = 0 }) {
  const current = Math.min(activeIndex, Math.max(steps.length - 1, 0))
  const busy = steps.length > 0 && activeIndex < steps.length

  return (
    <ol className="rounded-card border border-rule bg-surface px-4 py-3" aria-live="polite" aria-busy={busy}>
      {steps.map((label, i) => {
        const done = i < current
        const now = i === current
        return (
          <li
            key={label}
            className={`flex items-baseline gap-3 py-1 font-sans text-14 ${now ? 'text-ink' : 'text-ink-3'}`}
          >
            <span className={`w-12 shrink-0 text-12 uppercase tracking-label ${now ? 'status-now text-brand' : ''}`}>
              {done ? 'Done' : now ? 'Now' : ''}
            </span>
            <span>{now ? `${label}…` : label}</span>
          </li>
        )
      })}
    </ol>
  )
}
