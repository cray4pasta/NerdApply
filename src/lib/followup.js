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

function looksLikeCriteriaRevision(text) {
  const t = String(text || '')
  if (/\b(why is|why was|what would|how (?:far|much)|tell me about|does |can they)\b/i.test(t)) return false
  return (
    /\b(i think|he wants|she wants|they want|wants to pursue|now interested|actually interested|switch(?:ing)? (?:the )?(?:major|program|degree)|change(?: the)? (?:major|program|degree)|look for schools with)\b/i.test(
      t
    ) || /\b(pursue|major in|degree in)\b/i.test(t)
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

export function revisionMessage({ replaced = [], added = [], kept = [] }) {
  const sports = added.some((c) => /sport|athletics/i.test(`${c.value} ${c.label}`))
  const addedLabel = added.map((c) => c.label).join(', ') || 'the new focus'
  const lead = sports ? "I'll look for schools with a strong sports program" : `I'll update the list around ${addedLabel}`
  const keepBits = keptFactLabels(kept).slice(0, 6)
  const keep = keepBits.length ? `, keeping ${keepBits.join(', ')}` : ', keeping the other confirmed facts'
  const drop = replaced.length
    ? ` Replacing ${replaced.map((c) => c.label).join(', ')} as the academic focus.`
    : '.'
  return `${lead}${keep}.${drop}`.replace(/\.\./g, '.')
}

export function followupRevision(text, { criteria = [] } = {}) {
  if (!looksLikeCriteriaRevision(text)) return null
  const incoming = extractFallback(text)
  const added = incoming.criteria.filter((c) => c.category === 'academic_interest')
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

export function classifyFollowup(text, { schools = [], removed = [], extras, criteria = [] } = {}) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return { type: 'question' }

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

  return { type: 'question' }
}

export function fallbackAnswer(text, { schools = [], settings } = {}) {
  const school = matchSchool(text, schools)
  if (!school) {
    return 'I can answer from the list, add a column, or rebuild with different priorities. Say what to change — the code still picks the schools.'
  }
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
