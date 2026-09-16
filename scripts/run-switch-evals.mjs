// Follow-up switch evals: notes → extract → list, then a counselor chat line
// should revise the major and rebuild without dropping the rest of the file.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import llmHandler from '../api/llm.js'
import { buildList } from '../src/lib/engine.js'
import { extractCriteria, extractFallback } from '../src/lib/extract.js'
import { classifyFollowup } from '../src/lib/followup.js'
import { engineInputs, toTableRow } from '../src/lib/listRows.js'
import { PRIORITY_LABELS } from '../src/data/listBuilder.js'
import { templatesFor } from '../src/lib/rationale.js'
import { composeCatalog } from '../src/lib/synthesize.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const casesPath = resolve(root, 'evals/switch-cases.json')
const keywordOnly = process.argv.includes('--keyword')
loadEnv(resolve(root, '.env.local'))
installLlmFetch()
let skipAiExtract = keywordOnly || !process.env.GEMINI_API_KEY

const GENERATE_PROMPT = `You are an independent educational consultant. Invent 5 synthetic student files as messy counselor notes (invented first names only; no race, religion, disability, immigration status, or sexuality).
A list already exists for each student. Then the counselor types a short chat follow-up that switches what the student wants. Code — not you — will pick schools.
Return JSON only: { "cases": [ { "id", "title", "notes", "followup", "why_hard" } ] }
Use these ids and exact follow-up strings (counselors actually type these):
1. journalism-to-sports — notes must include journalism, an SAT, a GPA, and plays football. followup: "I think he wants to pursue sports."
2. switch-to-med-school — same shape of journalism student (SAT, GPA, football). followup: "he wants to switch to med school"
3. cs-to-nursing-keep-aid-oos — computer science, named US home state, SAT, GPA, far from home / out of state, needs financial aid. followup: "she wants to switch to nursing"
4. acting-to-polisci-keep-football — acting or theatre plus plays football, SAT, GPA. followup: "he wants to switch to political science"
5. law-hedge-then-lock — law but not sure, SAT, GPA, close to home. followup: "actually law"
Do not name colleges. Keep SAT and GPA as numbers.`

const JUDGE_PREAMBLE = `You are an IEC reviewing whether a list-builder follow-up actually revises the file.
You did not pick the schools. Catalog rows are synthetic stand-ins — do not score whether names match College Scorecard.
Score 1–5 integers:
- switch_heard: the new want changed the academic focus
- file_kept: SAT/GPA/geo/aid/football that were on the first file are still there
- list_moved: the rebuilt programme column matches the new want, not the old one
- message_honest: the assistant said it would update and keep facts, not start over or ignore the chat
overall is "pass" only if you would trust this as a revision of the same student, not a no-op or a reset.
Return JSON only: { "cases": [ { "id", "scores": { "switch_heard", "file_kept", "list_moved", "message_honest" }, "overall": "pass"|"fail", "what_worked", "what_broke" } ], "headline", "prototype_risk" }`

function loadEnv(file) {
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch (err) {
    console.warn('[switch-evals] no .env.local', err.message)
    return
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

function callLlm(body) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code
        return this
      },
      json(payload) {
        if (this.statusCode >= 400) {
          const err = new Error(payload?.error || payload?.detail || 'llm failed')
          err.statusCode = this.statusCode
          err.payload = payload
          reject(err)
        } else resolve(payload)
      },
    }
    Promise.resolve(llmHandler({ method: 'POST', body }, res)).catch(reject)
  })
}

