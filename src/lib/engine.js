// The heart of the app. Plain code, no AI. Every rule below maps to a numbered section in
// docs/02-ENGINEERING.md section 7 — when you change a weight or a threshold, say which
// numbered rule it maps to, per the Cursor rules in docs/04-GUARDRAILS.md 2.3.
import { travelBurden, WARM_STATES } from './geo.js'

const DIMENSIONS = ['affordability', 'program', 'proximity', 'admissions_realism', 'environment', 'support']
const RANK_WEIGHTS = [1.6, 1.4, 1.2, 1.0, 0.85, 0.7]
const STRENGTH_MULT = { required: 1.5, preferred: 1.0, flexible: 0.5 }
const NON_OBVIOUS_TAGS = ['regional_public', 'hbcu', 'community_college']
const SAT_MISMATCH_POINTS = 200

export function isSatMismatch(school, studentSAT) {
  if (studentSAT == null || school?.sat_p25 == null) return false
  return studentSAT <= school.sat_p25 - SAT_MISMATCH_POINTS
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

// 7.1 — hard filters. A school is excluded outright if any of these fail.
function passesHardFilters(school, { interestPrograms, requiredGeo, preferOutOfState, homeState, ceiling, incomeBand, studentSAT }) {
  if (interestPrograms.length > 0) {
    const offersAny = interestPrograms.some((p) => school.programs?.includes(p))
    if (!offersAny) return false
  }

  if (isSatMismatch(school, studentSAT)) return false

  // 7.1 — "far from home" means not in the home state, unless the counselor marked that row Flexible.
  if (preferOutOfState && homeState && school.state === homeState) return false

  if (requiredGeo?.home_state && requiredGeo?.max_miles != null) {
    const burden = travelBurden(requiredGeo.home_state, school)
    if (burden.miles != null && burden.miles > requiredGeo.max_miles) return false
  }

  if (ceiling != null) {
    const netPrice = school.net_price?.[incomeBand]
    if (netPrice != null) {
      const meetsFullNeed = (school.pct_need_met ?? 0) >= 0.95
      const strongMerit = school.tags?.includes('strong_merit')
      if (netPrice > ceiling * 1.6 && !meetsFullNeed && !strongMerit) return false
    }
  }

  return true
}

// 7.2 — academic strength. SAT does the work; GPA modifies it.
function academicStrength(school, studentSAT, studentGPA) {
  if (studentSAT != null && school.sat_p25 != null && school.sat_p75 != null && school.sat_p75 > school.sat_p25) {
    let position = (studentSAT - school.sat_p25) / (school.sat_p75 - school.sat_p25)
    position = clamp(position, -1, 2)
    const gpaMod = studentGPA >= 3.7 ? 0.15 : studentGPA <= 3.2 ? -0.15 : 0
    return { strength: position + gpaMod, coarse: false }
  }
  // No student SAT, or no school SAT data — GPA alone, on a coarser scale, forced to limited evidence.
  if (studentGPA != null) {
    const strength = studentGPA >= 3.7 ? 1.0 : studentGPA <= 3.0 ? -0.5 : 0.3
    return { strength, coarse: true }
  }
  return { strength: 0, coarse: true }
}

// 7.3 — admissions band. Hard rule: never Likely below a 20% admit rate.
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

// 7.4 — evidence strength for the admissions comparison.
function admissionsEvidence(school, studentSAT, coarse) {
  if (studentSAT == null || school.sat_p25 == null || school.sat_p75 == null || school.admit_rate == null) {
    return 'limited'
  }
  if (coarse) return 'limited'
  if (school.test_optional) return 'moderate'
  return 'strong'
}

// 7.5 — affordability band. No "Unaffordable": that call belongs to the counselor.
function affordabilityBand(school, incomeBand, ceiling, homeState) {
  const netPrice = school.net_price?.[incomeBand]
  if (netPrice == null) {
    return { band: 'Unknown', netPrice: null, note: null }
  }

  const outOfStatePublic = Boolean(homeState) && school.ownership === 'public' && school.state !== homeState
  if (outOfStatePublic) {
    return {
      band: 'Needs Review',
      netPrice,
      note: "Net price shown is in-state. Out-of-state cost is typically higher — verify with the school's net price calculator.",
    }
  }

  if (netPrice <= ceiling) return { band: 'Likely Affordable', netPrice, note: null }
  return { band: 'Needs Review', netPrice, note: null }
}

// Short labels for the list table. Ranking here is the Likely / Target / Reach band — not a
// published league table. Distance is travel time, never miles. See files/03-DESIGN.md 4.4.
const MATCH_LABEL = {
  affordability: 'Affordability',
  program: 'Programme',
  proximity: 'Distance',
  admissions_realism: 'Ranking',
  environment: 'Campus',
  support: 'Support',
}

// 7.6 — unweighted points per dimension. fitScore multiplies these by the counselor's ranking.
function dimensionContributions(school, ctx) {
  const { criteria, admissions, affordability } = ctx
  const strengthOf = (criterion) => STRENGTH_MULT[criterion?.strength] ?? 1.0

  const interestCriteria = criteria.filter((c) => c.category === 'academic_interest')
  const geoCriterion = criteria.find((c) => c.category === 'geography')
  const envCriteria = criteria.filter((c) => c.category === 'environment' || c.category === 'size')
  const supportCriteria = criteria.filter((c) => c.category === 'support_needs')

  let affordabilityPoints = 0
  if (affordability.band === 'Likely Affordable') affordabilityPoints += 30
  if (affordability.band === 'Needs Review' && affordability.netPrice != null && ctx.ceiling != null) {
    if (affordability.netPrice <= ctx.ceiling * 1.1) affordabilityPoints += 12
  }
  if (school.tags?.includes('strong_merit')) affordabilityPoints += 8

  let programPoints = 0
  for (const c of interestCriteria) {
    const hasSpecialty = school.tags?.includes('marine_science_specialty') && c.value === 'marine_biology'
    if (school.programs?.includes(c.value)) {
      programPoints += (hasSpecialty ? 25 : 10) * strengthOf(c)
    }
    const awards = school.program_awards?.[c.value]
    if (awards != null && ctx.awardsTerciles) {
      if (awards >= ctx.awardsTerciles.high) programPoints += 15 * strengthOf(c)
      else if (awards >= ctx.awardsTerciles.mid) programPoints += 8 * strengthOf(c)
      else programPoints += 3 * strengthOf(c)
    }
  }

  let proximityPoints = 0
  if (geoCriterion) {
    const burden = travelBurden(geoCriterion.value?.home_state, school)
    if (burden.miles != null) {
      let base = 0
      if (geoCriterion.value?.prefer_far) {
        // 7.6 — invert proximity when the counselor said far from home.
        if (burden.miles > 350) base = 25
        else if (burden.miles > 180) base = 12
        else if (burden.miles > 60) base = 4
      } else if (geoCriterion.value?.max_miles && burden.miles <= geoCriterion.value.max_miles) base = 25
      else if (burden.miles < 300) base = 12
      else if (burden.text?.includes('direct flight')) base = 6
      proximityPoints = base * strengthOf(geoCriterion)
    }
  }

  let admissionsPoints = 0
  const cautiousReach = criteria.some((c) => c.value === 'cautious_reach')
  if (cautiousReach) {
    // 7.6 — "anxious about reaches": keep Reaches, but stop them floating to the top.
    if (admissions.band === 'Likely') admissionsPoints = 20
    else if (admissions.band === 'Target') admissionsPoints = 16
    else admissionsPoints = 2
  } else if (admissions.band === 'Target') admissionsPoints = 20
  else if (admissions.band === 'Likely') admissionsPoints = 12
  else admissionsPoints = 6

  let environmentPoints = 0
  for (const c of envCriteria) {
    const val = typeof c.value === 'string' ? c.value : c.value?.setting || c.value?.size
    if (val && (school.setting === val || String(school.size) === String(val))) {
      environmentPoints += 8 * strengthOf(c)
    } else if (val === 'small' && school.size != null && school.size < 5000) environmentPoints += 10 * strengthOf(c)
    else if (val === 'large' && school.size != null && school.size > 20000) environmentPoints += 10 * strengthOf(c)
    else if (val === 'warm' && WARM_STATES.has(school.state)) environmentPoints += 10 * strengthOf(c)
  }

  let supportPoints = 0
  for (const c of supportCriteria) {
    supportPoints += 15 * strengthOf(c)
  }

  return {
    affordability: affordabilityPoints,
    program: programPoints,
    proximity: proximityPoints,
    admissions_realism: admissionsPoints,
    environment: environmentPoints,
    support: supportPoints,
  }
}

function awardsTerciles(schools, slugs) {
  const values = schools
    .map((s) => Math.max(0, ...slugs.map((slug) => s.program_awards?.[slug] ?? 0)))
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
  if (values.length === 0) return null
  return {
    mid: values[Math.floor(values.length / 3)] ?? values[0],
    high: values[Math.floor((values.length * 2) / 3)] ?? values[values.length - 1],
  }
}

// 7.6 — fit score. Counselor-weighted, ranking only, never displayed.
function fitScore(school, ctx) {
  const weight = (dim) => RANK_WEIGHTS[ctx.priorityOrder.indexOf(dim)] ?? 1.0
  const points = dimensionContributions(school, ctx)
  const raw =
    points.affordability * weight('affordability') +
    points.program * weight('program') +
    points.proximity * weight('proximity') +
    points.admissions_realism * weight('admissions_realism') +
    points.environment * weight('environment') +
    points.support * weight('support')

  let flat = 0
  if (school.grad_rate_6yr != null && school.grad_rate_6yr > 0.65) flat += 12
  if (school.tags?.some((t) => NON_OBVIOUS_TAGS.includes(t))) flat += 8

  return raw + flat
}

// Strongest three dimensions that actually scored. The list table renders these; it does not
// pick schools. Ties break toward the counselor's priority order.
export function topMatchingDimensions(school, ctx, n = 3) {
  const points = dimensionContributions(school, ctx)
  return DIMENSIONS.map((dim) => ({ dim, label: MATCH_LABEL[dim], points: points[dim] }))
    .filter((row) => row.points > 0)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      return ctx.priorityOrder.indexOf(a.dim) - ctx.priorityOrder.indexOf(b.dim)
    })
    .slice(0, n)
}

