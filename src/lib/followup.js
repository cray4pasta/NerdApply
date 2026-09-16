// Follow-ups after a list exists. The model may write an answer from facts already on
// the sheet. It never picks a school, assigns a band, or invents a number.
import { PRIORITY_LABELS } from '../data/listBuilder.js'
import { extractFallback, parseListSize } from './extract.js'
import { fetchWithTimeout } from './progress.js'

const PRIORITY_HINTS = [
  { label: 'Affordability', re: /\baffordab|\bcheaper\b|\bless expensive\b|\bunder (the )?cap\b|\bmoney first\b|\bcost first\b|\bmore affordable\b/i },
  { label: 'Academic programme strength', re: /\b(programme strength|program strength|stronger programs|academic first)\b/i },
  { label: 'Closeness to home', re: /\b(closer to home|near home|proximity|not too far|distance first)\b/i },
  { label: 'Admissions realism', re: /\b(more likel(?:y|ies)|too many reach(?:es)?|fewer reach(?:es)?|less reach(?:es)?|admissions realism|safer mix)\b/i },
  { label: 'Campus environment and fit', re: /\b(campus (environment|fit|life) first|environment first)\b/i },
  { label: 'Student support services', re: /\b(support services|student support first)\b/i },
]

export function matchSchool(text, schools) {
  if (!text || !schools?.length) return null
  const lower = text.toLowerCase()
  return (
    schools.find((s) => lower.includes(s.name.toLowerCase())) ||
    schools.find((s) => {
      const tokens = s.name.toLowerCase().split(/[\s–/,]+/).filter((t) => t.length > 4)
      return tokens.some((t) => lower.includes(t))
    })
  )
}

function looksLikeAsk(text, schools) {
  const parts = String(text).split(/\s+[—–-]\s+/)
  if (parts.length < 2) return false
  return Boolean(matchSchool(parts[0], schools))
}

function extractColumnPrompt(text) {
  const m =
    String(text).match(/\bcolumns?\s+(?:for|on|about)\s+(.+)/i) ||
    String(text).match(/\badd\s+(?:a\s+|the\s+)?(?:column\s+)?(?:for\s+)?(.+)/i) ||
    String(text).match(/\bshow\s+(.+)/i)
  return (m ? m[1] : text).replace(/\bcolumns?\b/gi, '').replace(/[.?!]$/, '').trim()
}

const NAMED_COLUMNS = [
  { id: 'cost', label: 'Est. cost', re: /\b(cost|afford|tuition|price|money)\b/i },
  { id: 'distance', label: 'Distance', re: /\b(distance|proximity|how far|closeness)\b/i },
  { id: 'band', label: 'Admissions', re: /\b(admissions|likely|target|reach band)\b/i },
  { id: 'program', label: 'Programme', re: /\b(programme|program)\b/i },
  { id: 'environment', label: 'Campus', re: /\b(campus|environment|setting)\b/i },
  { id: 'support', label: 'Support', re: /\b(support)\b/i },
  { id: 'rate', label: 'Admit rate', re: /\b(admit rate|acceptance)\b/i },
  { id: 'rationale', label: 'Why it is here', re: /\b(why it is here|rationale)\b/i },
]

export function columnFromRequest(text, { schools = [], library = [] } = {}) {
  const prompt = extractColumnPrompt(text)
  if (!prompt) return null
  const named = NAMED_COLUMNS.find((c) => c.re.test(prompt))
  if (named) return { id: named.id, label: named.label }
  const lower = prompt.toLowerCase()
  const hit = library.find((c) => {
    const label = String(c.label || '').toLowerCase()
    const p = String(c.prompt || '').toLowerCase()
    return (label && lower.includes(label)) || (p && lower.includes(p.slice(0, 24)))
  })
  if (hit) return { ...hit }
  const values = {}
  for (const s of schools) {
    if (/\b(club|robotics|social|campus|athletics|ncaa|life)\b/i.test(prompt)) {
      values[s.id] = s.clubs || s.campus_life || ''
    }
  }
  return {
    id: `c${Date.now()}`,
    label: prompt.length > 24 ? `${prompt.slice(0, 24)}…` : prompt,
    prompt,
    values,
  }
}