function installLlmFetch() {
  const orig = globalThis.fetch.bind(globalThis)
  globalThis.fetch = async (url, options = {}) => {
    if (!String(url).includes('/api/llm')) return orig(url, options)
    try {
      const data = await callLlm(JSON.parse(options.body || '{}'))
      return { ok: true, status: 200, json: async () => data }
    } catch (err) {
      return { ok: false, status: err.statusCode || 502, json: async () => err.payload || { error: err.message } }
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retrySeconds(err) {
  const m = String(err.message || '').match(/retry in ([\d.]+)s/i)
  if (m) return Math.ceil(Number(m[1]) + 1)
  if (/RESOURCE_EXHAUSTED|quota|UNAVAILABLE|high demand/i.test(err.message || '')) return 12
  return 0
}

async function geminiJson(prompt, temperature, waitMs) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY missing')
  const models = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-2.5-flash-lite', process.env.GEMINI_MODEL || 'gemini-3.6-flash'].filter(
    (m, i, all) => all.indexOf(m) === i
  )
  let lastErr
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), waitMs + 2000)
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature },
          }),
        })
        const data = await r.json()
        if (data.error) throw new Error(`${model}: ${data.error.message}`)
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) throw new Error(`${model}: empty Gemini response`)
        process.stderr.write(`[switch-evals] Gemini ${model}\n`)
        return JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim())
      } catch (err) {
        lastErr = err
        console.warn(`[switch-evals] ${model} failed`, err.message.split('\n')[0])
        const wait = retrySeconds(err)
        if (/not found|NOT_FOUND|no longer available/i.test(err.message || '')) break
        if (wait && attempt < 2 && models.length === 1) {
          await sleep(wait * 1000)
          continue
        }
        break
      } finally {
        clearTimeout(timer)
      }
    }
  }
  throw lastErr
}

function loadFallbackCases() {
  return JSON.parse(readFileSync(casesPath, 'utf8'))
}

async function loadCases() {
  const fallback = loadFallbackCases()
  const byId = Object.fromEntries(fallback.cases.map((c) => [c.id, c]))
  if (keywordOnly || !process.env.GEMINI_API_KEY) {
    return { cases: fallback.cases, source: 'fallback' }
  }
  try {
    const data = await geminiJson(GENERATE_PROMPT, 0.6, 20000)
    const merged = fallback.cases.map((base) => {
      const hit = (data.cases ?? []).find((c) => c.id === base.id)
      if (!hit?.notes) return base
      return {
        ...base,
        title: hit.title || base.title,
        notes: hit.notes,
        followup: base.followup,
        why_hard: hit.why_hard || base.why_hard,
      }
    })
    const used = merged.filter((c) => byId[c.id])
    if (used.length === 5) return { cases: used, source: 'gemini-notes' }
    console.warn('[switch-evals] Gemini cases incomplete; using fallback notes')
    return { cases: fallback.cases, source: 'fallback' }
  } catch (err) {
    console.warn('[switch-evals] case generation failed, using fallback notes', err.message.split('\n')[0])
    return { cases: fallback.cases, source: 'fallback' }
  }
}

async function extractLikeApp(notes) {
  if (skipAiExtract) return extractFallback(notes)
  try {
    const data = await extractCriteria(notes)
    if (data.degraded) {
      skipAiExtract = true
      console.warn('[switch-evals] AI extract unavailable; remaining cases use keywords')
    }
    return data
  } catch (err) {
    skipAiExtract = true
    console.warn('[switch-evals] extract fell back', err.message)
    return extractFallback(notes)
  }
}

function settingsFor(extraction) {
  const aid = Boolean(extraction.affordability_signal?.aid_needed)
  return {
    order: [...PRIORITY_LABELS],
    homeState: extraction.home_state || '',
    incomeBand: aid ? '$30,001 – $48,000' : '$75,001 – $110,000',
    maxOop: aid ? '$15,000' : '$25,000',
  }
}

function buildLikeApp(notes, extraction, criteria) {
  const snapshot = {
    notes,
    criteria: criteria ?? extraction.criteria ?? [],
    extraction,
    homeState: extraction.home_state ?? null,
    incomeBand: extraction.affordability_signal?.aid_needed ? '30001-48000' : '75001-110000',
    maxOutOfPocket: extraction.affordability_signal?.aid_needed ? 15000 : 25000,
  }
  const settings = settingsFor(extraction)
  const inputs = engineInputs(snapshot, settings)
  const catalog = composeCatalog({
    notes,
    criteria: inputs.criteria,
    academic: inputs.academic,
    homeState: inputs.home_state,
    incomeBand: inputs.income_band,
    cap: inputs.max_out_of_pocket,
    listSize: inputs.listSize,
  })
  const built = buildList({ schools: catalog.schools, ...inputs })
  const rationales = templatesFor(built, snapshot.criteria)
  const rows = built.map((s) => toTableRow({ ...s, rationale: rationales[s.id] ?? '' }, rationales[s.id] ?? '', inputs.max_out_of_pocket, inputs.home_state, snapshot.criteria))
  return { snapshot, inputs, catalogSource: catalog.source, schools: rows }
}

