// Deterministic list builder. The model never picks a school — see files/02-ENGINEERING.md §7.
import { PROGRAM_CHOICES } from './extract.js'
import { travelBurden } from './geo.js'

const STRENGTH_MULT = { required: 1.5, preferred: 1.0, flexible: 0.5 }
const PRIORITY_W = [1.6, 1.4, 1.2, 1.0, 0.85, 0.7]
const WARM_STATES = new Set(['FL', 'TX', 'GA', 'SC', 'NC', 'AL', 'MS', 'LA', 'AZ', 'CA', 'HI', 'NV'])
const KNOWN_PROGRAMS = new Set(PROGRAM_CHOICES.map((p) => p.value))

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function academicStrength(school, sat, gpa) {
  if (sat != null && school.sat_p25 != null && school.sat_p75 != null && school.sat_p75 !== school.sat_p25) {
    let position = (sat - school.sat_p25) / (school.sat_p75 - school.sat_p25)
    position = clamp(position, -1, 2)
    const gpaMod = gpa >= 3.7 ? 0.15 : gpa <= 3.2 ? -0.15 : 0
    return { strength: position + gpaMod, coarse: false }
  }
  if (gpa != null) {
    const strength = gpa >= 3.7 ? 1.0 : gpa <= 3.0 ? -0.5 : 0.3
    return { strength, coarse: true }
  }
  return { strength: 0, coarse: true }
}

function admissionsBand(admitRate, strength) {
  if (admitRate == null) return strength >= 1.0 ? 'Target' : 'Reach'
  if (admitRate < 0.08) return 'Reach'
  if (admitRate < 0.2) return strength >= 1.0 ? 'Target' : 'Reach'
  if (admitRate < 0.5) {
    if (strength >= 1.0) return 'Likely'
    if (strength >= 0.2) return 'Target'
    return 'Reach'
  }
  if (strength >= 0.2) return 'Likely'
  if (strength >= -0.4) return 'Target'
  return 'Reach'
}

function evidenceStrength(school, sat) {
  if (sat == null || school.sat_p25 == null || school.admit_rate == null) return 'limited'
  if (school.test_optional) return 'moderate'
  return 'strong'
}

function affordabilityBand(school, incomeBand, ceiling, homeState) {
  const est = school.net_price?.[incomeBand]
  if (est == null) {
    return { band: 'Unknown', net: null, outOfStatePublic: false }
  }
  const outOfStatePublic = school.ownership === 'public' && homeState && school.state !== homeState
  let band = est <= ceiling ? 'Likely Affordable' : 'Needs Review'
  if (outOfStatePublic && band === 'Likely Affordable') band = 'Needs Review'
  return { band, net: est, outOfStatePublic }
}

function passesHardFilters(school, { interestPrograms, requiredGeo, preferOutOfState, homeState, ceiling }) {
  if (interestPrograms.length) {
    const ok = interestPrograms.some((p) => school.programs?.includes(p))
    if (!ok) return false
  }
  if (requiredGeo?.home_state && requiredGeo?.max_miles != null) {
    const burden = travelBurden(requiredGeo.home_state, school)
    if (burden.miles != null && burden.miles > requiredGeo.max_miles) return false
  }
  if (preferOutOfState && homeState && school.state === homeState) return false
  const est = school.net_price ? Object.values(school.net_price).find((n) => n != null) : null
  if (ceiling != null && est != null && est > ceiling * 1.6 && !school.tags?.includes('strong_merit')) {
    return false
  }
  return true
}

