import assert from 'node:assert/strict'
import { isSatMismatch, buildList } from '../src/lib/engine.js'

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
console.log('verify-mismatch ok')