function compactCriteria(criteria) {
  return (criteria ?? []).map((c) => ({
    category: c.category,
    label: c.label,
    value: c.value,
    strength: c.strength,
  }))
}

function interestBlob(criteria) {
  return (criteria ?? [])
    .filter((c) => c.category === 'academic_interest')
    .map((c) => `${c.label} ${c.value} ${c.strength}`)
    .join(' | ')
}

function hasKeep(criteria, key) {
  if (key === 'sat') return (criteria ?? []).some((c) => String(c.label).startsWith('SAT'))
  if (key === 'gpa') return (criteria ?? []).some((c) => String(c.label).startsWith('GPA'))
  if (key === 'geo') return (criteria ?? []).some((c) => c.category === 'geography')
  if (key === 'aid') return (criteria ?? []).some((c) => c.value === 'aid_needed' || c.category === 'family_constraint')
  if (key === 'football') return (criteria ?? []).some((c) => c.value === 'football' || /football/i.test(c.label))
  if (key === 'far') {
    return (criteria ?? []).some((c) => {
      if (c.category !== 'geography') return false
      if (c.value && typeof c.value === 'object' && c.value.prefer_far) return true
      return /out of state|far from home/i.test(`${c.label} ${c.understood || ''}`)
    })
  }
  return false
}

function programBlob(schools) {
  return (schools ?? []).map((s) => `${s.programLine || ''} ${(s.programs || []).join(' ')}`).join(' | ')
}

function messageHonest(message, expect, actionType) {
  const m = String(message || '')
  const issues = []
  if (actionType !== 'revise_criteria') {
    issues.push(m ? `treated as ${actionType} instead of a revision` : 'no revision message — the switch was ignored')
    return { ok: false, issues }
  }
  if (!m.trim()) issues.push('empty assistant message')
  if (/start over|new student|new conversation|from scratch/i.test(m)) issues.push('claimed to start over')
  if (!/keeping/i.test(m)) issues.push('did not say prior facts were kept')
  if (expect.message_re && !new RegExp(expect.message_re, 'i').test(m)) {
    issues.push(`message did not mention ${expect.message_re}`)
  }
  return { ok: issues.length === 0, issues }
}

