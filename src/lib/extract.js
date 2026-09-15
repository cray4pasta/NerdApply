// Turns free-form notes into structured criteria. Tries the AI extraction call first; if the
// key is missing, falls back to keyword matching. Each row also carries a one-line `understood`
// paraphrase of the source phrase for the criteria table.
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
  { value: 'environmental_science', label: 'Environmental science' },
  { value: 'agriculture', label: 'Agriculture' },
]

const INTEREST_KEYWORDS = [
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
]

const LABEL_FOR = Object.fromEntries(PROGRAM_CHOICES.map((p) => [p.value, p.label]))

const PROGRAM_UNDERSTOOD = {
  art: 'Art is the academic focus — prioritize schools with a real studio or fine-arts program.',
  marine_biology: 'Marine biology is the academic focus for this search.',
  computer_science: 'Computer science is the academic focus for this search.',
  engineering: 'Engineering is the academic focus for this search.',
  nursing: 'Nursing is the academic focus for this search.',
  biology: 'Biology is the academic focus for this search.',
  business: 'Business is the academic focus for this search.',
  education: 'Education is the academic focus for this search.',
  environmental_science: 'Environmental science is the academic focus for this search.',
  agriculture: 'Agriculture is the academic focus for this search.',
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
    understood: understood || label,
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
  const SUBSUMED_BY = { biology: 'marine_biology' }
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
        makeCriterion('academic_interest', label, value, 'low', m[0], flexible ? 'flexible' : 'required', understood)
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
    const unsure = Boolean(hedge)
    const clause = notes.match(/[^.\n]*\b(?:law|pre-?law|lawyer)\b[^.\n]*/i)
    const phrase = (clause?.[0] || law[0]).trim()
    criteria.push(
      makeCriterion(
        'academic_interest',
        unsure ? 'Law (not sure)' : 'Law / pre-law',
        'law',
        'low',
        phrase,
        'flexible',
        unsure
          ? 'Exploring law without locking in — look for flexible majors and low-stakes ways to test legal work.'
          : 'Looking for colleges with a path toward law, including pre-law advising and related majors.'
      )
    )
    unresolved.push('This snapshot has no law school. Law is noted as flexible so it will not empty the list.')
  }

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
  const basketball = notes.match(/basketball|athletics|sports/i)
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
    unresolved.push('Athletics are not in the federal snapshot — confirm campus sports with the school.')
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
      makeCriterion(
        'environment',
        'Warm climate',
        'warm',
        'low',
        warm[0],
        'preferred',
        'Prefer a warm climate.'
      )
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
  if (state || driving || nearHome || farFrom) {
    const maxMiles = driving ? 180 : nearHome ? 300 : null
    const phrase = farFrom ? farFrom[0] : driving ? driving[0] : nearHome ? nearHome[0] : state.phrase
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
    if ((driving || nearHome || farFrom) && !state) {
      unresolved.push('Set home state below — distance needs a starting point.')
    }
    if (farFrom && state) {
      unresolved.push(`Far from home excludes ${STATE_NAMES[state.abbr]} schools.`)
    }
  }

  const aidMatch = notes.match(
    /needs strong financial support|financial aid|needs aid|low income|pell|can'?t afford|scholarship|aid needed/i
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

  const reachAnxiety = notes.match(
    /anxious about reaches|afraid of reaches|too many reaches|reach-heavy|worried about reaches/i
  )
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

  if (!matchedValues.size && !law) {
    unresolved.push(
      'No major in this snapshot was detected. Use “Add a criterion” and pick a program, or the list will not filter by major.'
    )
  }
  if (!state && !driving && !nearHome && !farFrom) unresolved.push('No home state detected; distance cannot be estimated.')
  if (sat == null && act == null) {
    unresolved.push('No test score detected; academic strength will use GPA only, at limited evidence.')
  }

  return {
    student_name: parseName(notes),
    academic: { gpa, sat, act, rigor_notes: null },
    home_state: state?.abbr ?? null,
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
  if (/\bart/.test(words) && !/martial/.test(words)) return 'art'
  if (/computer|programming|coding|software/.test(words)) return 'computer_science'
  if (/marine|ocean/.test(words)) return 'marine_biology'
  if (/nurs/.test(words)) return 'nursing'
  if (/engineer/.test(words)) return 'engineering'
  if (/business|finance|econ/.test(words)) return 'business'
  if (/environment|sustain/.test(words)) return 'environmental_science'
  if (/educat|teach/.test(words)) return 'education'
  if (/agricult/.test(words)) return 'agriculture'
  if (/\bbio/.test(words)) return 'biology'
  return null
}

function looksFarFromHome(c) {
  if (c?.value && typeof c.value === 'object' && c.value.prefer_far) return true
  const blob = `${c?.label ?? ''} ${c?.source_phrase ?? ''} ${typeof c?.value === 'string' ? c.value : ''}`
  return /(?<!too )far from home|away from home|out of state|leave (the )?state/i.test(blob)
}

function normalizeAiExtraction(data, notes) {
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
      next.label = LABEL_FOR[prog] ?? next.label
    }
    const geoObject = c.value && typeof c.value === 'object'
    if (
      c.category === 'geography' ||
      looksFarFromHome(c) ||
      geoObject?.prefer_far ||
      geoObject?.home_state ||
      geoObject?.max_miles != null
    ) {
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
        (row) => row.category === next.category && String(row.value) === String(next.value)
      )
      next.understood = fbMatch?.understood || next.label
    }
    return next
  })

  const fbArt = fallback.criteria.find((c) => c.value === 'art')
  if (fbArt && !criteria.some((c) => c.value === 'art')) criteria.push({ ...fbArt, id: `fb-${fbArt.id}` })

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
      if (!geo.understood || geo.understood === geo.label) geo.understood = fbFar.understood
    }
  }

  return {
    ...data,
    home_state: home,
    academic: {
      gpa: data.academic?.gpa ?? fallback.academic?.gpa,
      sat: data.academic?.sat ?? fallback.academic?.sat,
      act: data.academic?.act ?? fallback.academic?.act,
      rigor_notes: data.academic?.rigor_notes ?? null,
    },
    criteria,
    unresolved: [...new Set([...(data.unresolved ?? []), ...(fallback.unresolved ?? [])])],
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
