import { useEffect, useRef, useState } from 'react'
import ChatShell from './components/ChatShell.jsx'
import CriteriaCard from './components/CriteriaCard.jsx'
import { extractCriteria, extractFallback } from './lib/extract.js'
import { EXTRACT_STEPS, STEP_MS, holdForSteps } from './lib/progress.js'
import { STATE_NAMES } from './lib/geo.js'
import { buildList } from './lib/engine.js'
import { assertList } from './lib/guardrails.js'
import { getRationales } from './lib/rationale.js'
import { loadSyntheticCatalog } from './lib/synthesize.js'
import { engineInputs, settingsFromConversation, toTableRow } from './lib/listRows.js'
import {
  createConversation,
  createSchool,
  guessName,
  loadCaseload,
  newId,
  recoverInFlight,
  saveCaseload,
  schoolIdForNotes,
  titleFrom,
} from './lib/caseload.js'
import { answerFollowup, bumpPriority, classifyFollowup } from './lib/followup.js'

const CONTINUE_PHRASE =
  /^(continue|yes|yep|yeah|y|ok|okay|sure|looks good(?:[,\s].*)?|looks right|confirm|next|done)$/i
const BUILD_PHRASE = /^(build|build (the|my) list|continue|yes|yep|yeah|y|ok|okay|sure|go|generate|done)$/i

function addMessage(c, msg) {
  return { ...c, messages: [...c.messages, { id: newId(), ...msg }] }
}

function displayHomeState(c) {
  const raw = c.listSettings?.homeState || c.homeState || c.extraction?.home_state
  if (!raw) return null
  if (String(raw).length === 2) return STATE_NAMES[String(raw).toUpperCase()] || raw
  return raw
}

function settledCriteriaText(c) {
  const phrases = (c.criteria ?? []).map((r) => r.understood || r.label).filter(Boolean)
  const home = displayHomeState(c)
  const hasHome =
    home &&
    phrases.some((p) => {
      const lower = p.toLowerCase()
      return lower.includes('home state') || lower.includes(String(home).toLowerCase())
    })
  const withHome = home && !hasHome ? [phrases[0], `Home state: ${home}`, ...phrases.slice(1)].filter(Boolean) : phrases
  if (withHome.length) return withHome.slice(0, 6).join(' · ')
  return 'Criteria as reviewed'
}

function statusMessage(steps, activeIndex = 0) {
  const i = Math.min(activeIndex, steps.length - 1)
  return { role: 'assistant', text: steps[i], card: 'status', steps, activeIndex: i }
}

function setStatusStep(c, steps, activeIndex) {
  const i = Math.min(activeIndex, steps.length - 1)
  return {
    ...c,
    messages: c.messages.map((m) => (m.card === 'status' ? { ...m, steps, activeIndex: i, text: steps[i] } : m)),
  }
}

