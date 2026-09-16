import { cipsForSlugs } from '../src/lib/cip.js'
import { normalizeScorecardSchool } from '../src/lib/scorecard-map.js'
import tagsBySlug from '../src/data/program-tags.json' with { type: 'json' }
import snapshotUnitIds from '../src/data/snapshot-unitids.json' with { type: 'json' }

const SCORECARD_URL = 'https://api.data.gov/ed/collegescorecard/v1/schools'
const PER_PAGE = 100
const MAX_PAGES = 3
const TIMEOUT_MS = 8000
const SORT = 'latest.programs.cip_4_digit.counts.ipeds_awards2:desc'
const FIELDS = [
  'id',
  'school.name',
  'school.city',
  'school.state',
  'school.ownership',
  'school.locale',
  'school.school_url',
  'school.minority_serving.historically_black',
  'location.lat',
  'location.lon',
  'latest.student.size',
  'latest.admissions.admission_rate.overall',
  'latest.admissions.sat_scores.25th_percentile.critical_reading',
  'latest.admissions.sat_scores.25th_percentile.math',
  'latest.admissions.sat_scores.75th_percentile.critical_reading',
  'latest.admissions.sat_scores.75th_percentile.math',
  'latest.cost.tuition.in_state',
  'latest.cost.tuition.out_of_state',
  'latest.cost.roomboard.oncampus',
  'latest.cost.booksupply',
  'latest.cost.net_price.public.by_income_level',
  'latest.cost.net_price.private.by_income_level',
  'latest.cost.net_price.other.by_income_level',
  'latest.completion.rate_suppressed.four_year',
  'latest.completion.rate_suppressed.overall',
  'latest.programs.cip_4_digit.code',
  'latest.programs.cip_4_digit.title',
  'latest.programs.cip_4_digit.credential.level',
  'latest.programs.cip_4_digit.counts.ipeds_awards1',
  'latest.programs.cip_4_digit.counts.ipeds_awards2',
].join(',')

const unitIdToSlug = Object.fromEntries(
  Object.entries(snapshotUnitIds).map(([slug, unitId]) => [String(unitId), slug])
)

function requestUrl(key, cips, page, sorted) {
  const params = new URLSearchParams({
    api_key: key,
    'school.operating': '1',
    'school.degrees_awarded.predominant': '3',
    'latest.programs.cip_4_digit.code': cips,
    'latest.programs.cip_4_digit.credential.level': '3',
    per_page: String(PER_PAGE),
    page: String(page),
    fields: FIELDS,
  })
  if (sorted) params.set('sort', SORT)
  return `${SCORECARD_URL}?${params}`
}

async function fetchJson(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: ctrl.signal })
    return response
  } finally {
    clearTimeout(timer)
  }
}

async function fetchPage(key, cips, page) {
  let response = await fetchJson(requestUrl(key, cips, page, true))
  if (!response.ok) {
    console.error('[api/scorecard]', 'sorted request failed; retrying without sort', {
      page,
      status: response.status,
    })
    response = await fetchJson(requestUrl(key, cips, page, false))
  }
  if (!response.ok) throw new Error(`Scorecard returned HTTP ${response.status}`)

  const data = await response.json()
  if (!data || !Array.isArray(data.results)) {
    throw new Error('Scorecard response did not contain a results array')
  }
  return data
}

async function fetchPages(key, cips) {
  const rows = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await fetchPage(key, cips, page)
    const results = data.results
    rows.push(...results)
    if (results.length === 0) break

    const metadata = data.metadata ?? {}
    const metadataPage = Number(metadata.page ?? page)
    const metadataPerPage = Number(metadata.per_page ?? PER_PAGE)
    const metadataTotal = Number(metadata.total)
    if (
      Number.isFinite(metadataTotal) &&
      metadataPage * metadataPerPage + results.length >= metadataTotal
    ) {
      break
    }
  }
  return rows
}

function mergeRows(rows) {
  const byId = new Map()
  for (const row of rows) {
    if (row?.id == null) continue
    const id = String(row.id)
    const existing = byId.get(id)
    if (!existing) {
      byId.set(id, row)
      continue
    }

    const existingPrograms = existing.latest?.programs?.cip_4_digit ?? []
    const incomingPrograms = row.latest?.programs?.cip_4_digit ?? []
    existing.latest = {
      ...existing.latest,
      programs: {
        ...existing.latest?.programs,
        cip_4_digit: [...existingPrograms, ...incomingPrograms],
      },
    }
  }
  return [...byId.values()]
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const programs = req.body?.programs
  const validPrograms =
    Array.isArray(programs) &&
    programs.length > 0 &&
    programs.every(
      (program) => typeof program === 'string' && cipsForSlugs([program]).length > 0
    )
  if (!validPrograms) {
    res.status(400).json({ error: 'malformed' })
    return
  }

  const key = process.env.SCORECARD_API_KEY
  if (!key) {
    res.status(503).json({ error: 'no_key' })
    return
  }

  const queriedSlugs = [...new Set(programs)]
  const cips = cipsForSlugs(queriedSlugs)
  const vintage = new Date().toISOString().slice(0, 10)

  try {
    let rows = await fetchPages(key, cips.join(','))
    if (rows.length === 0 && cips.length > 1) {
      const separateRows = await Promise.all(cips.map((cip) => fetchPages(key, cip)))
      rows = separateRows.flat()
    }

    const schoolsById = new Map()
    for (const raw of mergeRows(rows)) {
      const school = normalizeScorecardSchool(raw, {
        queriedSlugs,
        tagsBySlug,
        unitIdToSlug,
        lastVerified: vintage,
      })
      if (school && !schoolsById.has(school.id)) schoolsById.set(school.id, school)
    }

    res.status(200).json({
      schools: [...schoolsById.values()],
      vintage,
      source: 'live',
    })
  } catch (err) {
    console.error('[api/scorecard]', 'request failed', err)
    res.status(502).json({ error: 'upstream_failed' })
  }
}