function evaluate(edge, extraction, before, action, after) {
  const expect = edge.expect
  const beforeInterest = interestBlob(before.snapshot.criteria)
  const afterCriteria = action.type === 'revise_criteria' ? action.criteria : before.snapshot.criteria
  const afterInterest = interestBlob(afterCriteria)
  const newRe = new RegExp(expect.new_interest, 'i')
  const dropRe = expect.drop_interest ? new RegExp(expect.drop_interest, 'i') : null
  const majorHeard = newRe.test(afterInterest)
  const hadOld = dropRe ? dropRe.test(beforeInterest) : true
  const oldGone = dropRe ? !dropRe.test(afterInterest) : true
  const lawLocked = expect.law_strength
    ? (afterCriteria ?? []).some((c) => /law/i.test(`${c.label} ${c.value}`) && c.strength === expect.law_strength)
    : true
  const majorChanged = action.type === 'revise_criteria' && majorHeard && hadOld && oldGone && lawLocked
  const kept = {}
  const keptIssues = []
  for (const key of expect.keep ?? []) {
    kept[key] = hasKeep(afterCriteria, key)
    if (!kept[key]) keptIssues.push(`dropped ${key}`)
  }
  const afterPrograms = programBlob(after?.schools || [])
  const beforePrograms = programBlob(before.schools)
  const listShowsNew = Boolean(after) && newRe.test(afterPrograms)
  const listDroppedOld = dropRe ? Boolean(after) && !dropRe.test((after.schools ?? []).map((s) => s.programLine || '').join(' | ')) : true
  const programTextMoved = afterPrograms !== beforePrograms
  const listChanged =
    action.type === 'revise_criteria' &&
    Boolean(after?.schools?.length) &&
    listShowsNew &&
    listDroppedOld &&
    (dropRe ? programTextMoved : true)
  const honesty = messageHonest(action.message, expect, action.type)
  const actionOk = action.type === expect.action
  const pass = actionOk && majorChanged && keptIssues.length === 0 && listChanged && honesty.ok
  return {
    pass,
    action_ok: actionOk,
    major_changed: majorChanged,
    kept_ok: keptIssues.length === 0,
    list_changed: listChanged,
    message_honest: honesty.ok,
    issues: [
      actionOk ? null : `expected ${expect.action}, got ${action.type}`,
      majorHeard ? null : `new focus ${expect.new_interest} not on criteria`,
      hadOld ? null : `starting focus ${expect.drop_interest} was missing before the follow-up`,
      oldGone ? null : `old focus ${expect.drop_interest} still on criteria`,
      lawLocked ? null : `law was not locked to ${expect.law_strength}`,
      ...keptIssues,
      listChanged ? null : 'rebuilt list did not show the new want',
      ...honesty.issues,
    ].filter(Boolean),
    before_interest: beforeInterest,
    after_interest: afterInterest,
    kept,
    action_type: action.type,
    message: action.message || null,
    before_programs: [...new Set((before.schools ?? []).map((s) => s.programLine).filter(Boolean))],
    after_programs: [...new Set((after?.schools ?? []).map((s) => s.programLine).filter(Boolean))],
  }
}

function writeReport(report) {
  const outDir = resolve(root, 'evals')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'switch-latest.json'), JSON.stringify(report, null, 2))
  writeFileSync(resolve(outDir, 'switch-latest.md'), markdown(report))
}

function markdown(report) {
  const lines = [
    `# Follow-up switch evals`,
    ``,
    report.headline || '',
    ``,
    `Ran ${report.ran_at}. Cases from ${report.case_source}. Extract via ${report.extract_mode}. ${report.pass} pass / ${report.fail} fail.`,
    ``,
    report.prototype_risk ? `Prototype risk: ${report.prototype_risk}` : '',
    report.judge_error ? `Gemini judge: ${report.judge_error}` : '',
    ``,
    `When a switch was heard, SAT, GPA, football, aid-needed, and out-of-state stayed on the file. The spoken line names SAT, GPA, geography, and football, but not aid — aid still stayed on the sheet.`,
    ``,
  ]
  for (const c of report.cases) {
    const v = c.verdict
    lines.push(`## ${c.title} (${c.id}) — ${v.pass ? 'PASS' : 'FAIL'}`)
    lines.push('')
    lines.push(c.notes)
    lines.push('')
    lines.push(`Follow-up: “${c.followup}”`)
    lines.push('')
    lines.push(`Heard as: ${v.action_type}. Major changed: ${v.major_changed}. Old facts kept: ${v.kept_ok}. List moved: ${v.list_changed}. Message honest: ${v.message_honest}.`)
    lines.push(`Before focus: ${v.before_interest || '(none)'}`)
    lines.push(`After focus: ${v.after_interest || '(none)'}`)
    lines.push(`Kept: ${JSON.stringify(v.kept)}`)
    if (v.message) lines.push(`Assistant: ${v.message}`)
    if (v.issues.length) lines.push(`Issues: ${v.issues.join('; ')}`)
    if (c.judgment) {
      lines.push(`Judge: ${c.judgment.overall}. ${c.judgment.what_worked || ''} ${c.judgment.what_broke || ''}`.trim())
    }
    lines.push('')
  }
  return lines.filter((l) => l !== undefined).join('\n')
}

