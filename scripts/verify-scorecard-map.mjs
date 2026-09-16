import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mergeRows } from '../api/scorecard.js'
import { normalizeScorecardSchool } from '../src/lib/scorecard-map.js'

const raw = JSON.parse(
  readFileSync(new URL('./fixtures/scorecard-school.json', import.meta.url), 'utf8')
)
const school = normalizeScorecardSchool(raw, {
  queriedSlugs: ['design'],
  tagsBySlug: {},
  unitIdToSlug: {},
  lastVerified: '2026-09-15',
})

function flattenScorecardFields(value, prefix = '', result = {}) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flattenScorecardFields(child, path, result)
    } else {
      result[path] = child
    }
  }
  return result
}

assert.equal(school.id, '166027')
assert.equal(school.name, 'Harvard University')
assert.equal(school.ownership, 'private')
assert.equal(school.setting, 'city')
assert.equal(school.admit_rate, 0.03)
assert.equal(school.sat_p25, 1490)
assert.equal(school.sat_p75, 1580)
assert.deepEqual(school.programs, ['design'])
assert.equal(school.program_names.design, 'Design and Applied Arts')
assert.equal(school.program_awards.design, 12)
assert.equal(school.source, 'College Scorecard (live)')
assert.equal(school.last_verified, '2026-09-15')

const flattenedSchool = normalizeScorecardSchool(flattenScorecardFields(raw), {
  queriedSlugs: ['design'],
})
assert.equal(flattenedSchool.name, 'Harvard University')
assert.equal(flattenedSchool.sat_p25, 1490)
assert.deepEqual(flattenedSchool.programs, ['design'])
assert.equal(flattenedSchool.program_awards.design, 12)

const missingCostsRaw = structuredClone(raw)
delete missingCostsRaw.latest.cost.tuition
delete missingCostsRaw.latest.cost.roomboard
delete missingCostsRaw.latest.cost.booksupply
const missingCostsSchool = normalizeScorecardSchool(missingCostsRaw)
assert.equal(missingCostsSchool.cost_of_attendance, null)

const duplicateProgramRaw = structuredClone(raw)
duplicateProgramRaw.latest.programs.cip_4_digit.push({
  code: '5004',
  title: 'Later Design Title',
  credential: { level: 3 },
  counts: { ipeds_awards2: 8 },
})
const duplicateProgramSchool = normalizeScorecardSchool(duplicateProgramRaw, {
  queriedSlugs: ['design'],
})
assert.equal(duplicateProgramSchool.program_names.design, 'Design and Applied Arts')
assert.equal(duplicateProgramSchool.program_awards.design, 20)

const firstProgramPage = flattenScorecardFields(raw)
const secondProgramPage = flattenScorecardFields(raw)
firstProgramPage['latest.programs.cip_4_digit'] = [
  raw.latest.programs.cip_4_digit[0],
]
secondProgramPage['latest.programs.cip_4_digit'] = [
  {
    ...raw.latest.programs.cip_4_digit[0],
    counts: { ipeds_awards2: 8 },
  },
]
const mergedFlattenedSchool = normalizeScorecardSchool(
  mergeRows([firstProgramPage, secondProgramPage])[0],
  { queriedSlugs: ['design'] }
)
assert.equal(mergedFlattenedSchool.program_awards.design, 20)

console.log('verify-scorecard-map ok')