function priorityFromText(text) {
  const found = PRIORITY_HINTS.find((h) => h.re.test(text))
  if (found) return found.label
  if (!/\b(first|top|priority|prioritize|prioritise)\b/i.test(text)) return null
  const lower = String(text).toLowerCase()
  return PRIORITY_LABELS.find((label) => lower.includes(label.toLowerCase())) ?? null
}

export function bumpPriority(order, label) {
  const base = (order ?? [...PRIORITY_LABELS]).filter((x) => x !== label)
  return [label, ...base]
}

function listSizeIn(text) {
  return parseListSize(text) || parseListSize(`list of ${text}`)
}

function isSatCriterion(c) {
  return String(c?.label).startsWith('SAT')
}

export function parseFollowupSat(text) {
  const t = String(text || '')
  if (/\b(why is|why was|what would|how (?:far|much)|tell me about|does |can they)\b/i.test(t)) return null
  if (!/\bsat\b/i.test(t)) return null
  const updatey =
    /\b(improved|now|went\s+up|went\s+down|updated|raised|jumped|scored)\b/i.test(t) ||
    /\bsat\s+(?:score\s+)?(?:is|to)\b/i.test(t) ||
    /\bupdated\s+sat\b/i.test(t)
  if (!updatey) return null
  const m = t.match(/\bsat[^0-9]{0,48}(\d{3,4})\b/i) || t.match(/\b(\d{3,4})\s*(?:SAT|on the SAT)\b/i)
  if (!m) return null
  const requested = Number(m[1])
  if (!Number.isFinite(requested) || requested < 400) return null
  const used = Math.min(1600, requested)
  return { requested, used, capped: requested > 1600, phrase: m[0].trim() }
}