async function main() {
  const generated = await loadCases()
  writeFileSync(casesPath, JSON.stringify({ source: generated.source, cases: generated.cases }, null, 2))
  const runs = []
  for (const edge of generated.cases) {
    process.stderr.write(`[switch-evals] ${edge.id}\n`)
    const extraction = await extractLikeApp(edge.notes)
    const before = buildLikeApp(edge.notes, extraction)
    const dummySchools = before.schools.map((s) => ({ id: s.id, name: s.name, band: s.band }))
    const action = classifyFollowup(edge.followup, { schools: dummySchools, criteria: before.snapshot.criteria })
    let after = null
    if (action.type === 'revise_criteria') {
      const notes = `${edge.notes}\n\n${edge.followup}`.trim()
      after = buildLikeApp(notes, { ...extraction, criteria: action.criteria }, action.criteria)
    }
    const verdict = evaluate(edge, extraction, before, action, after)
    runs.push({
      id: edge.id,
      title: edge.title,
      why_hard: edge.why_hard,
      notes: edge.notes,
      followup: edge.followup,
      extract_degraded: Boolean(extraction.degraded),
      before_list_size: before.schools.length,
      after_list_size: after?.schools.length ?? null,
      catalog_source: after?.catalogSource || before.catalogSource,
      before_criteria: compactCriteria(before.snapshot.criteria),
      after_criteria: compactCriteria(action.criteria || before.snapshot.criteria),
      verdict,
    })
  }
  const extractMode = skipAiExtract ? 'extractFallback' : 'extractCriteria'
  let judgment = { cases: [], headline: '', prototype_risk: '', error: '' }
  if (process.env.GEMINI_API_KEY && !keywordOnly) {
    try {
      const payload = runs.map((r) => ({
        id: r.id,
        title: r.title,
        notes: r.notes,
        followup: r.followup,
        action_type: r.verdict.action_type,
        message: r.verdict.message,
        before_interest: r.verdict.before_interest,
        after_interest: r.verdict.after_interest,
        kept: r.verdict.kept,
        before_programs: r.verdict.before_programs,
        after_programs: r.verdict.after_programs,
        issues: r.verdict.issues,
        mechanical_pass: r.verdict.pass,
      }))
      judgment = await geminiJson(`${JUDGE_PREAMBLE}\n\nCases:\n${JSON.stringify(payload)}`, 0.2, 40000)
    } catch (err) {
      console.warn('[switch-evals] judge failed', err.message.split('\n')[0])
      judgment = { cases: [], headline: '', prototype_risk: '', error: err.message.split('\n')[0] }
    }
  }

  const byId = Object.fromEntries((judgment.cases ?? []).map((c) => [c.id, c]))
  const scored = runs.map((r) => ({ ...r, judgment: byId[r.id] || null }))
  const passed = scored.filter((r) => r.verdict.pass).length
  const failed = scored.filter((r) => !r.verdict.pass)
  const failIds = failed.map((c) => c.id).join(', ')
  const mechanicalHeadline = `${passed} of ${scored.length} counselor follow-ups revised the list and kept the rest of the file.${failIds ? ` Failed: ${failIds}.` : ''}`
  const judged = (judgment.cases ?? []).length > 0
  const lawFail = scored.find((c) => c.id === 'law-hedge-then-lock' && !c.verdict.pass)
  const report = {
    ran_at: new Date().toISOString(),
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    case_source: generated.source,
    extract_mode: extractMode,
    headline: judged ? judgment.headline || mechanicalHeadline : mechanicalHeadline,
    prototype_risk:
      judgment.prototype_risk ||
      (lawFail
        ? '“actually law” is treated as a question, so a hedged law file never locks in and the list does not rebuild.'
        : ''),
    judge_error: judgment.error || '',
    pass: passed,
    fail: scored.length - passed,
    cases: scored,
  }
  writeReport(report)
  console.log(
    JSON.stringify(
      {
        pass: report.pass,
        fail: report.fail,
        headline: report.headline,
        file: 'evals/switch-latest.json',
        cases: scored.map((c) => ({ id: c.id, pass: c.verdict.pass, action: c.verdict.action_type, issues: c.verdict.issues })),
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
