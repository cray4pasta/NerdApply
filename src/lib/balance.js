export function balanceWarnings(list) {
  const warnings = []
  if (!list.length) {
    warnings.push('No schools in this snapshot matched the required filters. Pick a program the snapshot has, or the list stays empty.')
    return warnings
  }
  const affordable = list.filter((s) => s.affordability.band === 'Likely Affordable').length
  if (affordable === 0) {
    warnings.push(
      'This list has no school the family is likely to afford. Consider adding an in-state public or a school that meets full need.'
    )
  }
  const likely = list.filter((s) => s.admissions.band === 'Likely').length
  const reach = list.filter((s) => s.admissions.band === 'Reach').length
  if (likely < 2 || reach > 4) {
    warnings.push('This list is reach-heavy. Add at least two Likely schools.')
  }
  const states = new Set(list.map((s) => s.state))
  if (states.size === 1) {
    warnings.push(`Every school is in ${[...states][0]}. Worth confirming that's intentional.`)
  }
  const hasNonObvious = list.some((s) => s.regional || s.hbcu || s.tags?.includes('cc_pathway'))
  if (!hasNonObvious) {
    warnings.push('All recommendations are large or well-known institutions. Consider regional options.')
  }
  return warnings
}
