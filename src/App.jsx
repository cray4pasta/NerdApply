import { useEffect, useState } from 'react'
import ChatShell from './components/ChatShell.jsx'
import CriteriaStep from './components/CriteriaStep.jsx'
import PrioritiesStep from './components/PrioritiesStep.jsx'
import ListStep from './components/ListStep.jsx'
import FamilyDocument from './components/FamilyDocument.jsx'
import { extractCriteria, extractFallback } from './lib/extract.js'
import { buildList } from './lib/engine.js'
import { loadSchoolsForList } from './lib/catalog.js'
import { getColleges } from './lib/colleges.js'
import { getRationales, templatesFor } from './lib/rationale.js'
import { assertList } from './lib/guardrails.js'
import { BUILD_STEPS, EXTRACT_STEPS, STEP_MS, holdForSteps } from './lib/progress.js'
import ProgressLog from './components/ui/ProgressLog.jsx'
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

const CONTINUE_PHRASE = /^(continue|yes|yep|yeah|y|ok|okay|sure|looks good|looks right|confirm|next|done)$/i
const BUILD_PHRASE = /^(build|build (the|my) list|continue|yes|yep|yeah|y|ok|okay|sure|go|generate|done)$/i

function viewFromPath() {
  const path = window.location.pathname
  if (path === '/print/student') return 'print-student'
  if (path === '/print/counselor') return 'print-counselor'
  return null
}

