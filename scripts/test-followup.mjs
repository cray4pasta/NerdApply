import { extractFallback } from '../src/lib/extract.js'
import { classifyFollowup } from '../src/lib/followup.js'
import { composeCatalog } from '../src/lib/synthesize.js'
import { toTableRow } from '../src/lib/listRows.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const schools = [{ id: 'pitt', name: 'University of Pittsburgh', band: 'Target' }]
const prior = extractFallback('Pennsylvania junior. Interested in journalism. 3.5 GPA, 1280 SAT. Plays football.')

const sports = classifyFollowup('I think he wants to pursue sports.', {
  schools,
  criteria: prior.criteria,
})
assert(sports.type === 'revise_criteria', `sports follow-up should revise criteria, got ${sports.type}`)
assert(
  sports.criteria.some((c) => c.category === 'academic_interest' && /sport/i.test(`${c.value} ${c.label}`)),
  'sports follow-up should set a sports academic focus'
)
assert(
  !sports.criteria.some((c) => c.category === 'academic_interest' && c.value === 'journalism'),
  'sports follow-up should replace the previous major'
)
assert(
  sports.criteria.some((c) => String(c.label).startsWith('SAT')),
  'sports follow-up should keep SAT'
)
assert(
  sports.criteria.some((c) => c.value === 'football' || /football/i.test(c.label)),
  'sports follow-up should keep football'
)
assert(/sports program/i.test(sports.message), `should say sports program, got: ${sports.message}`)
assert(/replacing/i.test(sports.message) && /journalism/i.test(sports.message), `should name the replaced major, got: ${sports.message}`)
assert(/SAT|1280|GPA|football|Pennsylvania/i.test(sports.message), `should mention kept facts, got: ${sports.message}`)

const ask = classifyFollowup('Why is University of Pittsburgh a Target?', { schools, criteria: prior.criteria })
assert(ask.type === 'question', `school question should stay a question, got ${ask.type}`)

const reaches = classifyFollowup('too many reaches', { schools, criteria: prior.criteria })
assert(reaches.type === 'rebuild', `too many reaches should still rebuild, got ${reaches.type}`)

const notes =
  'Pennsylvania junior. Interested in journalism. 3.5 GPA, 1280 SAT. Plays football.\n\nI think he wants to pursue sports.'
const rebuilt = composeCatalog({
  notes,
  criteria: sports.criteria,
  academic: prior.academic,
  homeState: prior.home_state,
  incomeBand: '75001-110000',
  cap: 25000,
  listSize: 10,
})
assert(
  rebuilt.schools.every((s) => s.programs?.includes('sports')),
  'rebuilt overlay should stamp sports on every school'
)
assert(
  rebuilt.schools.every((s) => {
    const line = toTableRow(s, '', 25000, 'PA', sports.criteria).programLine
    return /sport/i.test(line) && !/journalism/i.test(line)
  }),
  'Programme column should say sports, not journalism'
)
assert(
  rebuilt.schools.every((s) => /sport|athletics|football/i.test(s.clubs)),
  'club lines should mention sports or football after the follow-up'
)

console.log('test-followup ok', sports.message)
