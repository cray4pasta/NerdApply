// Turns free-form notes into structured criteria. Tries the AI extraction call first; if the
// key is missing, falls back to keyword matching. Patterns include the short counselor notes in
// src/data/counselor-note-examples.csv. See files/02-ENGINEERING.md 6.4.
import { STATE_NAMES } from './geo.js'
import { fetchWithTimeout } from './progress.js'

const STATE_BY_NAME = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([abbr, name]) => [name.toLowerCase(), abbr])
)
const POSTAL_CODES = new Set(Object.keys(STATE_NAMES))

export const PROGRAM_CHOICES = [
  { value: 'marine_biology', label: 'Marine biology' },
  { value: 'computer_science', label: 'Computer science' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'nursing', label: 'Nursing' },
  { value: 'biology', label: 'Biology' },
  { value: 'business', label: 'Business' },
  { value: 'education', label: 'Education' },
  { value: 'art', label: 'Art' },
  { value: 'performing_arts', label: 'Acting / entertainment' },
  { value: 'design', label: 'Design' },
  { value: 'environmental_science', label: 'Environmental science' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'law', label: 'Law / pre-law' },
  { value: 'political_science', label: 'Political science' },
]

const INTEREST_KEYWORDS = [
  [/acting|\bactor\b|\bactress\b|\btheatre\b|\btheater\b|\bdrama\b|musical theatre|musical theater|performing arts|\bentertainment\b|\bfilm\b/i, 'performing_arts'],
  [/graphic design|industrial design|visual design|\bUX\b|interested in design|\bdesign\b/i, 'design'],
  [/interested in (the )?arts?|art school|fine arts|studio art|drawing|painting|\barts\b|\bart\b/i, 'art'],
  [/marine biology|marine science|oceanography|\bocean\b/i, 'marine_biology'],
  [/computer science|\bcomp sci\b|\bC\.?S\.?\b|programming|coding|software|computing/i, 'computer_science'],
  [/environmental science|environmental studies|sustainability/i, 'environmental_science'],
  [/engineering/i, 'engineering'],
  [/nursing|\bRN\b/i, 'nursing'],
  [/pre-?med|premed|medical school|\bdoctor\b|\bmedicine\b/i, 'biology'],
  [/\bbiology\b/i, 'biology'],
  [/business|finance|entrepreneur|accounting|economics/i, 'business'],
  [/teaching|\beducation\b/i, 'education'],
  [/\bagriculture\b/i, 'agriculture'],
  [/political science|\bpoli[\s.-]?sci\b|\bpolitics\b|public policy|international relations/i, 'political_science'],
]

const LABEL_FOR = Object.fromEntries(PROGRAM_CHOICES.map((p) => [p.value, p.label]))

const NOT_A_MAJOR = new Set([
  'football',
  'basketball',
  'robotics',
  'athletics',
  'club',
  'clubs',
  'aid',
  'home',
  'college',
  'colleges',
  'school',
  'schools',
  'list',
  'gpa',
  'sat',
  'act',
  'campus',
  'life',
])

function slugFromPhrase(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48)
}

