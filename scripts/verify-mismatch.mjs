import assert from 'node:assert/strict'
import { isSatMismatch, buildList, topMatchingDimensions } from '../src/lib/engine.js'

assert.equal(isSatMismatch({ sat_p25: 1460 }, 600), true)
assert.equal(isSatMismatch({ sat_p25: 720 }, 600), false)
assert.equal(isSatMismatch({ sat_p25: 800 }, 600), true)
assert.equal(isSatMismatch({ sat_p25: 799 }, 600), false)
assert.equal(isSatMismatch({ sat_p25: 1460 }, null), false)
assert.equal(isSatMismatch({}, 600), false)

const harvard = {
  id: 'harvard',
  name: 'Harvard University',
  city: 'Cambridge',
  state: 'MA',
  lat: 42.37,
  lon: -71.12,
  ownership: 'private',
  setting: 'city',
  size: 7000,
  admit_rate: 0.03,
  sat_p25: 1460,
  sat_p75: 1580,
  programs: ['design'],
  net_price: { '75001-110000': 15000 },
  tags: [],
}
const openDesign = {
  ...harvard,
  id: 'open-design',
  name: 'Open Design College',
  admit_rate: 0.7,
  sat_p25: 720,
  sat_p75: 980,
  net_price: { '75001-110000': 12000 },
}

const list = buildList({
  schools: [harvard, openDesign],
  criteria: [{ id: 'c1', category: 'academic_interest', value: 'design', strength: 'required' }],
  income_band: '75001-110000',
  max_out_of_pocket: 25000,
  home_state: 'PA',
  academic: { sat: 600, gpa: 3.0 },
  priorityOrder: ['affordability', 'program', 'proximity', 'admissions_realism', 'environment', 'support'],
})

assert.equal(list.some((s) => s.id === 'harvard'), false)
assert.equal(list.some((s) => s.id === 'open-design'), true)

const smallProgram = {
  ...openDesign,
  id: 'small-design',
  name: 'Small Design College',
  program_awards: { design: 10 },
}
const largeProgram = {
  ...openDesign,
  id: 'large-design',
  name: 'Large Design College',
  sat_p25: 730,
  program_awards: { design: 400 },
}
const ranked = buildList({
  schools: [harvard, smallProgram, largeProgram],
  criteria: [{ id: 'c1', category: 'academic_interest', value: 'design', strength: 'required' }],
  income_band: '75001-110000',
  max_out_of_pocket: 25000,
  home_state: 'PA',
  academic: { sat: 600, gpa: 3.0 },
  priorityOrder: ['program', 'affordability', 'proximity', 'admissions_realism', 'environment', 'support'],
})
assert.equal(ranked.some((s) => s.id === 'harvard'), false)
assert.ok(ranked.findIndex((s) => s.id === 'large-design') < ranked.findIndex((s) => s.id === 'small-design'))

const nullableSchool = {
  ...openDesign,
  id: 'nullable-design',
  size: null,
  cost_of_attendance: {
    tuition_in_state: 12000,
    room_board: null,
    books_personal: 2000,
  },
}
const nullableList = buildList({
  schools: [nullableSchool],
  criteria: [
    { id: 'c1', category: 'academic_interest', value: 'design', strength: 'required' },
    { id: 'c2', category: 'size', value: 'small', strength: 'preferred' },
  ],
  income_band: '75001-110000',
  max_out_of_pocket: 25000,
  home_state: 'PA',
  academic: { sat: 600, gpa: 3.0 },
  priorityOrder: ['environment', 'program', 'affordability', 'proximity', 'admissions_realism', 'support'],
})
assert.equal(nullableList[0].totalAnnualCost, null)
assert.equal(
  topMatchingDimensions(
    nullableSchool,
    {
      criteria: [{ id: 'c2', category: 'size', value: 'small', strength: 'preferred' }],
      admissions: { band: 'Target' },
      affordability: { band: 'Unknown', netPrice: null },
      priorityOrder: ['environment', 'program', 'affordability', 'proximity', 'admissions_realism', 'support'],
      ceiling: 25000,
    },
    6
  ).some((match) => match.dim === 'environment'),
  false,
  'unknown enrollment must not count as small'
)

const nearPa = {
  ...openDesign,
  id: 'near-pa',
  name: 'Near PA Design',
  state: 'PA',
  lat: 40.0,
  lon: -77.0,
}
const noDistanceCtx = {
  criteria: [{ id: 'c1', category: 'academic_interest', value: 'design', strength: 'required' }],
  admissions: { band: 'Likely' },
  affordability: { band: 'Unknown', netPrice: null },
  priorityOrder: ['proximity', 'program', 'affordability', 'admissions_realism', 'environment', 'support'],
  ceiling: 25000,
}
assert.equal(
  topMatchingDimensions(nearPa, noDistanceCtx, 6).some((match) => match.dim === 'proximity'),
  false,
  'no distance mention must not score closeness'
)
assert.equal(
  topMatchingDimensions(
    nearPa,
    {
      ...noDistanceCtx,
      criteria: [
        ...noDistanceCtx.criteria,
        { id: 'g1', category: 'geography', value: { home_state: 'PA', max_miles: null, prefer_far: false }, strength: 'preferred' },
      ],
    },
    6
  ).some((match) => match.dim === 'proximity'),
  false,
  'home state alone must not score closeness'
)
assert.equal(
  topMatchingDimensions(
    nearPa,
    {
      ...noDistanceCtx,
      criteria: [
        { id: 'g2', category: 'geography', value: { home_state: 'PA', max_miles: 300, prefer_far: false }, strength: 'preferred' },
      ],
    },
    6
  ).some((match) => match.dim === 'proximity'),
  true,
  'close-to-home cap should score nearby schools'
)

console.log('verify-mismatch ok')
