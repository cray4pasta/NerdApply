import assert from 'node:assert/strict'
import { CIP_BY_SLUG, cipsForSlugs, slugForCip, requiredProgramSlugs } from '../src/lib/cip.js'
import { extractFallback } from '../src/lib/extract.js'

assert.deepEqual(CIP_BY_SLUG.design, ['5004'])
assert.ok(cipsForSlugs(['design']).includes('5004'))
assert.equal(slugForCip('5004'), 'design')
assert.deepEqual(
  requiredProgramSlugs([
    { category: 'academic_interest', strength: 'required', value: 'design' },
    { category: 'academic_interest', strength: 'preferred', value: 'art' },
  ]),
  ['design']
)

const extracted = extractFallback('Maya, SAT 600, interested in graphic design')
const row = extracted.criteria.find((c) => c.category === 'academic_interest')
assert.equal(row?.value, 'design')
console.log('verify-cip ok')