function humanizeSlug(slug) {
  const s = String(slug ?? '').replaceAll('_', ' ').trim()
  if (!s) return String(slug ?? '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function cleanMajorChunk(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\s+major$/i, '')
    .replace(/\b\d{3,4}\b.*$/, '')
    .replace(/\b(?:gpa|sat|act)\b.*$/i, '')
    .trim()
}

function addFreeformMajors(notes, criteria, matchedValues) {
  const cues = [
    /interested in ([^.,;\n]+)/gi,
    /wants to (?:study|major in|pursue) ([^.,;\n]+)/gi,
    /aiming for (?:a |an )?([^.,;\n]+)/gi,
    /\bmajoring in ([^.,;\n]+)/gi,
    /\b([A-Za-z][A-Za-z\s]{1,28}) major\b/gi,
  ]
  for (const re of cues) {
    for (const m of notes.matchAll(re)) {
      const chunk = cleanMajorChunk(m[1])
      if (!chunk || /close to home|financial aid|staying|going far|full ride/i.test(chunk)) continue
      const knownWhole = canonicalProgram(chunk)
      const pieces =
        knownWhole && LABEL_FOR[knownWhole]
          ? [chunk]
          : chunk.split(/\s+and\s+|\s+or\s+/i).map((p) => cleanMajorChunk(p)).filter(Boolean)
      for (const part of pieces) {
        if (/close to home|financial aid|staying|full ride/i.test(part)) continue
        const known = canonicalProgram(part)
        if (known && LABEL_FOR[known]) {
          if (matchedValues.has(known)) continue
          matchedValues.add(known)
          criteria.push(
            makeCriterion(
              'academic_interest',
              LABEL_FOR[known],
              known,
              'low',
              part,
              'required',
              PROGRAM_UNDERSTOOD[known] ?? LABEL_FOR[known]
            )
          )
          continue
        }
        const slug = slugFromPhrase(part)
        if (!slug || slug.length < 3 || NOT_A_MAJOR.has(slug) || matchedValues.has(slug)) continue
        matchedValues.add(slug)
        const label = humanizeSlug(slug)
        criteria.push(
          makeCriterion(
            'academic_interest',
            label,
            slug,
            'low',
            part,
            'required',
            `${label} is the academic focus for this search.`
          )
        )
      }
    }
  }
}

const PROGRAM_UNDERSTOOD = {
  art: 'Art is the academic focus — prioritize schools with a real studio or fine-arts program.',
  performing_arts: 'Acting and entertainment are the academic focus — look for theatre, film, or performing-arts programs.',
  design: 'Design is the academic focus for this search.',
  marine_biology: 'Marine biology is the academic focus for this search.',
  computer_science: 'Computer science is the academic focus for this search.',
  engineering: 'Engineering is the academic focus for this search.',
  nursing: 'Nursing is the academic focus for this search.',
  biology: 'Biology is the academic focus for this search.',
  business: 'Business is the academic focus for this search.',
  education: 'Education is the academic focus for this search.',
  environmental_science: 'Environmental science is the academic focus for this search.',
  agriculture: 'Agriculture is the academic focus for this search.',
  law: 'Looking for colleges with a path toward law, including pre-law advising and related majors.',
  political_science: 'Political science is the academic focus — look for government, politics, or public-policy programs.',
}

let nextId = 1
function makeCriterion(category, label, value, confidence, sourcePhrase, strength, understood) {
  return {
    id: `c${nextId++}`,
    category,
    label,
    value,
    confidence,
    source_phrase: sourcePhrase,
    strength,
    understood: understood || PROGRAM_UNDERSTOOD[value] || label,
  }
}

function findState(notes) {
  for (const [name, abbr] of Object.entries(STATE_BY_NAME)) {
    const re = new RegExp(`\\b${name}\\b`, 'i')
    const m = notes.match(re)
    if (m) return { abbr, phrase: m[0] }
  }
  const prefixed = notes.match(/\b(?:from|lives in|home(?:\s+state)?(?:\s+is)?)\s+([A-Za-z]{2})\b/i)
  if (prefixed) {
    const abbr = prefixed[1].toUpperCase()
    if (POSTAL_CODES.has(abbr)) return { abbr, phrase: prefixed[0] }
  }
  const tokens = notes.match(/\b[A-Z]{2}\b/g) || []
  for (const t of tokens) {
    if (POSTAL_CODES.has(t)) return { abbr: t, phrase: t }
  }
  return null
}

function parseSat(notes) {
  const labelled =
    notes.match(/\bsat[^0-9]{0,24}(1[0-6]\d{2}|[4-9]\d{2})\b/i) ||
    notes.match(/\b(1[0-6]\d{2}|[4-9]\d{2})\s*(?:SAT|on the SAT)\b/i)
  if (labelled) {
    const n = Number(labelled[1])
    if (n >= 400 && n <= 1600) return n
  }
  const bare = notes.match(/\b(1[0-6]\d{2})\b/)
  const n = bare ? Number(bare[1]) : null
  return n >= 400 && n <= 1600 ? n : null
}

function parseAct(notes) {
  const m = notes.match(/\bACT[:\s-]*(\d{1,2})\b/i) || notes.match(/\b(\d{1,2})\s*ACT\b/i)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 36 ? n : null
}

function parseGpa(notes) {
  const labelled = notes.match(/\bGPA[:\s]*([0-4](?:\.\d{1,2})?)\b/i)
  if (labelled) return Number(labelled[1])
  const dotted = notes.match(/\b([0-4]\.\d{1,2})\b/)
  return dotted ? Number(dotted[1]) : null
}

export function parseListSize(notes) {
  const m =
    String(notes ?? '').match(/\b(\d{1,2})\s*(?:colleges|schools|universities)\b/i) ||
    String(notes ?? '').match(/\blist of\s+(\d{1,2})\b/i)
  const n = m ? Number(m[1]) : null
  if (n >= 6 && n <= 24) return n
  return null
}

function parseName(notes) {
  const named = notes.match(/\bnamed\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/)
  if (named) return named[1]
  const intro = notes.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:is|has|wants)\b/)
  return intro ? intro[1] : null
}