function looksLikeCriteriaRevision(text) {
  const t = String(text || '')
  if (/\b(why is|why was|what would|how (?:far|much)|tell me about|does |can they)\b/i.test(t)) return false
  if (parseFollowupSat(t)) return true
  return (
    /\b(i think|he wants|she wants|they want|wants to pursue|now interested|actually interested|switch(?:ing)? to|switch(?:ing)? (?:the )?(?:major|program|degree)|change(?: the)? (?:major|program|degree)|look for schools with)\b/i.test(
      t
    ) ||
    /\b(pursue|major in|degree in)\b/i.test(t) ||
    /\bactually(?:\s+it'?s)?\s+\S/i.test(t) ||
    /\b(lock(?:ing)? in|set on)\b/i.test(t) ||
    /\b(hiking|outdoors?|mountains?)\b/i.test(t)
  )
}

function keptFactLabels(criteria) {
  return (criteria ?? [])
    .filter(
      (c) =>
        c.category === 'geography' ||
        c.category === 'other' ||
        String(c.label).startsWith('SAT') ||
        String(c.label).startsWith('GPA')
    )
    .map((c) => c.label)
    .filter(Boolean)
}

function isHikingCriterion(c) {
  return c?.value === 'hiking' || /hiking|outdoors/i.test(`${c?.value ?? ''} ${c?.label ?? ''}`)
}

export function revisionMessage({ replaced = [], added = [], kept = [] }) {
  const sports = added.some((c) => /sport|athletics/i.test(`${c.value} ${c.label}`))
  const hiking = added.some(isHikingCriterion)
  const lockingLaw =
    added.some((c) => c.value === 'law' && c.strength === 'required') &&
    replaced.some((c) => c.value === 'law' && c.strength !== 'required')
  const addedLabel = added.map((c) => c.label).join(', ') || 'the new focus'
  const lead = hiking
    ? "I'll look for campuses with hiking and mountain access"
    : sports
      ? "I'll look for schools with a strong sports program"
      : lockingLaw
        ? "I'll lock in law"
        : `I'll update the list around ${addedLabel}`
  const keepBits = []
  if (hiking) {
    for (const c of kept ?? []) {
      if (c.category === 'academic_interest' && c.label && !keepBits.includes(c.label)) keepBits.push(c.label)
    }
  }
  for (const label of keptFactLabels(kept)) {
    if (!keepBits.includes(label)) keepBits.push(label)
  }
  const keep = keepBits.length ? `, keeping ${keepBits.slice(0, 6).join(', ')}` : ', keeping the other confirmed facts'
  const drop = replaced.length
    ? ` Replacing ${replaced.map((c) => c.label).join(', ')} as the academic focus.`
    : '.'
  return `${lead}${keep}.${drop}`.replace(/\.\./g, '.')
}

function satRowFromUpdate(update, previous) {
  const understood = update.capped
    ? `${update.requested} is above the SAT maximum of 1600 — SAT ${update.used} is on file for admissions comparison.`
    : `SAT ${update.used} is on file for admissions comparison.`
  return {
    ...(previous ?? {}),
    id: previous?.id || `sat-${update.used}`,
    category: 'other',
    label: `SAT ${update.used}`,
    value: update.used,
    confidence: previous?.confidence || 'low',
    source_phrase: update.phrase,
    strength: previous?.strength || 'required',
    understood,
  }
}

function satRevisionMessage(update, kept) {
  const capBit = update.capped
    ? `${update.requested} is above the SAT maximum, so the file uses ${update.used}. `
    : ''
  const major = (kept ?? []).find((c) => c.category === 'academic_interest')
  const keepBits = [major?.label, ...keptFactLabels(kept)].filter(Boolean).slice(0, 6)
  const keep = keepBits.length ? `, keeping ${keepBits.join(', ')}` : ', keeping the other confirmed facts'
  return `${capBit}The SAT on file is now ${update.used}${keep}. Rebuilding the list so Likely, Target, and Reach can move.`
}

export function followupRevision(text, { criteria = [] } = {}) {
  const satUpdate = parseFollowupSat(text)
  if (satUpdate) {
    const previous = (criteria ?? []).find(isSatCriterion)
    const added = [satRowFromUpdate(satUpdate, previous)]
    const replaced = previous ? [previous] : []
    const kept = (criteria ?? []).filter((c) => !isSatCriterion(c))
    return {
      criteria: [...kept, ...added],
      replaced,
      added,
      academic: { sat: satUpdate.used },
      message: satRevisionMessage(satUpdate, kept),
    }
  }
  if (!looksLikeCriteriaRevision(text)) return null
  const incoming = extractFallback(text)
  const hikingAdded = incoming.criteria.filter(isHikingCriterion)
  const added = incoming.criteria.filter((c) => c.category === 'academic_interest')
  if (hikingAdded.length && !added.length) {
    const extras = hikingAdded.filter(
      (c) => typeof c.value === 'string' && !(criteria ?? []).some((k) => k.value === c.value)
    )
    if (!extras.length) return null
    return {
      criteria: [...(criteria ?? []), ...extras],
      replaced: [],
      added: extras,
      message: revisionMessage({ replaced: [], added: extras, kept: criteria }),
    }
  }
  if (!added.length) return null
  const replaced = (criteria ?? []).filter((c) => c.category === 'academic_interest')
  const kept = (criteria ?? []).filter((c) => c.category !== 'academic_interest')
  const extras = incoming.criteria.filter(
    (c) => c.category === 'other' && typeof c.value === 'string' && !kept.some((k) => k.value === c.value)
  )
  return {
    criteria: [...kept, ...added, ...extras],
    replaced,
    added,
    message: revisionMessage({ replaced, added, kept }),
  }
}

export const UNKNOWN_FOLLOWUP =
  "Hmm, that's not something I am currently prepared of doing. I can answer from the list, add a column, or rebuild with different priorities"

const CHAT_RE =
  /^(hi+|hello|hey(?: there)?|yo|sup|what'?s up|whats up|how are you|how'?s it going|hows it going|good (?:morning|afternoon|evening)|thanks?(?: you)?|thx|cheers|ok|okay|cool|nice)[.!?]*$/i

export function isChatFollowup(text) {
  return CHAT_RE.test(String(text || '').trim())
}

export function chatReply(text) {
  const t = String(text || '').trim().toLowerCase()
  if (/thanks|thx|thank you|cheers/.test(t)) {
    return 'Anytime. I can answer from the list, add a column, or rebuild with different priorities.'
  }
  if (/what'?s up|whats up|how are you|how'?s it going|hows it going|sup/.test(t)) {
    return "Not much — this list is still here. Ask about a school, add a column, or rebuild whenever you're ready."
  }
  return "Hi. Ask about a school on the list, add a column, or rebuild with different priorities whenever you're ready."
}

function looksLikeQuestion(text) {
  return (
    /\?/.test(text) ||
    /^(why|how|what|which|who|where|when|tell me|explain|does|is |are |can |could |should |would )\b/i.test(text)
  )
}

function looksLikeUnsupportedTask(text) {
  return /\b(write|draft|compose|email|book |schedule |download|powerpoint|resume|recommendation letter|rec letter|cover letter|apply for|translate|make me a|create a)\b/i.test(
    text
  )
}

export function classifyFollowup(text, { schools = [], removed = [], extras, criteria = [] } = {}) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return { type: 'unknown' }
  if (isChatFollowup(trimmed)) return { type: 'chat' }

  if (/\b(remove|drop|delete|cut|take)\b/i.test(trimmed)) {
    const school = matchSchool(trimmed, schools)
    if (school) return { type: 'remove', school }
  }

  if (/\b(put back|restore|undo)\b/i.test(trimmed)) {
    const school = matchSchool(trimmed, removed) || matchSchool(trimmed, schools)
    if (school) return { type: 'restore', school }
  }

  if (looksLikeAsk(trimmed, schools) || looksLikeAsk(trimmed, removed)) {
    return { type: 'question' }
  }

  if (/\b(new student|different student|start over|new conversation)\b/i.test(trimmed) && trimmed.length < 80) {
    return { type: 'new_conversation' }
  }

  if (/\b(change|edit|reopen|revise|update|tweak)\b.*\b(priorit|rank|weight)|different priorit/i.test(trimmed)) {
    return { type: 'reopen_priorities' }
  }

  if (/\b(change|edit|reopen|revise|update)\b.*\b(criteria|notes)\b/i.test(trimmed)) {
    return { type: 'reopen_criteria' }
  }

  if (/\b(add|show|put)\b.+\bcolumns?\b|\bcolumns?\s+for\b/i.test(trimmed)) {
    const column = columnFromRequest(trimmed, { schools, library: extras?.columnLibrary ?? [] })
    if (column) return { type: 'add_column', column }
  }

  if (matchSchool(trimmed, schools) || matchSchool(trimmed, removed)) {
    if (!looksLikeCriteriaRevision(trimmed)) return { type: 'question' }
  }

  const revision = followupRevision(trimmed, { criteria })
  if (revision) {
    return { type: 'revise_criteria', ...revision }
  }

  const size = listSizeIn(trimmed)
  const hint = priorityFromText(trimmed)
  const moreSchools = /\b(add a school|more schools)\b/i.test(trimmed)
  const wantsRebuild =
    /\b(rebuild|regenerate|new list|run it again|generate a new list|swap in|build (a |the )?new list)\b/i.test(trimmed) ||
    moreSchools

  if (hint || size || wantsRebuild) {
    const extra = moreSchools && /two\b/i.test(trimmed) ? 2 : 1
    return {
      type: 'rebuild',
      priority: hint,
      listSize: size || (moreSchools ? Math.min(24, Math.max(6, (schools.length || 8) + extra)) : null),
      column:
        /\bcolumns?\b/i.test(trimmed)
          ? columnFromRequest(trimmed, { schools, library: extras?.columnLibrary ?? [] })
          : null,
    }
  }

  if (trimmed.length > 280 && /\b(gpa|sat|act|student|interested|lives? in)\b/i.test(trimmed)) {
    return { type: 'new_notes' }
  }

  if (looksLikeUnsupportedTask(trimmed)) return { type: 'unknown' }
  if (looksLikeQuestion(trimmed)) return { type: 'question' }
  return { type: 'unknown' }
}

