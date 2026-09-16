import assert from 'node:assert/strict'
import { extractFallback } from '../src/lib/extract.js'
import { composeCatalog } from '../src/lib/synthesize.js'
import { toTableRow } from '../src/lib/listRows.js'

const agriculture = [{ category: 'academic_interest', value: 'agriculture', strength: 'required' }]

const unknownHome = composeCatalog({
  notes: 'Chloe. GPA around 3.2. Wants agriculture. East Coast preferred. Budget around $35k total per year.',
  criteria: agriculture,
  academic: { gpa: 3.2 },
  homeState: null,
  incomeBand: '75001-110000',
  cap: 35000,
  listSize: 10,
})

const unknownStates = unknownHome.schools.map((s) => s.state)
const unknownCounts = unknownStates.reduce((acc, st) => {
  acc[st] = (acc[st] || 0) + 1
  return acc
}, {})
assert.ok(new Set(unknownStates).size >= 6, `unknown home should mix states, got ${[...new Set(unknownStates)]}`)
assert.ok((unknownCounts.PA || 0) <= 2, `unknown home should not dump Pennsylvania, got ${unknownCounts.PA || 0} PA schools`)
assert.notEqual(unknownHome.schools[0].state, 'PA', 'first overlay school should not default to PA')

const paHome = composeCatalog({
  notes: 'Pennsylvania student, agriculture, 3.2 GPA.',
  criteria: agriculture,
  academic: { gpa: 3.2 },
  homeState: 'PA',
  incomeBand: '75001-110000',
  cap: 25000,
  listSize: 10,
})
const paHomeCounts = paHome.schools.reduce((acc, s) => {
  acc[s.state] = (acc[s.state] || 0) + 1
  return acc
}, {})
assert.ok(
  (paHomeCounts.PA || 0) <= 2,
  `home state without a distance ask should not dump Pennsylvania, got ${paHomeCounts.PA || 0}`
)

const paNear = composeCatalog({
  notes: 'Pennsylvania student, agriculture, close to home.',
  criteria: [
    ...agriculture,
    {
      category: 'geography',
      value: { home_state: 'PA', max_miles: 300, prefer_far: false },
      strength: 'preferred',
    },
  ],
  academic: { gpa: 3.2 },
  homeState: 'PA',
  incomeBand: '75001-110000',
  cap: 25000,
  listSize: 10,
})
assert.ok(
  paNear.schools.filter((s) => s.state === 'PA').length >= 3,
  'close-to-home Pennsylvania should still keep in-state anchors'
)

const footballCatalog = composeCatalog({
  notes: 'Interested in acting and entertainment. Plays football. 3.6 GPA, 1280 SAT.',
  criteria: [{ category: 'academic_interest', value: 'performing_arts', strength: 'required' }],
  academic: { gpa: 3.6, sat: 1280 },
  homeState: 'PA',
  incomeBand: '75001-110000',
  cap: 25000,
  listSize: 10,
})
assert.ok(
  footballCatalog.hooks.clubs.some((c) => /football/i.test(c)),
  `football notes should hook a football club, got ${footballCatalog.hooks.clubs}`
)
assert.ok(
  footballCatalog.schools.every((s) => /football/i.test(s.clubs)),
  'every overlay club line should mention football'
)
assert.ok(
  footballCatalog.schools.every((s) => !/design-build|design club/i.test(s.clubs)),
  'football notes must not invent design clubs'
)

const politicsNotes = 'Pennsylvania junior. Interested in politics. 3.5 GPA, 1280 SAT.'
const politicsExtract = extractFallback(politicsNotes)
const politicsCriteria = politicsExtract.criteria
const politicsCatalog = composeCatalog({
  notes: politicsNotes,
  criteria: politicsCriteria,
  academic: politicsExtract.academic,
  homeState: politicsExtract.home_state,
  incomeBand: '75001-110000',
  cap: 25000,
  listSize: 10,
})
assert.ok(
  politicsCatalog.schools.every((s) => s.programs?.includes('political_science')),
  'overlay schools should be tagged political_science'
)
assert.ok(
  politicsCatalog.schools.every((s) => {
    const line = toTableRow(s, '', 25000, 'PA', politicsCriteria).programLine
    return line !== 'Programme not published' && /political/i.test(line)
  }),
  'politics lists must show a political science programme, not “not published”'
)

const journalismNotes = 'Pennsylvania junior. Interested in journalism. 3.5 GPA, 1280 SAT.'
const journalismExtract = extractFallback(journalismNotes)
const journalismCatalog = composeCatalog({
  notes: journalismNotes,
  criteria: journalismExtract.criteria,
  academic: journalismExtract.academic,
  homeState: journalismExtract.home_state,
  incomeBand: '75001-110000',
  cap: 25000,
  listSize: 10,
})
assert.ok(
  journalismCatalog.schools.every((s) => s.programs?.includes('journalism')),
  'unnamed majors should still stamp overlay programs'
)
assert.ok(
  journalismCatalog.schools.every((s) => {
    const line = toTableRow(s, '', 25000, 'PA', journalismExtract.criteria).programLine
    return line !== 'Programme not published' && /journalism/i.test(line)
  }),
  'unknown majors must show in Programme, not “not published”'
)

console.log('verify-overlay-home ok', {
  unknown: unknownHome.schools.slice(0, 8).map((s) => `${s.name} ${s.state}`),
  pa: paHome.schools.slice(0, 5).map((s) => `${s.name} ${s.state}`),
})
