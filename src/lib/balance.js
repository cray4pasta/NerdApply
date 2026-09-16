// List-level checks, rerun after every counselor edit. Warnings never block printing and never
// appear on the family document — the counselor decides. See docs/02-ENGINEERING.md 7.8.
const NON_OBVIOUS_TAGS = ['regional_public', 'hbcu', 'community_college']

export function summarize(list) {
  const likely = list.filter((s) => s.admissions.band === 'Likely').length
  const target = list.filter((s) => s.admissions.band === 'Target').length
  const reach = list.filter((s) => s.admissions.band === 'Reach').length
  const affordable = list.filter((s) => s.affordability.band === 'Likely Affordable').length
  return { likely, target, reach, affordable }
}

export function checkBalance(list) {
  const warnings = []
  if (list.length === 0) return warnings

  const { likely, reach, affordable } = summarize(list)

  if (affordable === 0) {
    warnings.push('This list has no school the family is likely to afford. Consider adding an in-state public or a school that meets full need.')
  }

  if (likely < 2 || reach > 4) {
    warnings.push('This list is reach-heavy. Add at least two Likely schools.')
  }

  const states = new Set(list.map((s) => s.state))
  if (states.size === 1) {
    warnings.push(`Every school is in ${[...states][0]}. Worth confirming that's intentional.`)
  }

  const hasNonObvious = list.some((s) => s.tags?.some((t) => NON_OBVIOUS_TAGS.includes(t)))
  if (!hasNonObvious) {
    warnings.push('All recommendations are large or well-known institutions. Consider regional options.')
  }

  for (const s of list) {
    if (!s.programs || s.programs.length === 0) {
      warnings.push(`Program availability at ${s.name} is unverified — check before sharing.`)
    }
  }

  return warnings
}
