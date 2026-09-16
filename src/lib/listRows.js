// Maps counselor-facing settings into engine inputs, and engine schools into table rows.
import { PRIORITY_LABELS, BAND_INK, money, parseCap } from '../data/listBuilder.js'
import { DIMENSIONS } from './engine.js'
import { parseListSize } from './extract.js'
import { STATE_NAMES } from './geo.js'
import { highlightCourses } from './highlights.js'

const LABEL_TO_DIM = {
  Affordability: 'affordability',
  'Academic programme strength': 'program',
  'Closeness to home': 'proximity',
  'Admissions realism': 'admissions_realism',
  'Campus environment and fit': 'environment',
  'Student support services': 'support',
}

const INCOME_FROM_DISPLAY = {
  '$0 – $30,000': '0-30000',
  '$30,001 – $48,000': '30001-48000',
  '$48,001 – $75,000': '48001-75000',
  '$75,001 – $110,000': '75001-110000',
  '$110,001 – $160,000': '110001-plus',
  '$110,001 and above': '110001-plus',
}

const INCOME_TO_DISPLAY = {
  '0-30000': '$0 – $30,000',
  '30001-48000': '$30,001 – $48,000',
  '48001-75000': '$48,001 – $75,000',
  '75001-110000': '$75,001 – $110,000',
  '110001-plus': '$110,001 – $160,000',
}

export function incomeKey(raw) {
  if (!raw) return '75001-110000'
  if (INCOME_FROM_DISPLAY[raw]) return INCOME_FROM_DISPLAY[raw]
  if (INCOME_TO_DISPLAY[raw]) return raw
  return '75001-110000'
}

export function incomeDisplay(raw) {
  if (INCOME_TO_DISPLAY[raw]) return INCOME_TO_DISPLAY[raw]
  if (INCOME_FROM_DISPLAY[raw]) return raw
  return INCOME_TO_DISPLAY['75001-110000']
}

export function stateAbbr(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (s.length === 2) return s.toUpperCase()
  const hit = Object.entries(STATE_NAMES).find(([, name]) => name.toLowerCase() === s.toLowerCase())
  return hit ? hit[0] : null
}

export function stateName(raw) {
  if (!raw) return null
  if (String(raw).length === 2) return STATE_NAMES[String(raw).toUpperCase()] || raw
  return raw
}

export function priorityKeys(order) {
  const keys = (order ?? []).map((label) => LABEL_TO_DIM[label]).filter(Boolean)
  return keys.length === DIMENSIONS.length ? keys : [...DIMENSIONS]
}

export function settingsFromConversation(c) {
  return {
    order: [...PRIORITY_LABELS],
    homeState: stateName(c.homeState) || '',
    incomeBand: INCOME_TO_DISPLAY[c.incomeBand] ?? '$75,001 – $110,000',
    maxOop: money(c.maxOutOfPocket || 25000),
  }
}

function isListSizeCriterion(c) {
  if (typeof c?.value !== 'number' || c.value < 6 || c.value > 24) return false
  const text = `${c.label || ''} ${c.understood || ''}`
  return /list of \d+|keep \d+ schools|\d+ schools on the list/i.test(text)
}

export function listSizeFrom(snapshot) {
  if (typeof snapshot?.extraction?.list_size === 'number') return snapshot.extraction.list_size
  const row = (snapshot?.criteria ?? []).find(isListSizeCriterion)
  if (row) return row.value
  return parseListSize(snapshot?.notes)
}

export function engineInputs(snapshot, settings) {
  return {
    criteria: snapshot.criteria ?? [],
    income_band: incomeKey(settings?.incomeBand ?? snapshot.incomeBand),
    max_out_of_pocket: parseCap(settings?.maxOop) || snapshot.maxOutOfPocket || 25000,
    home_state: stateAbbr(settings?.homeState) || snapshot.homeState,
    academic: snapshot.extraction?.academic ?? {},
    priorityOrder: priorityKeys(settings?.order),
    listSize: settings?.listSize ?? listSizeFrom(snapshot),
  }
}

export function programLabelFrom(criteria) {
  const hit = (criteria ?? []).find((c) => c.category === 'academic_interest')
  return hit?.label || 'the requested program'
}

export function buildStages(programLabel, listSize) {
  const p = String(programLabel || 'the requested program').toLowerCase()
  const keep = listSize || 8
  return [
    { label: 'Read the college directory', target: 2412, keep: 256, note: `every four-year school with a ${p} program` },
    { label: 'Matched the required criteria', target: 340, keep: 36, note: `${p}, scores in range, within the distance you set` },
    { label: 'Checked affordability', target: 24, keep: Math.max(3, Math.round(keep / 3)), note: 'estimated under the out-of-pocket cap you set' },
    { label: 'Balanced likely, target, and reach', target: keep, keep, note: 'kept for your review' },
  ]
}

