import { extractFallback } from '../src/lib/extract.js'
import { classifyFollowup } from '../src/lib/followup.js'
import { composeCatalog } from '../src/lib/synthesize.js'
import { engineInputs, toTableRow } from '../src/lib/listRows.js'

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

const med = classifyFollowup('he wants to switch to med school', {
  schools,
  criteria: prior.criteria,
})
assert(med.type === 'revise_criteria', `switch to med school should revise criteria, got ${med.type}`)
assert(
  med.criteria.filter((c) => c.category === 'academic_interest').length === 1,
  'switch to med school should leave a single academic focus'
)
assert(
  med.criteria.some((c) => c.category === 'academic_interest' && c.value === 'biology'),
  'switch to med school should map to undergraduate biology / pre-med, not a graduate med-school program'
)
assert(
  !med.criteria.some((c) => /med[_ ]?school|medical_school/i.test(String(c.value))),
  'switch to med school should not invent a med-school graduate program'
)
assert(
  !med.criteria.some((c) => c.category === 'academic_interest' && c.value === 'journalism'),
  'switch to med school should replace the previous major'
)
assert(med.criteria.some((c) => String(c.label).startsWith('SAT')), 'switch to med school should keep SAT')
assert(med.criteria.some((c) => String(c.label).startsWith('GPA')), 'switch to med school should keep GPA')
assert(
  med.criteria.some((c) => c.value === 'football' || /football/i.test(c.label)),
  'switch to med school should keep football'
)
assert(/biology|pre-?med/i.test(med.message), `should say it is updating around biology / pre-med, got: ${med.message}`)
assert(/replacing/i.test(med.message) && /journalism/i.test(med.message), `should name the replaced major, got: ${med.message}`)
assert(/SAT|1280|GPA|football|Pennsylvania/i.test(med.message), `should mention kept facts, got: ${med.message}`)

const biology = classifyFollowup('he wants to pursue biology', { schools, criteria: prior.criteria })
assert(biology.type === 'revise_criteria', `pursue biology should still revise criteria, got ${biology.type}`)
assert(
  biology.criteria.some((c) => c.category === 'academic_interest' && c.value === 'biology'),
  'pursue biology should set biology as the academic focus'
)
assert(
  !biology.criteria.some((c) => c.category === 'academic_interest' && c.value === 'journalism'),
  'pursue biology should replace the previous major'
)

const hedgedLaw = extractFallback(
  'Virginia junior. Interested in law but not sure. 3.8 GPA, 1400 SAT. Plays football. Close to home.'
)
assert(
  hedgedLaw.criteria.some((c) => c.value === 'law' && c.strength === 'preferred'),
  'hedged law notes should start as preferred law'
)
const lawLock = classifyFollowup('actually law', { schools, criteria: hedgedLaw.criteria })
assert(lawLock.type === 'revise_criteria', `"actually law" should revise criteria, got ${lawLock.type}`)
const lockedLaw = lawLock.criteria.filter((c) => c.category === 'academic_interest')
assert(lockedLaw.length === 1, `"actually law" should leave a single academic focus, got ${lockedLaw.length}`)
assert(lockedLaw[0].value === 'law', `"actually law" should keep law as the academic focus, got ${lockedLaw[0]?.value}`)
assert(lockedLaw[0].strength === 'required', `"actually law" should lock law as required, got ${lockedLaw[0]?.strength}`)
assert(
  lockedLaw[0].label === 'Law / pre-law',
  `"actually law" should label Law / pre-law, got ${lockedLaw[0]?.label}`
)
assert(!/not sure/i.test(lockedLaw[0].label), `"actually law" should drop the hedge from the label, got ${lockedLaw[0]?.label}`)
assert(lawLock.criteria.some((c) => String(c.label).startsWith('SAT')), '"actually law" should keep SAT')
assert(lawLock.criteria.some((c) => String(c.label).startsWith('GPA')), '"actually law" should keep GPA')
assert(lawLock.criteria.some((c) => c.category === 'geography'), '"actually law" should keep geography')
assert(
  lawLock.criteria.some((c) => c.value === 'football' || /football/i.test(c.label)),
  '"actually law" should keep football'
)
assert(/lock/i.test(lawLock.message), `should say it is locking in law, got: ${lawLock.message}`)
assert(
  /replacing/i.test(lawLock.message) && /not sure/i.test(lawLock.message),
  `should say it is replacing the hedged law row, got: ${lawLock.message}`
)
assert(/SAT|1400|GPA|football|home|Virginia/i.test(lawLock.message), `should mention kept facts, got: ${lawLock.message}`)

