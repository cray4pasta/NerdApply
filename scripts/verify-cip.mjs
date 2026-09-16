import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
assert.equal(row?.label, 'Design')

const llmSource = readFileSync(new URL('../api/llm.js', import.meta.url), 'utf8')
assert.match(llmSource, /art,\s*design,\s*marine_biology/)
assert.match(llmSource, /"graphic design".*slug "design".*label "Design"/is)

const snapshotTags = JSON.parse(
  readFileSync(new URL('../src/data/program-tags.json', import.meta.url), 'utf8')
)
const snapshotDesignSchools = Object.values(snapshotTags).filter((school) => school.programs?.includes('design'))
assert.ok(snapshotDesignSchools.length >= 4, 'expected several snapshot design schools')
assert.ok(
  snapshotDesignSchools.every((school) => school.program_names?.design),
  'expected a short design program name for every tagged snapshot school'
)
console.log('verify-cip ok')