export function extractFallback(notes) {
  nextId = 1
  const criteria = []
  const sat = parseSat(notes)
  const act = parseAct(notes)
  const gpa = parseGpa(notes)
  const state = findState(notes)
  const unresolved = []

  const hedge = notes.match(/may change|might change|undecided|change direction|but not sure|\bnot sure\b/i)
  const SUBSUMED_BY = { biology: 'marine_biology', art: 'performing_arts' }
  const matchedValues = new Set()
  for (const [re, value] of INTEREST_KEYWORDS) {
    const m = notes.match(re)
    if (m) {
      if (SUBSUMED_BY[value] && matchedValues.has(SUBSUMED_BY[value])) continue
      matchedValues.add(value)
      const flexible = Boolean(hedge) && value === 'nursing'
      const label = flexible ? 'Nursing (may change direction)' : LABEL_FOR[value] ?? value
      const understood = flexible
        ? 'Interested in nursing but may change direction — keep related health majors and other paths in play.'
        : PROGRAM_UNDERSTOOD[value] ?? label
      criteria.push(
        makeCriterion(
          'academic_interest',
          label,
          value,
          'low',
          m[0],
          flexible ? 'flexible' : 'required',
          understood
        )
      )
    }
  }
  if (hedge && matchedValues.has('nursing') && !matchedValues.has('biology')) {
    criteria.push(
      makeCriterion(
        'academic_interest',
        'Related health majors',
        'biology',
        'low',
        hedge[0],
        'preferred',
        'Keep related health majors available if nursing does not stick.'
      )
    )
    matchedValues.add('biology')
  }

  const law = notes.match(/\blaw\b|pre-?law|lawyer/i)
  if (law) {
    const strength = hedge ? 'preferred' : 'required'
    const clause = notes.match(/[^.\n]*\b(?:law|pre-?law|lawyer)\b[^.\n]*/i)
    const phrase = (clause?.[0] || law[0]).trim()
    criteria.push(
      makeCriterion(
        'academic_interest',
        hedge ? 'Law (not sure)' : 'Law / pre-law',
        'law',
        'low',
        phrase,
        strength,
        hedge
          ? 'Exploring law without locking in — look for flexible majors and low-stakes ways to test legal work.'
          : PROGRAM_UNDERSTOOD.law
      )
    )
    if (hedge) {
      unresolved.push(
        'Law is treated as preferred because the notes say they are not sure. Undergraduate law-related majors stay in play without emptying the list.'
      )
    } else {
      unresolved.push(
        'Law here means an undergraduate law-related major from a published catalog. A JD is graduate school and is not the filter.'
      )
    }
    matchedValues.add('law')
  }

  addFreeformMajors(notes, criteria, matchedValues)

  if (sat != null) {
    const satPhrase = notes.match(/\bsat[^.]{0,24}\d{3,4}/i) || notes.match(/\b1[0-6]\d{2}\s*SAT\b/i) || String(sat)
    criteria.push(
      makeCriterion(
        'other',
        `SAT ${sat}`,
        sat,
        'low',
        typeof satPhrase === 'string' ? satPhrase : satPhrase[0],
        'required',
        `SAT ${sat} is on file for admissions comparison.`
      )
    )
  }
  if (gpa != null) {
    const gpaPhrase = notes.match(/\bGPA[:\s]*[0-4](?:\.\d{1,2})?\b/i) || notes.match(/\b[0-4]\.\d{1,2}\b/)
    criteria.push(
      makeCriterion(
        'other',
        `GPA ${gpa}`,
        gpa,
        'low',
        gpaPhrase ? gpaPhrase[0] : String(gpa),
        'preferred',
        `GPA ${gpa} is on file for admissions comparison.`
      )
    )
  }

  const handsOn = notes.match(/practical and hands-on|hands-on|practical/i)
  if (handsOn) {
    criteria.push(
      makeCriterion(
        'other',
        'Practical, hands-on learning style',
        'hands_on',
        'low',
        handsOn[0],
        'preferred',
        'Prefers practical, hands-on learning rather than a purely theoretical campus.'
      )
    )
  }
  const quiet = notes.match(/\bquiet\b|introverted|keeps to (himself|herself|themselves)/i)
  if (quiet) {
    criteria.push(
      makeCriterion(
        'other',
        'Quiet / introverted',
        'introverted',
        'low',
        quiet[0],
        'preferred',
        'A quieter campus culture will fit better than a high-social one.'
      )
    )
  }
  const extro = notes.match(/\bextroverted\b|\boutgoing\b|\bsocial\b/i)
  if (extro) {
    criteria.push(
      makeCriterion(
        'other',
        'Extroverted / outgoing',
        'extroverted',
        'low',
        extro[0],
        'preferred',
        'An outgoing, social campus environment is a better fit.'
      )
    )
  }
  const robotics = notes.match(/robotics(?:\s+club)?/i)
  if (robotics) {
    criteria.push(
      makeCriterion(
        'other',
        'Robotics club',
        'robotics',
        'low',
        robotics[0],
        'preferred',
        'Look for an active robotics club or competitive robotics team.'
      )
    )
  }
  const football = notes.match(/plays football|\bfootball\b/i)
  if (football) {
    criteria.push(
      makeCriterion(
        'other',
        'Plays football',
        'football',
        'low',
        football[0],
        'preferred',
        'Football is part of campus fit — confirm a team or club program with the school.'
      )
    )
    unresolved.push('Athletics are not in the federal snapshot — confirm football with the school.')
  }
  const basketball = notes.match(/\bbasketball\b/i)
  if (basketball) {
    criteria.push(
      makeCriterion(
        'other',
        'Loves basketball',
        'basketball',
        'low',
        basketball[0],
        'preferred',
        'Athletics matter, especially basketball — confirm sports on campus.'
      )
    )
    if (!football) unresolved.push('Athletics are not in the federal snapshot — confirm campus sports with the school.')
  }
  const noEc = notes.match(/no extra[\s-]?curriculars|no extracurriculars|no activities/i)
  if (noEc) {
    criteria.push(
      makeCriterion(
        'other',
        'No extracurriculars on file',
        'no_ec',
        'low',
        noEc[0],
        'preferred',
        'No extracurriculars are on file, so academic and campus fit have to carry more of the list.'
      )
    )
  }

  const warm = notes.match(/\bwarm\b|somewhere warm|hot climate|the south|southern|beach town/i)
  if (warm) {
    criteria.push(
      makeCriterion('environment', 'Warm climate', 'warm', 'low', warm[0], 'preferred', 'Prefer a warm climate.')
    )
  }

  const closeKnit = notes.match(/close-knit|not too large|intimate|small campus/i)
  const settingMatch = !closeKnit && notes.match(/\b(small|large|big school|city|rural|urban|suburban)\b/i)
  if (closeKnit) {
    criteria.push(
      makeCriterion(
        'size',
        'Close-knit, not too large',
        'small',
        'low',
        closeKnit[0],
        'preferred',
        'Prefer a close-knit campus that is not too large.'
      )
    )
  } else if (settingMatch) {
    const raw = settingMatch[1].toLowerCase()
    const sizeWords = ['small', 'large', 'big school']
    const category = sizeWords.includes(raw) ? 'size' : 'environment'
    const value = raw === 'big school' ? 'large' : raw
    criteria.push(
      makeCriterion(
        category,
        `Prefers a ${value} school`,
        value,
        'low',
        settingMatch[0],
        'flexible',
        `Prefers a ${value} school.`
      )
    )
  }

  const driving = notes.match(/driving distance|drivable|can drive|within driving/i)
  const farFrom = notes.match(/(?<!too )far from home|away from home|leave (the )?state|out of state/i)
  const nearHome =
    !farFrom &&
    notes.match(
      /aren'?t too far from home|near home|close to home|stay in state|not too far|stay close|doesn'?t want to go far/i
    )
  if (driving || nearHome || farFrom) {
    const maxMiles = driving ? 180 : nearHome ? 300 : null
    const phrase = farFrom ? farFrom[0] : driving ? driving[0] : nearHome[0]
    let label = `Home state: ${state ? STATE_NAMES[state.abbr] : 'unknown'}`
    let understood = state
      ? `Home state is ${STATE_NAMES[state.abbr]}, which is the starting point for distance.`
      : 'Home state is the starting point for distance.'
    if (farFrom) {
      label = 'Out of state — far from home'
      understood = 'Wants to be far from home, so the search should prefer out-of-state schools.'
    } else if (driving) {
      label = 'Driving distance'
      understood = 'Stay within driving distance of home.'
    } else if (nearHome) {
      label = `Within ~${maxMiles} miles of home`
      understood = 'Stay relatively close to home — roughly within a few hundred miles.'
    }
    criteria.push(
      makeCriterion(
        'geography',
        label,
        { home_state: state?.abbr ?? null, max_miles: maxMiles, prefer_far: Boolean(farFrom) },
        'low',
        phrase,
        'preferred',
        understood
      )
    )
    if (!state) {
      unresolved.push('Set home state below — distance needs a starting point.')
    }
    if (farFrom && state) {
      unresolved.push(`Far from home excludes ${STATE_NAMES[state.abbr]} schools.`)
    }
  }

  const aidMatch = notes.match(
    /needs strong financial support|financial aid|needs aid|low income|pell|can'?t afford|scholarship|aid needed|\$0(?:\s*EFC)?|\bEFC\b|cannot take (?:on )?loans|can'?t take (?:on )?loans|\bno loans\b|meet(?:s)? full need|demonstrated need|expected contribution is \$0/i
  )
  if (aidMatch) {
    criteria.push(
      makeCriterion(
        'family_constraint',
        'Needs strong financial support',
        'aid_needed',
        'low',
        aidMatch[0],
        'required',
        'Needs strong financial support, so net price has to be visible and realistic.'
      )
    )
  }

  const reachAnxiety = notes.match(/anxious about reaches|afraid of reaches|too many reaches|reach-heavy|worried about reaches/i)
  if (reachAnxiety) {
    criteria.push(
      makeCriterion(
        'risk_tolerance',
        'Cautious about Reach schools',
        'cautious_reach',
        'low',
        reachAnxiety[0],
        'preferred',
        'Go easy on Reach schools.'
      )
    )
    criteria.push(
      makeCriterion(
        'support_needs',
        'Student support services',
        'support',
        'low',
        reachAnxiety[0],
        'preferred',
        'Student support services should weigh more than usual.'
      )
    )
  }

  if (!criteria.some((c) => c.category === 'academic_interest')) {
    unresolved.push('No major was detected. Use “Add a criterion” and pick or name a program, or the list will not filter by major.')
  }
  if (sat == null && act == null) {
    unresolved.push('No test score detected; academic strength will use GPA only, at limited evidence.')
  }

  const listSize = parseListSize(notes)
  if (listSize != null) {
    const phrase = notes.match(/\b\d{1,2}\s*(?:colleges|schools|universities)\b/i) || notes.match(/\blist of\s+\d{1,2}\b/i)
    criteria.push(
      makeCriterion(
        'other',
        `List of ${listSize} schools`,
        listSize,
        'low',
        phrase ? phrase[0] : String(listSize),
        'required',
        `Keep ${listSize} schools on the list unless the counselor cuts it.`
      )
    )
  }

  return {
    student_name: parseName(notes),
    academic: { gpa, sat, act, rigor_notes: null },
    home_state: state?.abbr ?? null,
    list_size: listSize,
    criteria,
    affordability_signal: {
      aid_needed: Boolean(aidMatch),
      confidence: 'low',
      source_phrase: aidMatch ? aidMatch[0] : null,
    },
    unresolved,
    degraded: true,
  }
}

