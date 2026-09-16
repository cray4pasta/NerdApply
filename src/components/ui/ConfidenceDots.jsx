// Confidence on the criteria table — same three-dot grammar as evidence strength, monochrome.
// See docs/03-DESIGN.md 4.2.
const LEVELS = { high: 3, medium: 2, low: 1 }

export default function ConfidenceDots({ level }) {
  const filled = LEVELS[level] ?? 1
  return (
    <span className="inline-flex items-center gap-1" title={`Confidence: ${level}`} aria-label={`Confidence: ${level}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`inline-block h-2 w-2 rounded-control ${i < filled ? 'bg-ink' : 'bg-rule'}`} />
      ))}
    </span>
  )
}
