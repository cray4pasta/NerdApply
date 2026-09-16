// Makes the product rules a demonstration instead of a claim. See docs/04-GUARDRAILS.md 1.2.
// Call this once, right before rendering the list.
const BANNED = /\b(safety school|guaranteed|\d{1,3}\s?% chance|you will get in)\b/i

export function assertList(list) {
  for (const s of list) {
    if (s.admissions.band === 'Likely' && s.admit_rate != null && s.admit_rate < 0.2) {
      throw new Error(`G3 violated: ${s.name} labelled Likely at ${s.admit_rate} admit rate`)
    }
    if (s.affordability.band !== 'Unknown' && s.affordability.netPrice == null) {
      throw new Error(`G4 violated: ${s.name} has an affordability label with no net price`)
    }
    if (BANNED.test(s.rationale ?? '')) {
      throw new Error(`G1/G2 violated in rationale for ${s.name}`)
    }
    if ('match_score' in s) {
      throw new Error('G5 violated: a blended score reached the list')
    }
  }
}