function canonicalProgram(raw) {
  if (raw == null || typeof raw === 'object') return null
  const s = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (PROGRAM_CHOICES.some((p) => p.value === s)) return s
  const words = s.replace(/_/g, ' ')
  const byLabel = PROGRAM_CHOICES.find((p) => p.label.toLowerCase() === words)
  if (byLabel) return byLabel.value
  if (/acting|actor|actress|theatre|theater|\bdrama\b|performing|entertainment|\bfilm\b/.test(words)) return 'performing_arts'
  if (/design/.test(words)) return 'design'
  if (/\bart\b/.test(words) && !/martial/.test(words)) return 'art'
  if (/computer|programming|coding|software/.test(words)) return 'computer_science'
  if (/marine|ocean/.test(words)) return 'marine_biology'
  if (/nurs/.test(words)) return 'nursing'
  if (/engineer/.test(words)) return 'engineering'
  if (/business|finance|econ/.test(words)) return 'business'
  if (/environment|sustain/.test(words)) return 'environmental_science'
  if (/educat|teach/.test(words)) return 'education'
  if (/agricult/.test(words)) return 'agriculture'
  if (/\blaw\b/.test(words) || /pre_?law/.test(s)) return 'law'
  if (/politic|public policy|international relations|government/.test(words)) return 'political_science'
  if (/\bbio/.test(words)) return 'biology'
  return null
}

