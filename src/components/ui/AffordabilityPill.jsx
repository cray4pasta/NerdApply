// Affordability — the only coloured thing on the screen, and only one of its three states
// carries colour. Unknown is a dashed outline with nothing in it: absence made visible.
// See docs/03-DESIGN.md section 2.
export default function AffordabilityPill({ band }) {
  if (band === 'Likely Affordable') {
    return (
      <span className="inline-block rounded-control bg-ink px-3 py-1 text-12 font-medium text-surface">
        Likely Affordable
      </span>
    )
  }
  if (band === 'Needs Review') {
    return (
      <span className="inline-block rounded-control bg-flag px-3 py-1 text-12 font-medium text-surface">
        Needs Review
      </span>
    )
  }
  return (
    <span className="inline-block rounded-control border border-dashed border-ink-3 px-3 py-1 text-12 font-medium text-ink-3">
      Unknown
    </span>
  )
}
