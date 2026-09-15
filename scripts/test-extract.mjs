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

console.log(
  'ok',
  law.criteria.map((c) => ({ phrase: c.source_phrase, understood: c.understood }))
)
console.log(
  'ok-short',
  short.criteria.map((c) => ({ phrase: c.source_phrase, understood: c.understood }))
)
