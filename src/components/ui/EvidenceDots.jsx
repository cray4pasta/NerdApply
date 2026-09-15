const LEVELS = { strong: 3, moderate: 2, limited: 1 }

export default function EvidenceDots({ level }) {
  const filled = LEVELS[level] ?? 1
  return (
    <span className="inline-flex items-center gap-1" title={`Evidence: ${level}`} aria-label={`Evidence strength: ${level}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`inline-block h-1 w-1 rounded-full ${i < filled ? 'bg-ink' : 'bg-rule'}`} />
      ))}
    </span>
  )
}
