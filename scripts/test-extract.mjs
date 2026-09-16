import { extractFallback } from '../src/lib/extract.js'

const law = extractFallback('wants to pursue law but not sure. SAT 1500, Pennsylvania, far from home.')
const short = extractFallback(
  'Interested in nursing but may change direction. Needs strong financial support. Close-knit, not too large. Driving distance. Anxious about reaches.'
)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const lawRow = law.criteria.find((c) => c.value === 'law')
assert(lawRow, 'law row missing')
assert(law.criteria.filter((c) => c.value === 'law').length === 1, 'law should not duplicate from freeform majors')
assert(lawRow.source_phrase.toLowerCase().includes('law'), 'law phrase should come from the notes')
assert(
  /pursue law|not sure|law/i.test(lawRow.source_phrase),
  `law phrase should keep the counselor's wording, got: ${lawRow.source_phrase}`
)
assert(
  /flexible|locking|low-stakes/i.test(lawRow.understood),
  `law understood should paraphrase uncertainty, got: ${lawRow.understood}`
)
assert(!/required|preferred|confidence/i.test(lawRow.understood), 'understood should not mention table chrome')

const far = law.criteria.find((c) => c.category === 'geography')
assert(far?.value?.prefer_far, 'far from home should set prefer_far')
assert(/out of state|far from home/i.test(far.understood), `geo understood, got: ${far.understood}`)

const sat = law.criteria.find((c) => c.label?.startsWith('SAT'))
assert(sat?.understood.includes('1500'), `SAT understood, got: ${sat?.understood}`)

assert(law.home_state === 'PA', `home state should be PA, got ${law.home_state}`)
assert(
  law.criteria.every((c) => typeof c.understood === 'string' && c.understood.length > 0),
  'every row needs an understood line'
)

const nursing = short.criteria.find((c) => c.value === 'nursing')
assert(/may change/i.test(nursing.understood), `nursing hedge understood, got: ${nursing.understood}`)

const aid = short.criteria.find((c) => c.value === 'aid_needed')
assert(/financial|net price/i.test(aid.understood), `aid understood, got: ${aid.understood}`)

function assertAid(notes, hint) {
  const extracted = extractFallback(notes)
  assert(extracted.affordability_signal.aid_needed, `${hint}: aid_needed`)
  assert(
    extracted.criteria.some((c) => c.value === 'aid_needed'),
    `${hint}: aid criterion`
  )
}

assertAid(
  'Maya has a 4.0 UW GPA and 1560 SAT, aiming for engineering. Family expected contribution is $0 and she cannot take on loans.',
  '$0 EFC / cannot take loans'
)
assertAid('Requires 100% demonstrated need met. Biology, 3.8 GPA.', 'demonstrated need')
assertAid('Cannot take loans. Nursing. 3.5 GPA.', 'cannot take loans')
assertAid('EFC is zero. Computer science, 1400 SAT.', 'EFC')

const noAid = extractFallback('3.9 GPA, 1510 SAT, computer science. Family can pay sticker if they have to.')
assert(!noAid.affordability_signal.aid_needed, 'sticker payers are not aid_needed')

const acting = extractFallback(
  'Interested in acting and entertainment. 3.6 GPA, 1280 SAT. Lives in Pennsylvania.'
)
const actingRow = acting.criteria.find((c) => c.value === 'performing_arts')
assert(actingRow, 'acting / entertainment should become performing_arts')
assert(/acting|entertainment/i.test(actingRow.source_phrase), `acting phrase, got: ${actingRow.source_phrase}`)
assert(!acting.criteria.some((c) => c.value === 'art'), 'acting should not collapse to studio art')
assert(acting.home_state === 'PA', `acting notes still name PA, got ${acting.home_state}`)
assert(
  !acting.criteria.some((c) => c.category === 'geography'),
  'naming a state without far/close should not add a distance row'
)

const nearby = extractFallback('Pennsylvania student, computer science, wants schools close to home.')
assert(
  nearby.criteria.some((c) => c.category === 'geography' && c.value?.max_miles),
  'close to home should still set a distance cap'
)

const politicsNotes = 'Pennsylvania junior. Interested in politics. 3.5 GPA, 1280 SAT.'
const politics = extractFallback(politicsNotes)
const politicsRow = politics.criteria.find((c) => c.category === 'academic_interest')
assert(politicsRow?.value === 'political_science', `politics should be political_science, got ${politicsRow?.value}`)
assert(/politics/i.test(politicsRow.source_phrase), `politics phrase, got: ${politicsRow?.source_phrase}`)
assert(!politics.criteria.some((c) => c.value === 'law'), 'politics should not collapse to law')