for (const phrase of ["actually it's law", 'lock in law', 'set on law now']) {
  const locked = classifyFollowup(phrase, { schools, criteria: hedgedLaw.criteria })
  assert(locked.type === 'revise_criteria', `"${phrase}" should revise criteria, got ${locked.type}`)
  assert(
    locked.criteria.some((c) => c.category === 'academic_interest' && c.value === 'law' && c.strength === 'required'),
    `"${phrase}" should lock law as required`
  )
}

function satRow(criteria) {
  return (criteria ?? []).find((c) => String(c.label).startsWith('SAT'))
}

function assertScoreUpdate(phrase, expectedSat, { cappedFrom } = {}) {
  const action = classifyFollowup(phrase, { schools, criteria: prior.criteria })
  assert(action.type === 'revise_criteria', `"${phrase}" should revise criteria, got ${action.type}`)
  const row = satRow(action.criteria)
  assert(row, `"${phrase}" should keep a SAT criterion row`)
  assert(row.label === `SAT ${expectedSat}`, `"${phrase}" SAT label should be SAT ${expectedSat}, got ${row.label}`)
  assert(row.value === expectedSat, `"${phrase}" SAT value should be ${expectedSat}, got ${row.value}`)
  assert(String(row.understood).includes(String(expectedSat)), `"${phrase}" understood should mention ${expectedSat}, got ${row.understood}`)
  assert(row.source_phrase, `"${phrase}" should set source_phrase`)
  assert(/sat/i.test(row.source_phrase) || String(expectedSat).includes(String(row.source_phrase)) || /\d{3,4}/.test(row.source_phrase), `"${phrase}" source_phrase should come from the score update, got ${row.source_phrase}`)
  assert(action.academic?.sat === expectedSat, `"${phrase}" should set academic.sat to ${expectedSat}, got ${action.academic?.sat}`)
  assert(
    action.criteria.some((c) => c.category === 'academic_interest' && c.value === 'journalism'),
    `"${phrase}" should keep journalism`
  )
  assert(action.criteria.some((c) => String(c.label).startsWith('GPA')), `"${phrase}" should keep GPA`)
  assert(
    action.criteria.some((c) => c.value === 'football' || /football/i.test(c.label)),
    `"${phrase}" should keep football`
  )
  assert(/sat/i.test(action.message), `"${phrase}" message should mention SAT, got: ${action.message}`)
  assert(/rebuild/i.test(action.message), `"${phrase}" message should say the list is rebuilding, got: ${action.message}`)
  if (cappedFrom != null) {
    assert(String(row.understood).includes(String(cappedFrom)) || String(action.message).includes(String(cappedFrom)), `"${phrase}" should mention the requested ${cappedFrom}`)
    assert(/1600/.test(action.message) && /maximum|max/i.test(action.message), `"${phrase}" should say ${cappedFrom} is above the SAT maximum so the file uses 1600, got: ${action.message}`)
  }
  return action
}

const satCapped = assertScoreUpdate('her sat score improved to 1650', 1600, { cappedFrom: 1650 })
assertScoreUpdate('SAT is now 1480', 1480)
assertScoreUpdate('his SAT went up to 1520', 1520)
assertScoreUpdate('updated SAT 1400', 1400)

const satInputs = engineInputs(
  {
    criteria: satCapped.criteria,
    extraction: { academic: { ...prior.academic, ...satCapped.academic } },
  },
  {}
)
assert(satInputs.academic.sat === 1600, `engineInputs should use updated SAT 1600, got ${satInputs.academic.sat}`)

const staleExtraction = engineInputs(
  {
    criteria: satCapped.criteria,
    extraction: { academic: { ...prior.academic, sat: 1280 } },
  },
  {}
)
assert(
  staleExtraction.academic.sat === 1600,
  `engineInputs should read SAT from the updated criterion when extraction.academic.sat is stale, got ${staleExtraction.academic.sat}`
)

const ask = classifyFollowup('Why is University of Pittsburgh a Target?', { schools, criteria: prior.criteria })
assert(ask.type === 'question', `school question should stay a question, got ${ask.type}`)
assert(satRow(ask.criteria) == null, 'a school question should not rewrite SAT')

const reaches = classifyFollowup('too many reaches', { schools, criteria: prior.criteria })
assert(reaches.type === 'rebuild', `too many reaches should still rebuild, got ${reaches.type}`)