// 7.7 — selection. 2-3 Likely, 3-4 Target, 2-3 Reach, 8-10 total. Never silently pad.
function selectSchools(scored) {
  const byBand = { Likely: [], Target: [], Reach: [] }
  for (const s of scored) byBand[s.admissions.band].push(s)
  for (const band of Object.keys(byBand)) byBand[band].sort((a, b) => b.fit - a.fit)

  const targetCounts = { Likely: 3, Target: 4, Reach: 3 }
  const minCounts = { Likely: 2, Target: 3, Reach: 2 }
  const selected = { Likely: [], Target: [], Reach: [] }

  for (const band of Object.keys(byBand)) {
    selected[band] = byBand[band].slice(0, targetCounts[band])
  }

  let total = () => selected.Likely.length + selected.Target.length + selected.Reach.length

  // Top up toward 8-10 from whichever band has spare inventory, if a band came up short.
  const order = ['Target', 'Likely', 'Reach']
  while (total() < 8) {
    let added = false
    for (const band of order) {
      if (selected[band].length < byBand[band].length && selected[band].length < targetCounts[band] + 2) {
        const next = byBand[band][selected[band].length]
        if (next) {
          selected[band].push(next)
          added = true
          if (total() >= 10) break
        }
      }
    }
    if (!added) break
  }

  // Trim from the top of the max range if we overshot.
  while (total() > 10) {
    if (selected.Reach.length > minCounts.Reach) selected.Reach.pop()
    else if (selected.Target.length > minCounts.Target) selected.Target.pop()
    else if (selected.Likely.length > minCounts.Likely) selected.Likely.pop()
    else break
  }

  let list = [...selected.Likely, ...selected.Target, ...selected.Reach]
  const usedIds = new Set(list.map((s) => s.id))

  // Step 4 — if fewer than 2 Likely Affordable made the cut, swap the lowest-fit Reach for the
  // highest-fit Likely Affordable school still available. Repeat up to twice.
  for (let attempt = 0; attempt < 2; attempt++) {
    const affordableCount = list.filter((s) => s.affordability.band === 'Likely Affordable').length
    if (affordableCount >= 2) break

    const candidate = scored
      .filter((s) => !usedIds.has(s.id) && s.affordability.band === 'Likely Affordable')
      .sort((a, b) => b.fit - a.fit)[0]
    if (!candidate) break

    const reachInList = list.filter((s) => s.admissions.band === 'Reach').sort((a, b) => a.fit - b.fit)
    const worstReach = reachInList[0]
    if (!worstReach) break

    list = list.filter((s) => s.id !== worstReach.id)
    list.push(candidate)
    usedIds.delete(worstReach.id)
    usedIds.add(candidate.id)
  }

  return list.sort((a, b) => b.fit - a.fit)
}