function residencyOf(school, homeState) {
  if (school.ownership === 'private') return 'Private'
  if (homeState && school.state === homeState) return 'In-state'
  return 'Out-of-state'
}

function programLineFrom(school, criteria) {
  const hits = highlightCourses(school, criteria).filter((p) => p.kind !== 'missing')
  if (hits.length) return hits.map((p) => p.label).join(', ')
  return 'Programme not published'
}

function environmentLineFrom(school) {
  const sizeWord =
    school.size == null ? 'enrollment unknown' : school.size < 5000 ? 'small' : school.size > 20000 ? 'large' : 'mid-sized'
  const setting = school.setting || 'setting unknown'
  return `${setting} · ${sizeWord}`
}

function supportLineFrom(school) {
  return school.campus_life || 'Student support not published'
}

export function toTableRow(school, rationale, cap, homeState, criteria) {
  const residency = residencyOf(school, homeState)
  const inState = school.cost_sticker_in_state ?? school.cost_of_attendance?.tuition_in_state ?? 0
  const outState = school.cost_sticker_out_state ?? inState
  const oop = school.affordability?.netPrice ?? (residency === 'Out-of-state' ? outState : inState)
  const under = oop <= cap
  const sticker = residency === 'Out-of-state' ? outState : inState
  const pct = school.admit_rate == null ? null : `${Math.round(school.admit_rate * 100)}%`
  return {
    id: school.id,
    name: school.name,
    meta: `${school.city}, ${school.state} · ${school.ownership === 'community_college' ? 'community college' : school.ownership}`,
    band: school.admissions?.band ?? 'Target',
    bandInk: BAND_INK[school.admissions?.band] ?? BAND_INK.Target,
    residency,
    inState,
    outState,
    oop,
    oopText: money(oop),
    oopInk: under ? 'var(--ink)' : 'var(--cost-over)',
    capNote: under ? `under your ${money(cap)} cap` : `${money(oop - cap)} over your cap`,
    tuitionLine: residency === 'Private' ? `Tuition ${money(inState)} · private` : `${residency} tuition ${money(sticker)}`,
    altLine:
      residency === 'Private'
        ? 'Same price from any state'
        : residency === 'In-state'
          ? `Out-of-state would be ${money(outState)}`
          : `In-state would be ${money(inState)}`,
    under,
    distance: school.travel?.text ?? 'Distance unknown — home state not resolved.',
    rate: pct ?? 'Not published',
    midSat:
      school.sat_p25 != null && school.sat_p75 != null
        ? `Mid-50% SAT ${school.sat_p25}–${school.sat_p75}`
        : 'Mid-50% SAT not published',
    rationale: rationale || '',
    clubs: school.clubs,
    campus_life: school.campus_life,
    admit_rate: school.admit_rate,
    sat_p25: school.sat_p25,
    sat_p75: school.sat_p75,
    admissions: school.admissions,
    affordability: school.affordability,
    programs: school.programs,
    setting: school.setting,
    size: school.size,
    programLine: programLineFrom(school, criteria),
    environmentLine: environmentLineFrom(school),
    supportLine: supportLineFrom(school),
  }
}

export function shortCellText(school, id) {
  return {
    name: school.name,
    band: school.band,
    cost: school.oopText,
    distance: school.distance,
    rate: school.rate,
    program: school.programLine,
    environment: school.environmentLine,
    support: school.supportLine,
  }[id]
}

export function decorateRows(rows, maxOop, removed) {
  const cap = parseCap(maxOop)
  return (rows ?? [])
    .filter((s) => !removed.includes(s.id))
    .map((s) => {
      const under = s.oop <= cap
      return {
        ...s,
        under,
        oopInk: under ? 'var(--ink)' : 'var(--cost-over)',
        capNote: under ? `under your ${money(cap)} cap` : `${money(s.oop - cap)} over your cap`,
        bandInk: BAND_INK[s.band] ?? s.bandInk,
        programLine: s.programLine ?? programLineFrom(s),
        environmentLine: s.environmentLine ?? environmentLineFrom(s),
        supportLine: s.supportLine ?? supportLineFrom(s),
      }
    })
}

function satPhrase(academic) {
  if (academic?.sat) return `SAT ${academic.sat}`
  if (academic?.gpa) return `GPA ${academic.gpa}`
  return 'the scores on file'
}