export default function App() {
  const [saved] = useState(() => loadCaseload())
  const [conversations, setConversations] = useState(saved.conversations)
  const [schools, setSchools] = useState(saved.schools)
  const [activeId, setActiveId] = useState(saved.activeId ?? saved.conversations[0].id)
  const [sidebarWidth, setSidebarWidth] = useState(saved.sidebarWidth)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(saved.sidebarCollapsed)
  const [query, setQuery] = useState('')
  const [followupBusy, setFollowupBusy] = useState(false)
  const draftSettingsRef = useRef(null)

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0]

  useEffect(() => {
    saveCaseload({ schools, conversations, activeId, sidebarWidth, sidebarCollapsed })
  }, [schools, conversations, activeId, sidebarWidth, sidebarCollapsed])

  useEffect(() => {
    setConversations((prev) => prev.map(recoverInFlight))
  }, [])

  useEffect(() => {
    if (active.phase !== 'extracting') return undefined
    const id = active.id
    const timer = setInterval(() => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c
          const status = c.messages.find((m) => m.card === 'status')
          if (!status) return c
          const next = Math.min((status.activeIndex ?? 0) + 1, EXTRACT_STEPS.length - 1)
          if (next === status.activeIndex) return c
          return { ...setStatusStep(c, EXTRACT_STEPS, next), updatedAt: Date.now() }
        })
      )
    }, STEP_MS)
    const stuck = setTimeout(() => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c
          if (c.phase !== 'extracting' || !c.notes) return c
          const result = extractFallback(c.notes)
          const aid = result.affordability_signal?.aid_needed
          const messages = c.messages.filter((m) => m.card !== 'status' && m.card !== 'criteria')
          return addMessage(
            {
              ...c,
              messages,
              extraction: result,
              criteria: result.criteria ?? [],
              homeState: result.home_state ?? c.homeState,
              incomeBand: aid ? '30001-48000' : c.incomeBand,
              maxOutOfPocket: aid ? 15000 : c.maxOutOfPocket,
              phase: 'criteria',
              title: titleFrom(c.notes, result),
              error: null,
            },
            {
              role: 'assistant',
              text: 'Here is what I understood. Review and edit before anything generates. A row with no source phrase is a row the model invented.',
              card: 'criteria',
              locked: false,
            }
          )
        })
      )
    }, STEP_MS * EXTRACT_STEPS.length + 3000)
    return () => {
      clearInterval(timer)
      clearTimeout(stuck)
    }
  }, [active.phase, active.id])

  function patch(id, fn) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...fn(c), updatedAt: Date.now() } : c)))
  }

  function startNewConversation(schoolId = null) {
    const blank = conversations.find(
      (c) => c.messages.length === 0 && (c.schoolId ?? null) === (schoolId ?? null)
    )
    if (blank) {
      setActiveId(blank.id)
      return
    }
    const next = createConversation(schoolId)
    setConversations((prev) => [next, ...prev])
    setActiveId(next.id)
  }

  function addSchool() {
    setSchools((prev) => [createSchool('New school'), ...prev])
  }

  function renameSchool(id, name) {
    setSchools((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  function toggleSchool(id) {
    setSchools((prev) => prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s)))
  }

  function moveStudent(id, schoolId) {
    patch(id, (c) => ({ ...c, schoolId }))
  }

  function deleteStudent(id) {
    const remaining = conversations.filter((c) => c.id !== id)
    const next = remaining.length ? remaining : [createConversation()]
    setConversations(next)
    if (!next.some((c) => c.id === activeId)) setActiveId(next[0].id)
  }

  function deleteSchool(schoolId) {
    setConversations((prev) =>
      prev.map((c) => (c.schoolId === schoolId ? { ...c, schoolId: null, updatedAt: Date.now() } : c))
    )
    setSchools((prev) => prev.filter((s) => s.id !== schoolId))
  }

  function openPriorities(id, userText) {
    patch(id, (c) => {
      let next = { ...c, phase: 'priorities' }
      if (userText) next = addMessage(next, { role: 'user', text: userText })
      return next
    })
  }

  function startBuilding(id, settings, userText, assistantText, snapshotPatch = null) {
    const conv = conversations.find((c) => c.id === id)
    const nextSettings = settings ?? draftSettingsRef.current ?? settingsFromConversation(conv ?? {})
    const snapshot = {
      notes: snapshotPatch?.notes ?? conv?.notes ?? '',
      criteria: snapshotPatch?.criteria ?? conv?.criteria ?? [],
      extraction: {
        ...(conv?.extraction ?? {}),
        list_size: nextSettings.listSize ?? conv?.extraction?.list_size,
      },
      homeState: conv?.homeState,
      incomeBand: conv?.incomeBand,
      maxOutOfPocket: conv?.maxOutOfPocket,
    }
    patch(id, (c) => {
      let next = {
        ...c,
        notes: snapshot.notes,
        criteria: snapshot.criteria,
        phase: 'building',
        listSettings: nextSettings,
        removedSchoolIds: [],
        listSent: false,
        list: [],
        listReady: false,
        animationDone: false,
        extras: { columnLibrary: [], studentColumns: [] },
        pendingColumn: nextSettings.pendingColumn ?? null,
        editingPriorities: false,
        homeState: nextSettings.homeState,
        maxOutOfPocket: Number(String(nextSettings.maxOop).replace(/[^0-9]/g, '')) || 25000,
        error: null,
      }
      if (userText) next = addMessage(next, { role: 'user', text: userText, chapter: c.phase === 'list' ? 'list' : undefined })
      if (assistantText) next = addMessage(next, { role: 'assistant', text: assistantText, chapter: 'list' })
      return next
    })
    void runGenerate(id, snapshot, nextSettings)
  }

  async function runGenerate(id, snapshot, settings) {
    try {
      const inputs = engineInputs(snapshot, settings)
      const catalog = await loadSyntheticCatalog({
        notes: snapshot.notes,
        criteria: snapshot.criteria,
        academic: inputs.academic,
        homeState: inputs.home_state,
        incomeBand: inputs.income_band,
        cap: inputs.max_out_of_pocket,
        listSize: inputs.listSize,
      })
      let built = buildList({
        schools: catalog.schools,
        criteria: inputs.criteria,
        income_band: inputs.income_band,
        max_out_of_pocket: inputs.max_out_of_pocket,
        home_state: inputs.home_state,
        academic: inputs.academic,
        priorityOrder: inputs.priorityOrder,
        listSize: inputs.listSize,
      })
      if (!built.length || (inputs.listSize && built.length < inputs.listSize)) {
        const filled = buildList({
          schools: catalog.schools,
          criteria: inputs.criteria.map((c) => (c.category === 'geography' ? { ...c, strength: 'flexible' } : c)),
          income_band: inputs.income_band,
          max_out_of_pocket: inputs.max_out_of_pocket,
          home_state: inputs.home_state,
          academic: inputs.academic,
          priorityOrder: inputs.priorityOrder,
          listSize: inputs.listSize,
        })
        if (filled.length > built.length) built = filled
      }
      const rationales = await getRationales(built, snapshot.criteria)
      const labelled = built.map((s) => ({ ...s, rationale: rationales[s.id] ?? '' }))
      assertList(labelled)
      const rows = labelled.map((s) =>
        toTableRow(s, s.rationale, inputs.max_out_of_pocket, inputs.home_state, inputs.criteria),
      )
      patch(id, (c) => {
        if (c.phase !== 'building' && c.phase !== 'list') return c
        return {
          ...c,
          list: rows,
          rationales,
          extras: catalog.extras,
          catalogSource: catalog.source,
          catalogNote: catalog.source === 'llm' ? 'Catalog invented for this prompt.' : 'Catalog overlaid for this prompt.',
          listReady: true,
          phase: c.animationDone || c.phase === 'list' ? 'list' : 'building',
          error: null,
        }
      })
    } catch (err) {
      console.error('[app] list generation failed', err)
      patch(id, (c) => {
        if (c.phase !== 'building') return c
        return addMessage(
          { ...c, phase: 'priorities', listReady: false, animationDone: false, error: err.message },
          {
            role: 'assistant',
            text: 'I could not finish that list. Check the priorities and build again.',
            tone: 'flag',
          }
        )
      })
    }
  }

  function finishBuilding(id) {
    patch(id, (c) => {
      if (c.phase !== 'building') return c
      if (c.listReady && c.list?.length) return { ...c, animationDone: true, phase: 'list' }
      return { ...c, animationDone: true }
    })
  }

  function rebuildList(id, settings) {
    const conv = conversations.find((c) => c.id === id)
    startBuilding(id, settings ?? conv?.listSettings ?? draftSettingsRef.current ?? settingsFromConversation(conv ?? {}))
  }

  async function handleListFollowup(id, text) {
    const conv = conversations.find((c) => c.id === id)
    if (!conv) return
    const removedIds = conv.removedSchoolIds ?? []
    const live = (conv.list ?? []).filter((s) => !removedIds.includes(s.id))
    const removed = (conv.list ?? []).filter((s) => removedIds.includes(s.id))
    const settings = conv.listSettings ?? settingsFromConversation(conv)
    const action = classifyFollowup(text, { schools: live, removed, extras: conv.extras, criteria: conv.criteria })

    function note(update, assistant) {
      patch(id, (c) => {
        let next = addMessage(c, { role: 'user', text, chapter: 'list' })
        if (update) next = { ...next, ...update(next) }
        if (assistant) next = addMessage(next, { role: 'assistant', text: assistant, chapter: 'list' })
        return next
      })
    }

    if (action.type === 'remove') {
      note((c) => ({ removedSchoolIds: [...(c.removedSchoolIds ?? []), action.school.id] }), `Removed ${action.school.name}. Money and mix update on the card above.`)
      return
    }

    if (action.type === 'restore') {
      note((c) => ({ removedSchoolIds: (c.removedSchoolIds ?? []).filter((x) => x !== action.school.id) }), `Put ${action.school.name} back.`)
      return
    }

    if (action.type === 'add_column') {
      note(() => ({ pendingColumn: action.column }), `Added “${action.column.label}”. Missing values are flagged rather than guessed.`)
      return
    }

    if (action.type === 'reopen_priorities') {
      note(() => ({ editingPriorities: true }), 'Revise the ranking below, then build a new list. This one stays until you do.')
      return
    }

    if (action.type === 'reopen_criteria') {
      note(() => ({ phase: 'criteria', editingPriorities: false }))
      return
    }

    if (action.type === 'new_conversation') {
      startNewConversation(conv.schoolId)
      return
    }

    if (action.type === 'new_notes') {
      await runExtraction(id, `${conv.notes}\n\n${text}`.trim())
      return
    }

    if (action.type === 'revise_criteria') {
      const notes = `${conv.notes}\n\n${text}`.trim()
      startBuilding(id, settings, text, action.message, { notes, criteria: action.criteria })
      return
    }

    if (action.type === 'rebuild') {
      const order = action.priority ? bumpPriority(settings.order, action.priority) : settings.order
      const nextSettings = {
        ...settings,
        order,
        listSize: action.listSize ?? settings.listSize,
        pendingColumn: action.column || null,
      }
      const why = [
        action.priority ? `${action.priority.toLowerCase()} first` : null,
        action.listSize ? `${action.listSize} schools` : null,
        action.column ? `“${action.column.label}” column` : null,
      ]
        .filter(Boolean)
        .join(', ')
      startBuilding(
        id,
        nextSettings,
        text,
        why ? `Building a new list — ${why}.` : 'Building a new list from the same criteria.'
      )
      return
    }

    setFollowupBusy(true)
    patch(id, (c) => addMessage(c, { role: 'user', text, chapter: 'list' }))
    try {
      const answer = await answerFollowup(text, { schools: live, criteria: conv.criteria, settings })
      patch(id, (c) => addMessage(c, { role: 'assistant', text: answer, chapter: 'list' }))
    } finally {
      setFollowupBusy(false)
    }
  }

  async function runExtraction(id, text) {
    patch(id, (c) => {
      const untitled = c.title === 'New list' || c.title === 'New student'
      const filed = schoolIdForNotes(text)
      let next = {
        ...c,
        notes: text,
        phase: 'extracting',
        error: null,
        title: untitled ? guessName(text, null) || 'New student' : c.title,
        schoolId: filed !== undefined ? filed : c.schoolId,
      }
      next = addMessage(next, { role: 'user', text })
      return addMessage(next, statusMessage(EXTRACT_STEPS, 0))
    })

    try {
      const started = Date.now()
      const result = extractFallback(text)
      await holdForSteps(started, EXTRACT_STEPS.length)
      const aid = result.affordability_signal?.aid_needed
      patch(id, (c) => {
        const withoutStatus = { ...c, messages: c.messages.filter((m) => m.card !== 'status') }
        return addMessage(
          {
            ...withoutStatus,
            extraction: result,
            criteria: result.criteria ?? [],
            homeState: result.home_state ?? null,
            incomeBand: aid ? '30001-48000' : '75001-110000',
            maxOutOfPocket: aid ? 15000 : 25000,
            phase: 'criteria',
            title: titleFrom(text, result),
          },
          {
            role: 'assistant',
            text: 'Here is what I understood. Review and edit before anything generates. A row with no source phrase is a row the model invented.',
            card: 'criteria',
            locked: false,
          }
        )
      })
      extractCriteria(text)
        .then((ai) => {
          if (ai?.degraded) return
          patch(id, (c) => {
            if (c.phase !== 'criteria') return c
            return {
              ...c,
              extraction: ai,
              criteria: ai.criteria ?? c.criteria,
              homeState: ai.home_state ?? c.homeState,
            }
          })
        })
        .catch((err) => {
          console.warn('[app] Gemini extract skipped', err)
        })
    } catch (err) {
      console.error('[app] extraction failed', err)
      patch(id, (c) => {
        const withoutStatus = { ...c, messages: c.messages.filter((m) => m.card !== 'status'), phase: 'idle' }
        return addMessage(withoutStatus, {
          role: 'assistant',
          text: 'I could not read those notes. Paste them again, or try one of the example students.',
          tone: 'flag',
        })
      })
    }
  }

  async function handleSend(text) {
    const id = active.id
    const trimmed = text.trim()
    if (!trimmed) return
    if (active.phase === 'extracting' || active.phase === 'building' || followupBusy) return

    if (active.phase === 'idle') {
      await runExtraction(id, trimmed)
      return
    }

    if (active.phase === 'criteria') {
      if (CONTINUE_PHRASE.test(trimmed)) {
        openPriorities(id, trimmed)
      } else {
        patch(id, (c) =>
          addMessage(addMessage(c, { role: 'user', text: trimmed }), {
            role: 'assistant',
            text: 'Edit the table above, then press Next. I will not pick schools until you confirm.',
          })
        )
      }
      return
    }

    if (active.phase === 'priorities') {
      if (BUILD_PHRASE.test(trimmed)) startBuilding(id, draftSettingsRef.current ?? settingsFromConversation(active), trimmed)
      else {
        patch(id, (c) =>
          addMessage(addMessage(c, { role: 'user', text: trimmed }), {
            role: 'assistant',
            text: 'Reorder the rows on the card, or tell me what to change. Then press Build the list.',
          })
        )
      }
      return
    }

    if (active.phase === 'list') {
      await handleListFollowup(id, trimmed)
    }
  }

  function fieldSetter(id, field) {
    return (value) => {
      patch(id, (c) => ({
        ...c,
        [field]: typeof value === 'function' ? value(c[field]) : value,
      }))
    }
  }

  return (
    <ChatShell
      sidebarWidth={sidebarWidth}
      onSidebarWidth={setSidebarWidth}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarCollapsed={setSidebarCollapsed}
      conversations={conversations}
      schools={schools}
      activeId={active.id}
      query={query}
      onQuery={setQuery}
      onSelectConversation={setActiveId}
      onNewConversation={startNewConversation}
      onNewSchool={addSchool}
      onRenameSchool={renameSchool}
      onToggleSchool={toggleSchool}
      onMoveStudent={moveStudent}
      onDeleteStudent={deleteStudent}
      onDeleteSchool={deleteSchool}
      messages={active.messages}
      phase={active.phase}
      onSend={handleSend}
      listSettings={active.listSettings ?? settingsFromConversation(active)}
      criteriaSummary={settledCriteriaText(active)}
      criteria={active.criteria ?? []}
      academic={active.extraction?.academic ?? {}}
      generatedList={active.list ?? []}
      extras={active.extras}
      studentName={guessName(active.notes, active.extraction) || 'Student'}
      schoolLabel={schools.find((s) => s.id === active.schoolId)?.name || 'Central High'}
      removedSchoolIds={active.removedSchoolIds ?? []}
      studentCopy={Boolean(active.studentCopy)}
      onStudentCopy={(value) => patch(active.id, (c) => ({ ...c, studentCopy: value }))}
      listSent={Boolean(active.listSent)}
      onMarkSent={() => patch(active.id, (c) => ({ ...c, listSent: true }))}
      onBuildList={(settings) => startBuilding(active.id, settings)}
      onBuildDone={() => finishBuilding(active.id)}
      onReopenCriteria={() => patch(active.id, (c) => ({ ...c, phase: 'criteria', editingPriorities: false }))}
      onReopenPriorities={() =>
        patch(active.id, (c) => ({
          ...c,
          editingPriorities: !c.editingPriorities,
          phase: c.phase === 'list' ? 'list' : 'priorities',
        }))
      }
      editingPriorities={Boolean(active.editingPriorities)}
      pendingColumn={active.pendingColumn ?? null}
      onConsumeColumn={() => patch(active.id, (c) => ({ ...c, pendingColumn: null }))}
      followupBusy={followupBusy}
      onPrioritiesDraft={(settings) => {
        draftSettingsRef.current = settings
      }}
      onRebuild={() => rebuildList(active.id)}
      dockedCard={
        active.phase === 'extracting' || active.phase === 'criteria' ? (
          <CriteriaCard
            pending={active.phase === 'extracting' ? 4 : 0}
            criteria={active.phase === 'criteria' ? active.criteria : []}
            onChange={active.phase === 'criteria' ? fieldSetter(active.id, 'criteria') : undefined}
            onNext={active.phase === 'criteria' ? () => openPriorities(active.id) : undefined}
          />
        ) : null
      }
    />
  )
}