// Entry point. Takes the confirmed criteria, affordability inputs, and priority order from
// screens 2 and 3, and returns the finished 8-10 school list with every label already computed.
export function buildList({ schools, criteria, income_band, max_out_of_pocket, home_state, academic, priorityOrder }) {
  const knownPrograms = new Set(schools.flatMap((s) => s.programs ?? []))
  const interestPrograms = criteria
    .filter(
      (c) =>
        c.category === 'academic_interest' &&
        c.strength === 'required' &&
        typeof c.value === 'string' &&
        knownPrograms.has(c.value)
    )
    .map((c) => c.value)
  const geoCriterion = criteria.find((c) => c.category === 'geography' && c.strength === 'required')
  const requiredGeo = geoCriterion
    ? { home_state: geoCriterion.value?.home_state ?? home_state, max_miles: geoCriterion.value?.max_miles }
    : null
  const farGeo = criteria.find((c) => c.category === 'geography' && c.value?.prefer_far)
  const preferOutOfState = Boolean(farGeo && farGeo.strength !== 'flexible' && home_state)

  const surviving = schools.filter((school) =>
    passesHardFilters(school, {
      interestPrograms,
      requiredGeo,
      preferOutOfState,
      homeState: home_state,
      ceiling: max_out_of_pocket,
      incomeBand: income_band,
      studentSAT: academic?.sat,
    })
  )

  const awardsTercileCtx = awardsTerciles(surviving, interestPrograms)

  const scored = surviving.map((school) => {
    const { strength, coarse } = academicStrength(school, academic?.sat, academic?.gpa)
    const band = admissionsBand(school.admit_rate, strength)
    const evidence = admissionsEvidence(school, academic?.sat, coarse)
    const affordability = affordabilityBand(school, income_band, max_out_of_pocket, home_state)
    const burden = travelBurden(home_state, school)

    const admissions = {
      band,
      evidence,
      comparison:
        academic?.sat != null && school.sat_p25 != null && school.sat_p75 != null
          ? `SAT ${academic.sat} · middle 50% is ${school.sat_p25}-${school.sat_p75}${
              school.admit_rate != null ? ` · ${Math.round(school.admit_rate * 100)}% admit rate` : ''
            }`
          : school.admit_rate != null
          ? `${Math.round(school.admit_rate * 100)}% admit rate · no comparable test score on file`
          : 'Admissions data on file is incomplete for this school',
    }

    const fit = fitScore(school, {
      priorityOrder,
      criteria,
      admissions,
      affordability,
      ceiling: max_out_of_pocket,
      awardsTerciles: awardsTercileCtx,
    })
    const attendanceParts = school.cost_of_attendance
      ? [
          school.cost_of_attendance.tuition_in_state,
          school.cost_of_attendance.room_board,
          school.cost_of_attendance.books_personal,
        ]
      : null
    const totalAnnualCost =
      attendanceParts?.every((part) => typeof part === 'number')
        ? attendanceParts.reduce((total, part) => total + part, 0)
        : null

    return { ...school, admissions, affordability, travel: burden, fit, totalAnnualCost }
  })

  return selectSchools(scored)
}

export { DIMENSIONS }
