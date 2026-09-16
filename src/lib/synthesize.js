// Invents a prompt-specific catalog of recognizable schools. Facts are plausible, not verified.
// engine.js still assigns every admissions and affordability label from the numbers here.
import { PROGRAM_CHOICES } from './extract.js'
import { haversineMiles, MOUNTAIN_STATES, STATE_CENTROIDS, STATE_HUB, STATE_NAMES, WARM_STATES } from './geo.js'
import { fetchWithTimeout } from './progress.js'
import { SCHOOL_POOL } from './schoolPool.js'

const PROGRAM_LABEL = Object.fromEntries(PROGRAM_CHOICES.map((p) => [p.value, p.label]))
const CLUB_PATTERNS = [
  [/\bfootball\b/i, 'Football'],
  [/robotics(?:\s+club)?/i, 'Robotics club'],
  [/hackathon|coding club|computer club/i, 'Coding club'],
  [/debate/i, 'Debate team'],
  [/theater|theatre|drama/i, 'Theater'],
  [/newspaper|journalism/i, 'Student newspaper'],
  [/\bband\b|orchestra|music/i, 'Music ensembles'],
  [/volunteer|community service/i, 'Volunteer corps'],
  [/\bhiking\b|\boutdoors?\b|\bmountains?\b/i, 'Hiking club'],
  [/\bbasketball\b/i, 'Basketball'],
  [/\bathletics\b|\bsports\b/i, 'Athletics'],
]

export function hooksFrom(notes, criteria) {
  const text = String(notes ?? '')
  const programs = []
  for (const c of criteria ?? []) {
    if (c.category === 'academic_interest' && typeof c.value === 'string' && c.value) {
      if (!programs.includes(c.value)) programs.push(c.value)
    }
  }
  if (programs.length === 0) {
    for (const p of PROGRAM_CHOICES) {
      if (new RegExp(`\\b${p.label.replace(/[()]/g, '')}\\b`, 'i').test(text)) programs.push(p.value)
    }
  }
  const clubs = []
  for (const [re, label] of CLUB_PATTERNS) {
    if (re.test(text) && !clubs.includes(label)) clubs.push(label)
  }
  for (const c of criteria ?? []) {
    if (c.value === 'football' && !clubs.includes('Football')) clubs.push('Football')
    if (c.value === 'basketball' && !clubs.includes('Basketball')) clubs.push('Basketball')
    if (c.value === 'robotics' && !clubs.includes('Robotics club')) clubs.push('Robotics club')
    if (c.value === 'hiking' && !clubs.includes('Hiking club')) clubs.push('Hiking club')
  }
  const social = /\bsocial\b|outgoing|extroverted|greek|party|campus life/i.test(text)
  const quiet = /\bquiet\b|introverted|keeps to (himself|herself|themselves)/i.test(text)
  if (social && !clubs.includes('Student social clubs')) clubs.push('Student social clubs')
  const first = programs[0]
  return {
    programs,
    programLabel: PROGRAM_LABEL[first] ?? (first ? first.replaceAll('_', ' ') : 'the requested program'),
    clubs,
    social,
    quiet,
  }
}