export function fallbackAnswer(text, { schools = [], settings } = {}) {
  if (isChatFollowup(text)) return chatReply(text)
  const school = matchSchool(text, schools)
  if (!school) return UNKNOWN_FOLLOWUP
  if (/why.*\b(likely|target|reach)\b|why is this/i.test(text)) {
    return `${school.name} is a ${school.band}. ${school.rationale} Admissions context: ${school.rate} admit rate, ${school.midSat}. Affordability is a separate label: ${school.capNote}.`
  }
  if (/scholarship|merit/i.test(text)) {
    return `Named scholarships are not on this sheet — we cannot verify they are still offered. ${school.name}’s estimated yearly cost is ${school.oopText} (${school.capNote}).`
  }
  if (/aid letter|cost after aid|net price|what.*cost/i.test(text)) {
    const band = settings?.incomeBand || 'the income band you set'
    const afford = school.affordability?.band
    const affordBit = afford ? ` This row is labelled ${afford}.` : ''
    const tuition = school.tuitionLine || 'Sticker price is not on this row'
    return `No award letter is on file for ${school.name} — those come from the school after FAFSA. At ${band}, the estimate after typical aid is ${school.oopText} a year. ${tuition}. That is ${school.capNote}.${affordBit} Use the school’s net-price calculator before quoting this to a family.`
  }
  if (/ncaa|athletics|sport/i.test(text)) {
    return school.clubs
      ? `${school.name}: ${school.clubs}. NCAA division is not in the published fields we have, so it is flagged rather than guessed.`
      : `Athletics are not in the published fields for ${school.name}. Add a column if you want that tracked as a review item.`
  }
  return `${school.name} — ${school.band}, ${school.oopText}/yr, ${school.distance}. ${school.rationale}`
}