function looksFarFromHome(c) {
  if (c?.value && typeof c.value === 'object' && c.value.prefer_far) return true
  const blob = `${c?.label ?? ''} ${c?.source_phrase ?? ''} ${typeof c?.value === 'string' ? c.value : ''}`
  return /(?<!too )far from home|away from home|out of state|leave (the )?state/i.test(blob)
}

export function normalizeAiExtraction(data, notes) {
  const fallback = extractFallback(notes)
  const home =
    typeof data.home_state === 'string' && data.home_state.length === 2
      ? data.home_state.toUpperCase()
      : fallback.home_state

  const criteria = (data.criteria ?? []).map((c, i) => {
    const next = { ...c, id: c.id || `ai${i + 1}` }
    const prog = canonicalProgram(c.value) || (c.category === 'academic_interest' ? canonicalProgram(c.label) : null)
    if (prog) {
      next.category = 'academic_interest'
      next.value = prog
      next.label = LABEL_FOR[prog] ?? humanizeSlug(prog)
    } else if (c.category === 'academic_interest') {
      const slug = slugFromPhrase(c.value || c.label)
      if (slug && slug.length >= 3 && !NOT_A_MAJOR.has(slug)) {
        next.value = slug
        next.label = LABEL_FOR[slug] ?? (typeof c.label === 'string' && c.label.trim() ? c.label : humanizeSlug(slug))
      }
    }
    const geoObject = c.value && typeof c.value === 'object'
    if (c.category === 'geography' || looksFarFromHome(c) || geoObject?.prefer_far || geoObject?.home_state || geoObject?.max_miles != null) {
      const existing = geoObject ? c.value : {}
      const far = looksFarFromHome(c)
      next.category = 'geography'
      next.value = {
        home_state: existing.home_state || home,
        max_miles: existing.max_miles ?? null,
        prefer_far: far,
      }
      if (far) next.label = 'Out of state — far from home'
    }
    if (!next.understood || !String(next.understood).trim()) {
      const fbMatch = fallback.criteria.find(
        (row) => row.category === next.category && JSON.stringify(row.value) === JSON.stringify(next.value)
      )
      next.understood = fbMatch?.understood || next.label
    }
    return next
  })

  const fbLaw = fallback.criteria.find((c) => c.value === 'law')
  if (fbLaw) {
    const existing = criteria.find((c) => c.value === 'law' || /pre-?law|\blaw\b/i.test(`${c.label} ${c.value}`))
    if (!existing) criteria.push({ ...fbLaw, id: `fb-${fbLaw.id}` })
    else {
      existing.value = 'law'
      existing.category = 'academic_interest'
      existing.strength = fbLaw.strength
      existing.label = fbLaw.label
    }
  }

  const fbArt = fallback.criteria.find((c) => c.value === 'art')
  if (fbArt && !criteria.some((c) => c.value === 'art' || c.value === 'performing_arts')) {
    criteria.push({ ...fbArt, id: `fb-${fbArt.id}` })
  }
  const fbStage = fallback.criteria.find((c) => c.value === 'performing_arts')
  if (fbStage && !criteria.some((c) => c.value === 'performing_arts')) {
    criteria.push({ ...fbStage, id: `fb-${fbStage.id}` })
  }
  const fbPolitics = fallback.criteria.find((c) => c.value === 'political_science')
  if (fbPolitics && !criteria.some((c) => c.value === 'political_science')) {
    criteria.push({ ...fbPolitics, id: `fb-${fbPolitics.id}` })
  }
  for (const fb of fallback.criteria.filter((c) => c.category === 'academic_interest')) {
    if (criteria.some((c) => c.category === 'academic_interest' && c.value === fb.value)) continue
    criteria.push({ ...fb, id: `fb-${fb.id}` })
  }

  const fbFar = fallback.criteria.find((c) => c.category === 'geography' && c.value?.prefer_far)
  if (fbFar) {
    const geo = criteria.find((c) => c.category === 'geography')
    if (!geo) criteria.push({ ...fbFar, id: `fb-${fbFar.id}` })
    else if (!geo.value?.prefer_far) {
      geo.value = {
        ...(typeof geo.value === 'object' ? geo.value : {}),
        home_state: geo.value?.home_state || home,
        prefer_far: true,
        max_miles: geo.value?.max_miles ?? null,
      }
      geo.label = 'Out of state — far from home'
      if (!geo.understood) geo.understood = fbFar.understood
    }
  }

  const fbSize = fallback.criteria.find((c) => c.label?.startsWith('List of ') && typeof c.value === 'number')
  if (fbSize && !criteria.some((c) => typeof c.value === 'number' && c.label?.startsWith('List of '))) {
    criteria.push({ ...fbSize, id: `fb-${fbSize.id}` })
  }

  return {
    ...data,
    home_state: home,
    list_size: fallback.list_size ?? data.list_size ?? null,
    academic: {
      gpa: data.academic?.gpa ?? fallback.academic?.gpa,
      sat: data.academic?.sat ?? fallback.academic?.sat,
      act: data.academic?.act ?? fallback.academic?.act,
      rigor_notes: data.academic?.rigor_notes ?? null,
    },
    criteria,
    unresolved: [
      ...new Set([...(data.unresolved ?? []), ...(fallback.unresolved ?? [])].filter((u) => !/no law school/i.test(u))),
    ],
  }
}

export async function extractCriteria(notes) {
  try {
    const res = await fetchWithTimeout('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'extract', notes }),
    })
    if (!res.ok) throw new Error(`extract call failed: ${res.status}`)
    const data = await res.json()
    if (!data || !Array.isArray(data.criteria)) throw new Error('malformed extraction response')
    return { ...normalizeAiExtraction(data, notes), degraded: false }
  } catch (err) {
    console.warn('[extract] AI extraction unavailable, falling back to keyword matching:', err.message)
    return extractFallback(notes)
  }
}