function seedFrom(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

function rngFrom(seed) {
  let a = seed || 1
  return () => {
    a = Math.imul(a ^ (a >>> 15), 1 | a)
    a = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function inStateAnchors(abbr) {
  const name = STATE_NAMES[abbr]
  const home = STATE_CENTROIDS[abbr]
  if (!name || !home) return []
  return [
    { id: `${abbr.toLowerCase()}-state`, name: `${name} State University`, city: name, state: abbr, lat: home[0] + 0.25, lon: home[1] + 0.35, ownership: 'public', setting: 'town', size: 16000, tier: 'likely' },
    { id: `${abbr.toLowerCase()}-u`, name: `University of ${name}`, city: name, state: abbr, lat: home[0] - 0.2, lon: home[1] - 0.15, ownership: 'public', setting: 'city', size: 28000, tier: 'target' },
    { id: `${abbr.toLowerCase()}-college`, name: `${name} College`, city: name, state: abbr, lat: home[0] + 0.1, lon: home[1] - 0.4, ownership: 'private', setting: 'suburban', size: 2200, tier: 'target' },
  ]
}

function pickMixedPool(cap, preferStates) {
  const buckets = new Map()
  const states = []
  for (const s of SCHOOL_POOL) {
    if (!buckets.has(s.state)) {
      buckets.set(s.state, [])
      states.push(s.state)
    }
    buckets.get(s.state).push(s)
  }
  if (preferStates?.size) {
    states.sort((a, b) => Number(preferStates.has(b)) - Number(preferStates.has(a)))
  } else {
    states.sort((a, b) => (buckets.get(a)[0].lon ?? 0) - (buckets.get(b)[0].lon ?? 0))
  }
  const picked = []
  let added = true
  while (picked.length < cap && added) {
    added = false
    for (const st of states) {
      const bucket = buckets.get(st)
      if (!bucket?.length) continue
      picked.push(bucket.shift())
      added = true
      if (picked.length >= cap) break
    }
  }
  return picked
}

function pickAnchors(homeState, rng, limit, preferStates) {
  const cap = Math.max(16, limit || 16)
  if (!homeState) return pickMixedPool(cap, preferStates)
  const home = STATE_CENTROIDS[homeState]
  const local = SCHOOL_POOL.filter((s) => s.state === homeState)
  const anchors = local.length >= 3 ? local : [...local, ...inStateAnchors(homeState)]
  const rest = SCHOOL_POOL.filter((s) => !anchors.some((a) => a.id === s.id)).map((s) => ({
    s,
    dist: home ? haversineMiles(home, [s.lat, s.lon]) : 800,
  }))
  rest.sort((a, b) => a.dist - b.dist)
  const picked = [...anchors]
  for (const row of rest) {
    if (picked.length >= cap) break
    picked.push(row.s)
  }
  if (picked.length < cap) {
    for (const s of SCHOOL_POOL) {
      if (picked.length >= cap) break
      if (!picked.some((p) => p.id === s.id)) picked.push(s)
    }
  }
  return picked.slice(0, cap)
}

function inventStats(school, sat, cap, rng) {
  const student = sat ?? 1200
  let admit
  let p25
  let p75
  let net
  if (school.tier === 'likely') {
    admit = 0.62 + rng() * 0.24
    p25 = student - 190 - Math.round(rng() * 40)
    p75 = student - 10
    net = Math.round(cap * (0.52 + rng() * 0.38))
  } else if (school.tier === 'target') {
    admit = 0.34 + rng() * 0.18
    p25 = student - 70
    p75 = student + 90
    net = Math.round(cap * (0.88 + rng() * 0.4))
  } else {
    admit = 0.09 + rng() * 0.09
    p25 = student + 50 + Math.round(rng() * 70)
    p75 = p25 + 140
    net = Math.round(cap * (1.15 + rng() * 0.7))
  }
  p25 = clamp(Math.round(p25), 400, 1560)
  p75 = clamp(Math.round(p75), p25 + 40, 1600)
  const inState = school.ownership === 'public' ? Math.round(net * (school.tier === 'likely' ? 0.85 : 1.05)) : Math.round(net * 1.8)
  const outState = school.ownership === 'public' ? Math.round(inState * 1.55) : inState
  return { admit: Number(admit.toFixed(2)), p25, p75, net, inState, outState }
}

function clubLine(school, hooks, i) {
  const program = hooks.programLabel
  const named = (hooks.clubs ?? []).filter(Boolean)
  if (named.length) {
    const lead = named.join(', ')
    const variants = [
      `${lead}; ${program} student society`,
      `${lead} and intramurals`,
      `${lead}; student-org fair recruits first-years`,
    ]
    return variants[i % variants.length]
  }
  const variants = [
    `${program} student society, weekend events, student government`,
    `Undergraduate ${program.toLowerCase()} productions and a career club`,
    `Project teams in ${program.toLowerCase()}, plus community service`,
  ]
  return variants[i % variants.length]
}

function campusLine(school, hooks, i) {
  if (hooks.clubs.some((c) => /hiking/i.test(c))) {
    const hike = [
      'Trailheads and mountain access shape weekend plans',
      'Outdoor clubs run hiking trips into nearby ranges',
      'Campus sits close to high-country hiking',
    ]
    return hike[i % hike.length]
  }
  if (hooks.clubs.some((c) => /football/i.test(c))) {
    const games = [
      'Football Saturdays set the campus calendar',
      'Game-day crowds, then quieter weeknights on campus',
      'Residential campus with a football weekend rhythm',
    ]
    return games[i % games.length]
  }
  if (hooks.quiet) {
    const quiet = ['Quieter campus, most social life is in small clubs', 'Residential and low-key on weeknights, stronger on project teams', 'Close-knit, not a big party scene']
    return quiet[i % quiet.length]
  }
  if (hooks.social) {
    const lively = [
      'Busy weekends, Greek life and arts events most Fridays',
      'Urban campus with a strong social calendar and school spirit',
      'Big-game Saturdays and a downtown scene students actually use',
      'Residential campus, lively student union, easy to find a group',
    ]
    return lively[i % lively.length]
  }
  const mid = ['Mix of residential and commuter energy', 'Classic campus, clubs fill the evenings', 'Suburban campus with a reliable weekend scene']
  return mid[i % mid.length]
}

function extrasFor(schools, hooks) {
  const life = { id: 'life', label: 'Campus life', values: {} }
  const clubs = { id: 'clubs', label: 'Clubs worth a look', values: {} }
  const program = { id: 'major', label: `${hooks.programLabel} program`, prompt: `How ${hooks.programLabel} is offered`, values: {} }
  const columnLibrary = [program]
  for (const club of hooks.clubs.slice(0, 2)) {
    const id = club.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '')
    columnLibrary.push({
      id,
      label: club,
      prompt: `${club} on campus`,
      values: Object.fromEntries(schools.map((s, i) => [s.id, clubLine(s, { ...hooks, clubs: [club] }, i + 3)])),
    })
  }
  if (hooks.social) {
    columnLibrary.push({
      id: 'social',
      label: 'Campus social life',
      prompt: 'Campus social life and weekend scene',
      values: Object.fromEntries(schools.map((s, i) => [s.id, campusLine(s, hooks, i + 1)])),
    })
  }
  for (const s of schools) {
    life.values[s.id] = s.campus_life
    clubs.values[s.id] = s.clubs
    program.values[s.id] = `Direct path in ${hooks.programLabel} — studio and lecture mix`
  }
  return { columnLibrary, studentColumns: [life, clubs] }
}

function wantsNearby(criteria) {
  const geo = (criteria ?? []).find((c) => c.category === 'geography')
  if (!geo || geo.value?.prefer_far) return false
  return geo.value?.max_miles != null
}

export function composeCatalog({ notes, criteria, academic, homeState, incomeBand, cap, listSize }) {
  const hooks = hooksFrom(notes, criteria)
  const rng = rngFrom(seedFrom(`${notes}|${homeState}|${hooks.programs.join(',')}`))
  const band = incomeBand || '75001-110000'
  const ceiling = cap || 25000
  const sat = academic?.sat ?? null
  const warm = (criteria ?? []).some((c) => c.value === 'warm')
  const hiking = (criteria ?? []).some((c) => c.value === 'hiking')
  const home = wantsNearby(criteria) ? homeState || null : null
  const catalogSize = Math.max(18, (listSize || 10) + 10)
  const preferStates = hiking ? MOUNTAIN_STATES : warm ? WARM_STATES : null
  const picked = pickAnchors(hiking ? null : home, rng, catalogSize, preferStates)
  const schools = picked.map((base, i) => {
    const stats = inventStats(base, sat, ceiling, rng)
    const tags = []
    if (base.ownership === 'public' && base.tier === 'likely') tags.push('regional_public')
    if (base.size < 8000) tags.push('co_op')
    return {
      ...base,
      programs: [...hooks.programs],
      tags,
      admit_rate: stats.admit,
      sat_p25: stats.p25,
      sat_p75: stats.p75,
      test_optional: true,
      net_price: { [band]: stats.net, '75001-110000': stats.net },
      cost_sticker_in_state: stats.inState,
      cost_sticker_out_state: stats.outState,
      cost_of_attendance: {
        tuition_in_state: Math.round(stats.inState * 0.7),
        room_board: 14000,
        books_personal: 2800,
      },
      nearest_airport: STATE_HUB[base.state] ?? null,
      hbcu: Boolean(base.hbcu),
      clubs: clubLine(base, hooks, i),
      campus_life: campusLine(base, hooks, i),
      source: 'Synthetic catalog for this prompt — figures are plausible, not verified',
      last_verified: '2026-09-15',
    }
  })
  return { schools, extras: extrasFor(schools, hooks), hooks, source: 'overlay' }
}

function asNumber(n, fallback) {
  const v = Number(n)
  return Number.isFinite(v) ? v : fallback
}

function normalizeLlmSchools(raw, ctx, fallback) {
  if (!Array.isArray(raw) || raw.length < 6) return null
  const hooks = hooksFrom(ctx.notes, ctx.criteria)
  const band = ctx.incomeBand || '75001-110000'
  const home = STATE_CENTROIDS[ctx.homeState]
  const schools = raw.slice(0, Math.max(16, ctx.listSize ? ctx.listSize + 8 : 16)).map((row, i) => {
    const pool = SCHOOL_POOL.find((s) => s.id === row.id || s.name === row.name)
    const state = String(row.state || pool?.state || ctx.homeState || '').slice(0, 2).toUpperCase()
    const centroid = STATE_CENTROIDS[state] ?? home ?? [39.8, -98.5]
    const stats = inventStats(pool ?? { tier: i % 3 === 0 ? 'likely' : i % 3 === 1 ? 'target' : 'reach' }, ctx.academic?.sat, ctx.cap || 25000, () => 0.4)
    const net = asNumber(row.net_price?.[band] ?? row.net_price?.['75001-110000'], stats.net)
    return {
      id: String(row.id || pool?.id || `s${i}`),
      name: String(row.name || pool?.name || `Regional University ${i + 1}`),
      city: String(row.city || pool?.city || STATE_NAMES[state] || 'Campus'),
      state,
      lat: asNumber(row.lat, pool?.lat ?? centroid[0] + i * 0.05),
      lon: asNumber(row.lon, pool?.lon ?? centroid[1] - i * 0.05),
      ownership: row.ownership === 'private' ? 'private' : 'public',
      setting: ['city', 'suburban', 'town', 'rural'].includes(row.setting) ? row.setting : pool?.setting ?? 'city',
      size: asNumber(row.size, pool?.size ?? 12000),
      tier: pool?.tier ?? 'target',
      programs: [...hooks.programs],
      tags: [],
      admit_rate: clamp(asNumber(row.admit_rate, stats.admit), 0.05, 0.95),
      sat_p25: clamp(asNumber(row.sat_p25, stats.p25), 400, 1560),
      sat_p75: clamp(asNumber(row.sat_p75, stats.p75), 440, 1600),
      test_optional: true,
      net_price: { [band]: net, '75001-110000': net },
      cost_sticker_in_state: asNumber(row.tuition_in, stats.inState),
      cost_sticker_out_state: asNumber(row.tuition_out, stats.outState),
      cost_of_attendance: {
        tuition_in_state: asNumber(row.tuition_in, stats.inState) * 0.7,
        room_board: 14000,
        books_personal: 2800,
      },
      nearest_airport: STATE_HUB[state] ?? null,
      hbcu: false,
      clubs: clubLine(pool ?? { id: `s${i}` }, hooks, i),
      campus_life: String(row.campus_life || campusLine(pool ?? { id: `s${i}` }, hooks, i)),
      source: 'Synthetic catalog for this prompt — figures are plausible, not verified',
      last_verified: '2026-09-15',
    }
  })
  return { schools, extras: extrasFor(schools, hooks), hooks, source: 'llm' }
}

export async function loadSyntheticCatalog(ctx) {
  const fallback = composeCatalog(ctx)
  try {
    const res = await fetchWithTimeout(
      '/api/llm',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'catalog',
          notes: ctx.notes,
          criteria: ctx.criteria,
          academic: ctx.academic,
          home_state: ctx.homeState,
          income_band: ctx.incomeBand,
          max_out_of_pocket: ctx.cap,
          list_size: ctx.listSize ?? 10,
        }),
      },
      14000
    )
    if (!res.ok) return fallback
    const data = await res.json()
    const fromModel = normalizeLlmSchools(data.schools, ctx, fallback)
    if (!fromModel) return fallback
    const want = Math.max(18, (ctx.listSize || 10) + 6)
    if (fromModel.schools.length >= want) return fromModel
    const seen = new Set(fromModel.schools.map((s) => s.id))
    const extra = fallback.schools.filter((s) => !seen.has(s.id))
    const schools = [...fromModel.schools, ...extra].slice(0, want)
    return { ...fromModel, schools, extras: extrasFor(schools, fromModel.hooks) }
  } catch (err) {
    console.warn('[synthesize] catalog model unavailable, using overlay', err.message)
    return fallback
  }
}
