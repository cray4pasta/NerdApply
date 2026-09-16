import { DIMENSIONS } from './engine.js'
import { SAMPLE_A, SAMPLE_B, SAMPLE_SHORT } from './samples.js'

export const STORAGE_KEY = 'nerdapply-caseload'
export const SCHOOL_CENTRAL = 'school-central'
export const SCHOOL_HARBOR = 'school-harbor'
export const SCHOOL_UNFILED = null

export function newId() {
  return crypto.randomUUID()
}

export function createSchool(name) {
  return { id: newId(), name: name || 'New school', collapsed: false }
}

export function createConversation(schoolId = SCHOOL_UNFILED) {
  return {
    id: newId(),
    schoolId,
    title: 'New student',
    messages: [],
    phase: 'idle',
    notes: '',
    extraction: null,
    criteria: [],
    incomeBand: '75001-110000',
    maxOutOfPocket: 25000,
    priorityOrder: [...DIMENSIONS],
    list: [],
    catalogSource: null,
    catalogNote: null,
    rationales: {},
    counselorNotes: {},
    homeState: null,
    error: null,
    updatedAt: Date.now(),
  }
}

export function defaultSchools() {
  return [
    { id: SCHOOL_CENTRAL, name: 'Central High (PA)', collapsed: false },
    { id: SCHOOL_HARBOR, name: 'Harborview Academy', collapsed: false },
  ]
}

export function defaultCaseload() {
  const first = createConversation()
  return {
    schools: defaultSchools(),
    conversations: [first],
    activeId: first.id,
    sidebarWidth: null,
  }
}

export function schoolIdForNotes(text) {
  if (text === SAMPLE_A.notes) return SCHOOL_CENTRAL
  if (text === SAMPLE_B.notes) return SCHOOL_HARBOR
  if (text === SAMPLE_SHORT.notes) return SCHOOL_CENTRAL
  return undefined
}

export function guessName(notes, extracted) {
  if (extracted?.student_name) return extracted.student_name
  const named = notes.match(/named\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/)
  return named ? named[1] : null
}

export function titleFrom(notes, extracted) {
  return guessName(notes, extracted) || notes.trim().slice(0, 42) || 'New student'
}

export function statusLabel(c) {
  if (c.phase === 'extracting') return 'Reading profile'
  if (c.phase === 'generating') return 'Building list'
  if (c.list?.length) return `${c.list.length} schools`
  if (c.phase === 'criteria') return 'Reviewing criteria'
  if (c.phase === 'priorities') return 'Setting priorities'
  if (c.notes) return 'Notes in progress'
  return 'New'
}

export function conversationMatches(c, schoolName, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [
    c.title,
    c.notes,
    schoolName,
    ...(c.criteria ?? []).map((row) => row.label),
    ...(c.list ?? []).map((s) => s.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

export function recoverInFlight(c) {
  const hadStatus = (c.messages ?? []).some((m) => m.card === 'status')
  if (c.phase !== 'extracting' && c.phase !== 'generating' && !hadStatus) return c
  const messages = (c.messages ?? []).filter((m) => m.card !== 'status')
  if (c.phase === 'generating') {
    return { ...c, messages, phase: c.list?.length ? 'list' : 'priorities' }
  }
  if (c.phase === 'extracting') {
    if (c.criteria?.length) return { ...c, messages, phase: 'criteria' }
    return { ...c, messages, phase: 'idle' }
  }
  return { ...c, messages }
}

export function loadCaseload() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultCaseload()
    const data = JSON.parse(raw)
    if (!Array.isArray(data.conversations) || data.conversations.length === 0) {
      return defaultCaseload()
    }
    return {
      schools: Array.isArray(data.schools) && data.schools.length ? data.schools : defaultSchools(),
      conversations: data.conversations.map((c) =>
        recoverInFlight({
          ...createConversation(c.schoolId ?? SCHOOL_UNFILED),
          ...c,
          priorityOrder: c.priorityOrder?.length ? c.priorityOrder : [...DIMENSIONS],
        })
      ),
      activeId: data.activeId,
      sidebarWidth: typeof data.sidebarWidth === 'number' ? data.sidebarWidth : null,
    }
  } catch (err) {
    console.error('[caseload] could not read saved lists', err)
    return defaultCaseload()
  }
}

export function saveCaseload(payload) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schools: payload.schools,
        conversations: payload.conversations.map(recoverInFlight),
        activeId: payload.activeId,
        sidebarWidth: payload.sidebarWidth,
      })
    )
  } catch (err) {
    console.error('[caseload] could not save lists', err)
  }
}