function fitScore(school, ctx) {
  const { priorityOrder, criteria, admissions, affordability, ceiling } = ctx
  const weight = (dim) => PRIORITY_W[priorityOrder.indexOf(dim)] ?? 1
  const strengthOf = (criterion) => STRENGTH_MULT[criterion?.strength] ?? 1.0

  const interestCriteria = criteria.filter((c) => c.category === 'academic_interest')
  const geoCriterion = criteria.find((c) => c.category === 'geography')
  const envCriteria = criteria.filter((c) => c.category === 'environment' || c.category === 'size')
  const supportCriteria = criteria.filter((c) => c.category === 'support_needs')

  let programPoints = 0
  for (const c of interestCriteria) {
    if (!KNOWN_PROGRAMS.has(c.value)) continue
    if (school.programs?.includes(c.value)) {
      const hasSpecialty =
        (c.value === 'computer_science' && (school.tags?.includes('co_op') || school.tags?.includes('abet_engineering'))) ||
        (c.value === 'marine_biology' && school.tags?.includes('marine_science')) ||
        (c.value === 'art' && school.tags?.includes('studio_art'))
      programPoints += (hasSpecialty ? 25 : 10) * strengthOf(c)
    }
  }

  let proximityPoints = 0
  const travel = school.travel
  if (geoCriterion?.value?.prefer_far) {
    const far = travel?.miles != null && travel.miles >= 350
    proximityPoints = (far ? 25 : travel?.miles != null && travel.miles >= 180 ? 12 : 4) * strengthOf(geoCriterion)
  } else if (geoCriterion) {
    const max = geoCriterion.value?.max_miles
    let base = 6
    if (max != null && travel?.miles != null && travel.miles <= max) base = 25
    else if (travel?.miles != null && travel.miles < 300) base = 12
    proximityPoints = base * strengthOf(geoCriterion)
  }

  const admitPts = admissions.band === 'Target' ? 20 : admissions.band === 'Likely' ? 12 : 6
  const affordPts =
    affordability.band === 'Likely Affordable'
      ? 30
      : affordability.band === 'Needs Review' && affordability.net != null && ceiling != null && affordability.net <= ceiling * 1.1
        ? 12
        : 0

  let environmentPoints = 0
  for (const c of envCriteria) {
    const val = c.value
    if (val === 'warm' && WARM_STATES.has(school.state)) environmentPoints += 10 * strengthOf(c)
    else if (val === 'small' && school.size < 5000) environmentPoints += 10 * strengthOf(c)
    else if (val === 'large' && school.size > 20000) environmentPoints += 10 * strengthOf(c)
    else if (val === school.setting) environmentPoints += 10 * strengthOf(c)
    else environmentPoints += 8 * strengthOf(c)
  }

  let supportPoints = 0
  for (const c of supportCriteria) supportPoints += 15 * strengthOf(c)

  const cautiousReach = criteria.some((c) => c.value === 'cautious_reach')
  const realism = cautiousReach && admissions.band === 'Reach' ? admitPts * 0.4 : admitPts

  let raw =
    affordPts * weight('affordability') +
    programPoints * weight('program') +
    proximityPoints * weight('proximity') +
    realism * weight('admissions_realism') +
    environmentPoints * weight('environment') +
    supportPoints * weight('support')

  if (school.grad_rate_6yr > 0.65) raw += 12
  if (school.regional || school.hbcu || school.tags?.includes('cc_pathway')) raw += 8
  return raw
}

export function buildList({
  schools,
  criteria,
  income_band,
  max_out_of_pocket,
  home_state,
  academic,
  priorityOrder,
}) {
  const interestPrograms = criteria
    .filter((c) => c.category === 'academic_interest' && c.strength === 'required' && KNOWN_PROGRAMS.has(c.value))
    .map((c) => c.value)

  const requiredGeo = criteria.find((c) => c.category === 'geography' && c.strength === 'required')
  const farGeo = criteria.find((c) => c.category === 'geography' && c.value?.prefer_far)
  const preferOutOfState = Boolean(farGeo && farGeo.strength !== 'flexible' && home_state)

  const scored = []
  for (const school of schools) {
    if (
      !passesHardFilters(school, {
        interestPrograms,
        requiredGeo: requiredGeo?.value,
        preferOutOfState,
        homeState: home_state,
        ceiling: max_out_of_pocket,
      })
    ) {
      continue
    }
    const { strength, coarse } = academicStrength(school, academic?.sat, academic?.gpa)
    const band = admissionsBand(school.admit_rate, strength)
    const evidence = coarse ? 'limited' : evidenceStrength(school, academic?.sat)
    const affordability = affordabilityBand(school, income_band, max_out_of_pocket, home_state)
    const travel = travelBurden(home_state, school)
    const row = {
      ...school,
      admissions: { band, evidence, strength },
      affordability,
      travel,
    }
    const fit = fitScore(row, {
      priorityOrder,
      criteria,
      admissions: row.admissions,
      affordability,
      ceiling: max_out_of_pocket,
    })
    scored.push({ ...row, fit })
  }

  const byBand = { Likely: [], Target: [], Reach: [] }
  for (const s of scored) byBand[s.admissions.band].push(s)
  for (const key of Object.keys(byBand)) byBand[key].sort((a, b) => b.fit - a.fit)

  const pick = [
    ...byBand.Likely.slice(0, 3),
    ...byBand.Target.slice(0, 4),
    ...byBand.Reach.slice(0, 3),
  ]
  let list = pick.sort((a, b) => b.fit - a.fit).slice(0, 10)

  const affordableLeft = scored
    .filter((s) => s.affordability.band === 'Likely Affordable' && !list.some((x) => x.id === s.id))
    .sort((a, b) => b.fit - a.fit)
  let swaps = 0
  while (list.filter((s) => s.affordability.band === 'Likely Affordable').length < 2 && affordableLeft.length && swaps < 2) {
    const reachIdx = [...list].reverse().findIndex((s) => s.admissions.band === 'Reach')
    if (reachIdx === -1) break
    const idx = list.length - 1 - reachIdx
    list[idx] = affordableLeft.shift()
    swaps += 1
  }

  return list.sort((a, b) => b.fit - a.fit)
}
