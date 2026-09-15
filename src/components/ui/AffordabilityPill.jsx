const CLASS = {
  'Likely Affordable': 'bg-ink text-surface',
  'Needs Review': 'bg-flag-bg text-flag',
  Unknown: 'border border-dashed border-ink-3 bg-transparent text-ink-3',
}

export default function AffordabilityPill({ band }) {
  return (
    <span className={`inline-flex rounded-control px-2 py-1 font-sans text-12 ${CLASS[band] ?? CLASS.Unknown}`}>
      {band}
    </span>
  )
}
