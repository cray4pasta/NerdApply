import { fetchWithTimeout } from './progress.js'

function templateRationale(school, criteria) {
  const interest = criteria.find((c) => c.category === 'academic_interest' && school.programs?.includes(c.value))
  const programPhrase = interest ? `${interest.label.toLowerCase()}` : 'a broad range of programs'
  const travel = school.travel?.label ? school.travel.label.charAt(0).toLowerCase() + school.travel.label.slice(1) : 'a workable trip from home'
  return `${school.name} offers ${programPhrase}, and getting there is ${travel}.`
}

export async function getRationales(schools, criteria) {
  try {
    const slim = schools.map((s) => ({
      id: s.id,
      name: s.name,
      state: s.state,
      admissions: s.admissions.band,
      affordability: s.affordability.band,
      travel: s.travel.label,
      programs: s.programs,
    }))
    const res = await fetchWithTimeout('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'rationale', criteria, schools: slim }),
    })
    if (!res.ok) throw new Error('rationale failed')
    const sentences = await res.json()
    return Object.fromEntries(schools.map((s) => [s.id, sentences[s.id] ?? templateRationale(s, criteria)]))
  } catch {
    return Object.fromEntries(schools.map((s) => [s.id, templateRationale(s, criteria)]))
  }
}
