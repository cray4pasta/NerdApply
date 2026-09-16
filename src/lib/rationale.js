// One sentence per school. Tries the AI rationale call, which receives only the facts the
// engine already produced (docs/02-ENGINEERING.md 6.2 — the AI writes, never decides). Falls
// back to a template sentence assembled from the same facts if the call is unavailable.
import { fetchWithTimeout } from './progress.js'

function templateRationale(school, criteria) {
  const interest = criteria.find((c) => c.category === 'academic_interest' && school.programs?.includes(c.value))
  const sizeWord =
    school.size == null ? null : school.size < 5000 ? 'small' : school.size > 20000 ? 'large' : 'mid-sized'
  const programPhrase = interest ? `${interest.label.toLowerCase()}` : 'a broad range of programs'
  const travel = school.travel?.text ? school.travel.text.toLowerCase() : 'distance from home is estimated'
  const schoolPhrase = sizeWord
    ? `A ${sizeWord} ${school.ownership} school`
    : `A ${school.ownership} school with unknown enrollment`

  return `${schoolPhrase} in ${school.setting} ${school.state} with ${programPhrase}, ${travel}.`
}

export function templatesFor(schools, criteria) {
  return Object.fromEntries(schools.map((s) => [s.id, templateRationale(s, criteria)]))
}

export async function getRationales(schools, criteria) {
  const fallback = templatesFor(schools, criteria)
  try {
    const res = await fetchWithTimeout('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'rationale',
        criteria,
        schools: schools.map((s) => ({
          id: s.id,
          name: s.name,
          admissions: s.admissions,
          affordability: s.affordability,
          travel: s.travel,
          totalAnnualCost: s.totalAnnualCost,
          programs: s.programs,
          program_names: s.program_names ?? null,
          program_awards: s.program_awards ?? null,
        })),
      }),
    })
    if (!res.ok) throw new Error(`rationale call failed: ${res.status}`)
    const sentences = await res.json()
    return Object.fromEntries(schools.map((s) => [s.id, sentences[s.id] ?? fallback[s.id]]))
  } catch (err) {
    console.warn('[rationale] AI rationale unavailable, using template sentences:', err.message)
    return fallback
  }
}