function factsFor(schools) {
  return (schools ?? []).map((s) => ({
    name: s.name,
    band: s.band,
    rate: s.rate,
    midSat: s.midSat,
    oop: s.oopText,
    capNote: s.capNote,
    tuition: s.tuitionLine || null,
    distance: s.distance,
    rationale: s.rationale,
    clubs: s.clubs || null,
    campus_life: s.campus_life || null,
    affordability: s.affordability?.band || null,
  }))
}

export async function answerFollowup(text, ctx) {
  try {
    const res = await fetchWithTimeout('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'followup',
        question: text,
        schools: factsFor(ctx.schools),
        criteria: (ctx.criteria ?? []).map((c) => c.understood || c.label),
        priorities: ctx.settings?.order ?? [],
        incomeBand: ctx.settings?.incomeBand ?? null,
        maxOop: ctx.settings?.maxOop ?? null,
      }),
    })
    if (!res.ok) throw new Error(`followup call failed: ${res.status}`)
    const data = await res.json()
    const answer = typeof data.answer === 'string' ? data.answer.trim() : ''
    if (!answer) throw new Error('empty followup answer')
    return answer
  } catch (err) {
    console.warn('[followup] AI answer unavailable, using sheet facts:', err.message)
    return fallbackAnswer(text, ctx)
  }
}