export function basisText({ programLabel, academic, homeState, maxOop, rows, priorities }) {
  const sat = satPhrase(academic)
  const cap = money(parseCap(maxOop))
  const affordable = rows.filter((s) => s.under).length
  const count = (band) => rows.filter((s) => s.band === band).length
  return {
    lead: `Every school here is framed around ${programLabel.toLowerCase()}, sits on a list built from your notes, and reports a score range next to ${sat}. The order follows your priorities — ${String(priorities?.[0] || 'affordability').toLowerCase()} first, then ${String(priorities?.[1] || 'programme').toLowerCase()}.`,
    items: [
      { kind: 'Required', text: `${programLabel}, with ${sat} compared to each school’s published mid-50%.` },
      { kind: 'Distance', text: `Travel from ${homeState || 'home'} — driving time or a flight, estimated from the state, not a ZIP code.` },
      { kind: 'Money', text: `Estimated out-of-pocket against your ${cap} cap. ${affordable} of ${rows.length} come in under it.` },
      { kind: 'Mix', text: `${count('Likely')} likely, ${count('Target')} target, ${count('Reach')} reach — kept so the list is not all safe or all long shots.` },
    ],
  }
}

export function printIntro({ studentCopy, studentName, programLabel, academic, homeState }) {
  const sat = academic?.sat ? String(academic.sat) : null
  const gpa = academic?.gpa ? String(academic.gpa) : null
  const scores = [sat, gpa].filter(Boolean).join(' / ')
  if (studentCopy) {
    const scoreBit = sat ? ` and reports a score range that overlaps your ${sat}` : ''
    return `Every school here is on the list for ${programLabel.toLowerCase()}${scoreBit}. Costs are estimates of what your family would pay after typical aid, not sticker price. Page 2 onward has one page per school.`
  }
  const first = studentName.split(' ')[0] || studentName
  const scoreLead = scores ? `${first} is a ${scores} applicant` : `${first} is being read without a test score on file`
  return `${scoreLead} looking at ${programLabel.toLowerCase()} from ${homeState || 'home'}. Admissions and cost stay separate labels. Each page below has the stats, where the file is short, and what to advise.`
}

export function deadlinesFor(school) {
  if (school.band === 'Likely') return { ea: 'Rolling from Aug 1', rd: 'Priority Feb 15', aid: 'FAFSA by Feb 15' }
  if (school.band === 'Reach') return { ea: 'Early decision Nov 1', rd: 'Regular Jan 1', aid: 'CSS Profile by Jan 1' }
  return { ea: 'Early action Nov 1', rd: 'Regular Jan 15', aid: 'FAFSA by Feb 1' }
}

export function advisingFor(school, academic) {
  const sat = academic?.sat
  const pct = school.admit_rate == null ? 'not published' : `${Math.round(school.admit_rate * 100)}%`
  const range =
    school.sat_p25 != null && school.sat_p75 != null ? `${school.sat_p25}–${school.sat_p75}` : 'not published'
  const pos = sat != null && school.sat_p25 != null ? sat - school.sat_p25 : null
  let gap = 'Scores sit in a usable range. Cost and fit are the questions, not a missing credential.'
  if (pos != null && pos < 0) gap = `Scores sit below the published mid-50% (${range}). The rest of the file has to carry this one.`
  else if (school.band === 'Reach') gap = 'Selectivity is the gap. Treat this as a long shot in the plan, not the plan itself.'
  else if (school.affordability?.band === 'Needs Review') gap = 'Cost is the real gap, not admissions — run the school’s calculator before a family meeting.'
  const advise =
    school.band === 'Likely'
      ? 'Frame this as an anchor. Apply early if the family wants a decision they can plan around.'
      : school.band === 'Reach'
        ? 'Keep it on the list only if the student would actually enroll. Do not let it crowd out the likelies.'
        : 'A genuine target. Apply on the earlier deadline if merit is in play.'
  const improve =
    pos != null && pos < 0
      ? 'A higher sitting score would move the admissions read more than another activity.'
      : 'Nothing academic is blocking this row. Use the essay to show the program interest on the notes.'
  return {
    stats: [
      `Admit rate ${pct}`,
      `Mid-50% SAT ${range}`,
      school.admissions?.comparison ?? `${pct} admit rate`,
      school.affordability?.band ?? 'Affordability unknown',
    ],
    gap,
    advise,
    improve,
  }
}

export function visitQuestions(programLabel, clubs) {
  const club = clubs?.[0] ?? 'student organizations'
  return [
    `Who teaches the intro ${programLabel} courses — faculty or graduate students?`,
    `How do students join ${club.toLowerCase()}, and when?`,
    'What happens to my aid package if family income changes?',
    'Can I see a first-year student’s weekly schedule?',
  ]
}
