// Evidence strength — three dots, monochrome. Modifies the label; never competes with it.
// See docs/03-DESIGN.md section 2.
const LEVELS = { strong: 3, moderate: 2, limited: 1 }

export default function EvidenceDots({ level }) {
  const filled = LEVELS[level] ?? 1
  return (
    <span className="inline-flex items-center gap-1" title={`Evidence: ${level}`} aria-label={`Evidence strength: ${level}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`inline-block h-2 w-2 rounded-control ${i < filled ? 'bg-ink' : 'bg-rule'}`} />
      ))}
    </span>
  )
}