const journalism = extractFallback('Pennsylvania junior. Interested in journalism. 3.5 GPA, 1280 SAT.')
const journalismRow = journalism.criteria.find((c) => c.category === 'academic_interest')
assert(journalismRow?.value === 'journalism', `journalism should stay journalism, got ${journalismRow?.value}`)
assert(/journalism/i.test(journalismRow.label), `journalism label, got ${journalismRow?.label}`)
assert(/journalism/i.test(journalismRow.source_phrase))

const architecture = extractFallback('Wants to study architecture. 3.8 GPA.')
assert(
  architecture.criteria.some((c) => c.category === 'academic_interest' && c.value === 'architecture'),
  'study architecture should become an architecture major'
)

const kinesiology = extractFallback('Aiming for a kinesiology major, 1240 SAT.')
assert(
  kinesiology.criteria.some((c) => c.category === 'academic_interest' && c.value === 'kinesiology'),
  'kinesiology major should not be dropped'
)

assert(
  extractFallback('Interested in acting and entertainment. 3.6 GPA.').criteria.filter((c) => c.category === 'academic_interest').every((c) => c.value === 'performing_arts'),
  'known acting notes should not also invent a freeform major'
)

function assertPreMedPath(notes, hint) {
  const extracted = extractFallback(notes)
  const majors = extracted.criteria.filter((c) => c.category === 'academic_interest')
  assert(
    majors.some((c) => c.value === 'biology'),
    `${hint}: should map to biology / pre-med`
  )
  assert(
    !majors.some((c) => /med[_ ]?school|medical_school/i.test(String(c.value))),
    `${hint}: should not invent a med-school graduate program`
  )
}

assertPreMedPath('he wants to switch to med school', 'switch to med school')
assertPreMedPath('interested in medical school', 'medical school')
assertPreMedPath('pre-med student in Pennsylvania', 'pre-med')
assertPreMedPath('wants to pursue medicine', 'medicine')

const footballNotes = 'Interested in acting and entertainment. Plays football. 3.6 GPA, 1280 SAT.'
const football = extractFallback(footballNotes)
assert(
  football.criteria.some((c) => c.value === 'football' || /football/i.test(c.label)),
  'plays football should be a criterion'
)
assert(
  !football.criteria.some((c) => c.value === 'basketball'),
  'football should not be labeled basketball'
)

function assertHikingIsClub(notes, hint) {
  const extracted = extractFallback(notes)
  const hiking = extracted.criteria.find(
    (c) => c.category === 'other' && (c.value === 'hiking' || /hiking|outdoors/i.test(`${c.label} ${c.value}`))
  )
  assert(hiking, `${hint}: hiking should be a campus-life criterion`)
  assert(/hiking|outdoors/i.test(hiking.label), `${hint}: label should mention hiking or outdoors, got ${hiking.label}`)
  assert(
    !extracted.criteria.some((c) => c.category === 'academic_interest' && /hiking|outdoors|mountain/i.test(`${c.value} ${c.label}`)),
    `${hint}: hiking should not be a major`
  )
  return extracted
}

assertHikingIsClub('new interest is hiking', 'new interest is hiking')
assertHikingIsClub("she's into hiking now", 'into hiking now')
assertHikingIsClub('add hiking', 'add hiking')
assertHikingIsClub('outdoors / mountains', 'outdoors / mountains')

const journalismHiking = assertHikingIsClub(
  'Pennsylvania junior. Interested in journalism. 3.5 GPA, 1280 SAT. New interest is hiking.',
  'journalism plus hiking'
)
assert(
  journalismHiking.criteria.some((c) => c.category === 'academic_interest' && c.value === 'journalism'),
  'journalism plus hiking should keep journalism as the major'
)
assertHikingIsClub('Interested in hiking. 3.5 GPA, 1280 SAT.', 'interested in hiking should stay a club, not a major')

console.log(
  'ok',
  law.criteria.map((c) => ({ phrase: c.source_phrase, understood: c.understood }))
)
console.log(
  'ok-short',
  short.criteria.map((c) => ({ phrase: c.source_phrase, understood: c.understood }))
)