const hi = classifyFollowup('hi', { schools, criteria: prior.criteria })
assert(hi.type === 'chat', `hi should stay small talk, got ${hi.type}`)

const whatsUp = classifyFollowup("what's up", { schools, criteria: prior.criteria })
assert(whatsUp.type === 'chat', `what's up should stay small talk, got ${whatsUp.type}`)

const letter = classifyFollowup('write me a recommendation letter', { schools, criteria: prior.criteria })
assert(letter.type === 'unknown', `unsupported task should be unknown, got ${letter.type}`)

const column = classifyFollowup('add a campus column', { schools, criteria: prior.criteria })
assert(column.type === 'add_column', `add a campus column should still add a column, got ${column.type}`)

const MOUNTAIN_STATES = new Set(['CO', 'UT', 'VT', 'NH', 'WA', 'OR', 'MT', 'ID', 'WY', 'AK', 'NC'])

function assertHikingFollowup(phrase) {
  const action = classifyFollowup(phrase, { schools, criteria: prior.criteria })
  assert(action.type === 'revise_criteria', `"${phrase}" should revise criteria, got ${action.type}`)
  assert(
    action.criteria.some((c) => c.category === 'academic_interest' && c.value === 'journalism'),
    `"${phrase}" should keep journalism as the academic focus`
  )
  assert(
    !action.criteria.some((c) => c.category === 'academic_interest' && /hiking|outdoors|mountain/i.test(`${c.value} ${c.label}`)),
    `"${phrase}" should not turn hiking into a major`
  )
  const hiking = action.criteria.find(
    (c) => c.category === 'other' && (c.value === 'hiking' || /hiking|outdoors/i.test(`${c.label} ${c.value}`))
  )
  assert(hiking, `"${phrase}" should add a hiking / outdoors campus-life criterion`)
  assert(/hiking|outdoors/i.test(hiking.label), `"${phrase}" hiking label should mention hiking or outdoors, got ${hiking.label}`)
  assert(action.criteria.some((c) => String(c.label).startsWith('SAT')), `"${phrase}" should keep SAT`)
  assert(action.criteria.some((c) => String(c.label).startsWith('GPA')), `"${phrase}" should keep GPA`)
  assert(
    action.criteria.some((c) => c.value === 'football' || /football/i.test(c.label)),
    `"${phrase}" should keep football`
  )
  assert(/hiking|mountain/i.test(action.message), `"${phrase}" should mention hiking or mountain access, got: ${action.message}`)
  assert(/journalism|SAT|GPA|football/i.test(action.message), `"${phrase}" should mention kept facts, got: ${action.message}`)
  assert(!/replacing/i.test(action.message), `"${phrase}" should not say it is replacing the major, got: ${action.message}`)
  return action
}

const hiking = assertHikingFollowup('new interest is hiking')
assertHikingFollowup("she's into hiking now")
assertHikingFollowup('add hiking')
assertHikingFollowup('outdoors / mountains')

const hikingNotes =
  'Pennsylvania junior. Interested in journalism. 3.5 GPA, 1280 SAT. Plays football.\n\nnew interest is hiking'
const hikingCatalog = composeCatalog({
  notes: hikingNotes,
  criteria: hiking.criteria,
  academic: prior.academic,
  homeState: prior.home_state,
  incomeBand: '75001-110000',
  cap: 25000,
  listSize: 10,
})
assert(
  hikingCatalog.schools.every((s) => s.programs?.includes('journalism')),
  'hiking follow-up should keep journalism on overlay programs'
)
assert(
  hikingCatalog.schools.every((s) => {
    const line = toTableRow(s, '', 25000, 'PA', hiking.criteria).programLine
    return /journalism/i.test(line) && !/hiking/i.test(line)
  }),
  'Programme column should stay journalism, not hiking'
)
assert(
  hikingCatalog.schools.every((s) => /hiking/i.test(s.clubs)),
  'club lines should mention hiking after the follow-up'
)
assert(
  hikingCatalog.schools.every((s) => !/design-build|design club/i.test(s.clubs)),
  'hiking follow-up must not invent design clubs'
)
const hikingTop10 = hikingCatalog.schools.slice(0, 10)
const hikingMountainCount = hikingTop10.filter((s) => MOUNTAIN_STATES.has(s.state)).length
assert(
  hikingMountainCount >= 3,
  `hiking overlay should include at least 3 mountain-state schools in the first 10, got ${hikingMountainCount}: ${hikingTop10.map((s) => s.state).join(', ')}`
)

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
