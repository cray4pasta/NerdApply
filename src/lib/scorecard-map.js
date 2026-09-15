import { slugForCip } from './cip.js'

const INCOME_KEYS = [
  '0-30000',
  '30001-48000',
  '48001-75000',
  '75001-110000',
  '110001-plus',
]

function localeSetting(locale) {
  if (locale >= 11 && locale <= 13) return 'city'
  if (locale >= 21 && locale <= 23) return 'suburban'
  if (locale >= 31 && locale <= 33) return 'town'
  if (locale >= 41 && locale <= 43) return 'rural'
  return 'city'
}

function satTotal(percentile) {
  const reading = percentile?.critical_reading
  const math = percentile?.math
  return typeof reading === 'number' && typeof math === 'number' ? reading + math : null
}

function firstNetPrice(netPrice) {
  for (const ownership of ['public', 'private', 'other']) {
    const byIncome = netPrice?.[ownership]?.by_income_level
    if (!byIncome || !INCOME_KEYS.some((key) => byIncome[key] != null && byIncome[key] !== '')) {
      continue
    }

    return Object.fromEntries(
      INCOME_KEYS.filter((key) => byIncome[key] != null && byIncome[key] !== '').map((key) => [
        key,
        byIncome[key],
      ])
    )
  }
  return {}
}

function mapPrograms(entries, queriedSlugs) {
  const requested = new Set(queriedSlugs ?? [])
  const programs = []
  const programNames = {}
  const programAwards = {}

  for (const entry of entries ?? []) {
    const slug = slugForCip(entry?.code)
    if (entry?.credential?.level !== 3 || !slug || !requested.has(slug)) continue

    if (!programs.includes(slug)) programs.push(slug)
    if (entry.title) programNames[slug] = entry.title

    const awards = entry?.counts?.ipeds_awards2 ?? entry?.counts?.ipeds_awards1
    if (awards != null) programAwards[slug] = awards
  }

  return { programs, programNames, programAwards }
}

export function normalizeScorecardSchool(
  raw,
  { queriedSlugs = [], tagsBySlug = {}, unitIdToSlug = {}, lastVerified } = {}
) {
  if (raw?.id == null || !raw?.school?.name) return null

  const unitId = String(raw.id)
  const snapshotSlug = unitIdToSlug[unitId]
  const overlay = snapshotSlug ? tagsBySlug[snapshotSlug] ?? {} : {}
  const latest = raw.latest ?? {}
  const admissions = latest.admissions ?? {}
  const cost = latest.cost ?? {}
  const completion = latest.completion?.rate_suppressed ?? {}
  const { programs, programNames, programAwards } = mapPrograms(
    latest.programs?.cip_4_digit,
    queriedSlugs
  )

  return {
    id: snapshotSlug ?? unitId,
    name: raw.school.name,
    city: raw.school.city ?? null,
    state: raw.school.state ?? null,
    lat: raw.location?.lat ?? null,
    lon: raw.location?.lon ?? null,
    ownership: raw.school.ownership === 1 ? 'public' : 'private',
    setting: localeSetting(raw.school.locale),
    size: latest.student?.size ?? null,
    hbcu: raw.school.minority_serving?.historically_black === 1,
    admit_rate: admissions.admission_rate?.overall ?? null,
    sat_p25: satTotal(admissions.sat_scores?.['25th_percentile']),
    sat_p75: satTotal(admissions.sat_scores?.['75th_percentile']),
    test_optional: false,
    net_price: firstNetPrice(cost.net_price),
    grad_rate_6yr: completion.four_year ?? completion.overall ?? null,
    cost_of_attendance: {
      tuition_in_state: cost.tuition?.in_state ?? null,
      tuition_out_state: cost.tuition?.out_of_state ?? null,
      room_board: cost.roomboard?.oncampus ?? null,
      books_personal: cost.booksupply ?? null,
    },
    programs,
    program_names: { ...programNames, ...(overlay.program_names ?? {}) },
    program_awards: programAwards,
    tags: overlay.tags ?? [],
    courses: overlay.courses ?? {},
    course_source: overlay.course_source ?? {},
    npc_url: overlay.npc_url ?? null,
    npc_display: overlay.npc_display ?? null,
    source: 'College Scorecard (live)',
    last_verified: lastVerified ?? null,
  }
}
