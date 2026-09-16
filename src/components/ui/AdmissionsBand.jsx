// Admissions band — monochrome and positional, never coloured. A Reach isn't a failure, so the
// three states carry equal visual weight. See docs/03-DESIGN.md section 2.
const ORDER = ['Likely', 'Target', 'Reach']

export default function AdmissionsBand({ band }) {
  const index = ORDER.indexOf(band)
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-15 font-medium text-ink">{band}</span>
      <span className="inline-flex gap-1" aria-hidden="true">
        {ORDER.map((_, i) => (
          <span
            key={i}
            className={`h-2 w-4 rounded-control ${i === index ? 'bg-ink' : 'bg-surface border border-rule'}`}
          />
        ))}
      </span>
    </span>
  )
}