function addMessage(c, msg) {
  return { ...c, messages: [...c.messages, { id: newId(), ...msg }] }
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
  const [query, setQuery] = useState('')
  const [printView, setPrintView] = useState(() => viewFromPath())

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0]
  const busy = active.phase === 'extracting' || active.phase === 'generating'
  const canRebuild = active.phase === 'list' || Boolean(active.list?.length)

  useEffect(() => {
    function onPop() {
      setPrintView(viewFromPath())
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    saveCaseload({ schools, conversations, activeId, sidebarWidth })
  }, [schools, conversations, activeId, sidebarWidth])

  useEffect(() => {
    setConversations((prev) => prev.map(recoverInFlight))
  }, [])

  useEffect(() => {
    if (active.phase !== 'extracting' && active.phase !== 'generating') return undefined
    const steps = active.phase === 'extracting' ? EXTRACT_STEPS : BUILD_STEPS
    const id = active.id
    const timer = setInterval(() => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c
          const status = c.messages.find((m) => m.card === 'status')
          if (!status) return c
          const next = Math.min((status.activeIndex ?? 0) + 1, steps.length - 1)
          if (next === status.activeIndex) return c
          return { ...setStatusStep(c, steps, next), updatedAt: Date.now() }
        })
      )
    }, STEP_MS)
    const stuck = setTimeout(() => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c
          if (c.phase === 'extracting' && c.notes) {
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
          }
          if (c.phase === 'generating') {
            try {
              console.warn('[app] generate recover used local snapshot')
              const built = buildList({
                schools: getColleges(),
                criteria: c.criteria,
                income_band: c.incomeBand,
                max_out_of_pocket: c.maxOutOfPocket,
                home_state: c.homeState,
                academic: c.extraction?.academic ?? {},
                priorityOrder: c.priorityOrder,
              })
              assertList(built)
              const sentences = templatesFor(built, c.criteria)
              const hadList = Boolean(c.list?.length)
              const messages = c.messages.filter((m) => m.card !== 'status' && m.card !== 'list')
              return addMessage(
                {
                  ...c,
                  messages,
                  list: built,
                  rationales: sentences,
                  counselorNotes: hadList ? c.counselorNotes : {},
                  phase: 'list',
                  error: null,
                },
                {
                  role: 'assistant',
                  text: hadList
                    ? 'Updated the list from your current table and ranking. This student stays in the school folder so you can come back and edit it.'
                    : 'Here is the list. Admissions and affordability are separate labels. Remove a school if it does not belong — the balance check will update.',
                  card: 'list',
                }
              )
            } catch (err) {
              console.error('[app] stuck list generation failed', err)
              const messages = c.messages.filter((m) => m.card !== 'status')
              return addMessage(
                { ...c, messages, phase: 'priorities', error: err.message },
                { role: 'assistant', text: err.message, tone: 'flag' }
              )
            }
          }
          return c
        })
      )
    }, 5000)
    return () => {
      clearInterval(timer)
      clearTimeout(stuck)
    }
  }, [active.phase, active.id])

  function patch(id, fn) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...fn(c), updatedAt: Date.now() } : c)))
  }

  function goToChat() {
    window.history.pushState({}, '', '/')
    setPrintView(null)
  }

  function requestPrint(variant) {
    const affordable = active.list.filter((s) => s.affordability.band === 'Likely Affordable').length
    if (affordable === 0) {
      const ok = window.confirm(
        'This list has no school the family is likely to afford. Print anyway? The counselor copy will still show the warning.'
      )
      if (!ok) return
    }
    const path = variant === 'counselor' ? '/print/counselor' : '/print/student'
    window.history.pushState({}, '', path)
    setPrintView(variant === 'counselor' ? 'print-counselor' : 'print-student')
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
      return addMessage(next, {
        role: 'assistant',
        text: 'What matters most for this student? Rank these, then I will score the schools. Code does the deciding — not the model.',
        card: 'priorities',
        locked: false,
      })
    })
  }

  async function generateList(id, userText) {
    let snapshot = null
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        snapshot = c
        let next = { ...c, phase: 'generating', error: null, updatedAt: Date.now() }
        if (userText) next = addMessage(next, { role: 'user', text: userText })
        return addMessage(next, statusMessage(BUILD_STEPS, 0))
      })
    )
    if (!snapshot) return

    try {
      const started = Date.now()
      const catalog = await loadSchoolsForList({
        criteria: snapshot.criteria,
        incomeBand: snapshot.incomeBand,
      })
      if (catalog.reason === 'empty') {
        throw new Error(catalog.error)
      }
      const built = buildList({
        schools: catalog.schools,
        criteria: snapshot.criteria,
        income_band: snapshot.incomeBand,
        max_out_of_pocket: snapshot.maxOutOfPocket,
        home_state: snapshot.homeState,
        academic: snapshot.extraction?.academic ?? {},
        priorityOrder: snapshot.priorityOrder,
      })
      assertList(built)
      const sentences = templatesFor(built, snapshot.criteria)
      await holdForSteps(started, BUILD_STEPS.length)
      patch(id, (c) => {
        const hadList = Boolean(snapshot.list?.length)
        const messages = c.messages.filter((m) => m.card !== 'status' && m.card !== 'list')
        return addMessage(
          {
            ...c,
            messages,
            list: built,
            rationales: sentences,
            counselorNotes: hadList ? c.counselorNotes : {},
            catalogSource: catalog.source,
            catalogNote:
              catalog.reason === 'ok'
                ? `Catalog: College Scorecard (live)${catalog.vintage ? ` · ${catalog.vintage}` : ''}.`
                : catalog.reason === 'no_required_major'
                  ? 'No required major — using the local college snapshot.'
                  : 'College data is the local snapshot. Scorecard was unavailable.',
            phase: 'list',
            error: null,
          },
          {
            role: 'assistant',
            text: hadList
              ? 'Updated the list from your current table and ranking. This student stays in the school folder so you can come back and edit it.'
              : 'Here is the list. Admissions and affordability are separate labels. Remove a school if it does not belong — the balance check will update.',
            card: 'list',
          }
        )
      })
      getRationales(built, snapshot.criteria)
        .then((aiSentences) => {
          try {
            assertList(built.map((s) => ({ ...s, rationale: aiSentences[s.id] })))
          } catch (err) {
            console.warn('[app] skipping AI sentences', err)
            return
          }
          patch(id, (c) => (c.phase === 'list' ? { ...c, rationales: aiSentences } : c))
        })
        .catch((err) => {
          console.warn('[app] rationale skipped', err)
        })
    } catch (err) {
      console.error('[app] list generation failed', err)
      patch(id, (c) => {
        const withoutStatus = { ...c, messages: c.messages.filter((m) => m.card !== 'status'), phase: 'priorities', error: err.message }
        return addMessage(withoutStatus, {
          role: 'assistant',
          text: err.message,
          tone: 'flag',
        })
      })
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
    if (active.phase === 'extracting' || active.phase === 'generating') return

    if (active.phase === 'idle') {
      await runExtraction(id, trimmed)
      return
    }

    if (active.phase === 'criteria') {
      if (CONTINUE_PHRASE.test(trimmed)) {
        if (canRebuild) await generateList(id, trimmed)
        else openPriorities(id, trimmed)
      } else {
        patch(id, (c) =>
          addMessage(addMessage(c, { role: 'user', text: trimmed }), {
            role: 'assistant',
            text: 'Edit the table above, then type continue. I will not pick schools until you confirm.',
          })
        )
      }
      return
    }

    if (active.phase === 'priorities') {
      if (BUILD_PHRASE.test(trimmed)) await generateList(id, trimmed)
      else {
        patch(id, (c) =>
          addMessage(addMessage(c, { role: 'user', text: trimmed }), {
            role: 'assistant',
            text: 'Reorder the priorities above, then type build. That ranking is what the scoring engine uses.',
          })
        )
      }
      return
    }

    if (active.phase === 'list') {
      if (BUILD_PHRASE.test(trimmed) || CONTINUE_PHRASE.test(trimmed)) {
        await generateList(id, trimmed)
        return
      }
      const reply =
        trimmed.length > 180
          ? 'That reads like another student. Press + on a school folder, then paste it there.'
          : 'This list stays with the student. Edit the table or ranking above and rebuild, or open another student from the school folders.'
      patch(id, (c) => addMessage(addMessage(c, { role: 'user', text: trimmed }), { role: 'assistant', text: reply }))
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

  if (printView) {
    if (active.list.length === 0) {
      return (
        <div className="mx-auto max-w-notes px-6 py-12">
          <p className="font-sans text-15 text-ink-2">This student does not have a list yet. Open them from the school folder and build one.</p>
          <button
            type="button"
            className="mt-4 rounded-control bg-brand px-5 py-3 font-sans text-15 font-medium text-surface hover:bg-brand-hover"
            onClick={goToChat}
          >
            Back to chat
          </button>
        </div>
      )
    }

    return (
      <FamilyDocument
        variant={printView === 'print-counselor' ? 'counselor' : 'student'}
        studentName={guessName(active.notes, active.extraction)}
        list={active.list}
        rationales={active.rationales}
        counselorNotes={active.counselorNotes}
        extraction={active.extraction}
        incomeBand={active.incomeBand}
        priorityOrder={active.priorityOrder}
        onBack={goToChat}
      />
    )
  }

  return (
    <ChatShell
      sidebarWidth={sidebarWidth}
      onSidebarWidth={setSidebarWidth}
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
      progressIndex={active.messages.find((m) => m.card === 'status')?.activeIndex}
      onSend={handleSend}
      renderCard={(message) => {
        if (message.card === 'status') {
          return <ProgressLog steps={message.steps} activeIndex={message.activeIndex} />
        }
        if (message.card === 'criteria') {
          return (
            <CriteriaStep
              extraction={active.extraction}
              criteria={active.criteria}
              setCriteria={fieldSetter(active.id, 'criteria')}
              incomeBand={active.incomeBand}
              setIncomeBand={fieldSetter(active.id, 'incomeBand')}
              maxOutOfPocket={active.maxOutOfPocket}
              setMaxOutOfPocket={fieldSetter(active.id, 'maxOutOfPocket')}
              homeState={active.homeState}
              setHomeState={fieldSetter(active.id, 'homeState')}
              locked={busy}
              continueLabel={canRebuild ? 'Rebuild the list' : 'Looks right — continue'}
              onContinue={() => (canRebuild ? generateList(active.id) : openPriorities(active.id))}
            />
          )
        }
        if (message.card === 'priorities') {
          return (
            <PrioritiesStep
              priorityOrder={active.priorityOrder}
              setPriorityOrder={fieldSetter(active.id, 'priorityOrder')}
              locked={busy}
              continueLabel={canRebuild ? 'Rebuild the list' : 'Build the list'}
              onContinue={() => generateList(active.id)}
            />
          )
        }
        if (message.card === 'list') {
          return (
            <ListStep
              list={active.list}
              setList={fieldSetter(active.id, 'list')}
              criteria={active.criteria}
              rationales={active.rationales}
              counselorNotes={active.counselorNotes}
              priorityOrder={active.priorityOrder}
              maxOutOfPocket={active.maxOutOfPocket}
              onNoteChange={(schoolId, value) =>
                patch(active.id, (c) => ({
                  ...c,
                  counselorNotes: { ...c.counselorNotes, [schoolId]: value },
                }))
              }
              onPrintStudent={() => requestPrint('student')}
              onPrintCounselor={() => requestPrint('counselor')}
            />
          )
        }
        return null
      }}
    />
  )
}
