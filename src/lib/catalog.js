import { requiredProgramSlugs } from './cip.js'
import { fetchWithTimeout, SCORECARD_MS } from './progress.js'

export const EMPTY_CATALOG_ERROR =
  'No matching programs in College Scorecard for this major. Mark the major Flexible, or add a different program, then build again.'

export function catalogFromNoRequiredMajor(snapshotSchools) {
  return {
    schools: snapshotSchools,
    source: 'snapshot',
    reason: 'no_required_major',
    vintage: null,
    error: null,
  }
}

export function catalogFromUnavailable(snapshotSchools) {
  return {
    schools: snapshotSchools,
    source: 'snapshot',
    reason: 'unavailable',
    vintage: null,
    error: null,
  }
}

export function catalogFromScorecardBody(data) {
  if (!Array.isArray(data?.schools)) return null

  if (data.schools.length === 0) {
    return {
      schools: [],
      source: 'live',
      reason: 'empty',
      vintage: data.vintage ?? null,
      error: EMPTY_CATALOG_ERROR,
    }
  }

  return {
    schools: data.schools,
    source: 'live',
    reason: 'ok',
    vintage: data.vintage ?? null,
    error: null,
  }
}

export function scorecardResponseShape(data) {
  if (data == null) return String(data)
  if (Array.isArray(data)) return 'array'
  if (typeof data !== 'object') return typeof data
  const keys = Object.keys(data)
  const schoolsType = Array.isArray(data.schools) ? 'array' : typeof data.schools
  return `{ keys: [${keys.join(', ')}], schools: ${schoolsType} }`
}

export async function loadSchoolsForList({ criteria, incomeBand }) {
  const programs = requiredProgramSlugs(criteria)
  const { getColleges } = await import('./colleges.js')
  const snapshot = getColleges()

  if (programs.length === 0) {
    return catalogFromNoRequiredMajor(snapshot)
  }

  try {
    const res = await fetchWithTimeout(
      '/api/scorecard',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programs, income_band: incomeBand }),
      },
      SCORECARD_MS
    )

    if (!res.ok) {
      return catalogFromUnavailable(snapshot)
    }

    const data = await res.json()
    const live = catalogFromScorecardBody(data)
    if (live) return live

    console.warn('[catalog] malformed Scorecard response', scorecardResponseShape(data))
    return catalogFromUnavailable(snapshot)
  } catch (err) {
    console.warn('[catalog] Scorecard unavailable', err)
    return catalogFromUnavailable(snapshot)
  }
}
