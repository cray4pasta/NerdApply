// Gemini-as-counselor evals: invent 10 edge-case notes, run the same extract →
// catalog → engine path as the app, then ask Gemini to judge the lists.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import llmHandler from '../api/llm.js'
import { DIMENSIONS, buildList } from '../src/lib/engine.js'
import { extractFallback, normalizeAiExtraction } from '../src/lib/extract.js'
import { assertList } from '../src/lib/guardrails.js'
import { checkBalance, summarize } from '../src/lib/balance.js'
import { engineInputs } from '../src/lib/listRows.js'
import { PRIORITY_LABELS } from '../src/data/listBuilder.js'
import { templatesFor } from '../src/lib/rationale.js'
import { composeCatalog, loadSyntheticCatalog } from '../src/lib/synthesize.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnv(resolve(root, '.env.local'))
installLlmFetch()

const FALLBACK_CASES = [
  { id: 'conflicting-geography', title: 'Parents want driving distance; student wants California', notes: `Junior in suburban Columbus, Ohio. 1420 SAT, 3.9 UW, CS with a couple of hackathon wins. Parents want driving distance. She has decided she wants California and will not look at Ohio State. Family can put about $20k a year toward college.` },
  { id: 'high-stats-needs-aid', title: 'High stats, Pell-eligible, brand-name pressure', notes: `Georgia, first-gen, Pell-eligible, 4.0 UW, 1560 SAT, wants nursing and is eyeing Ivies. Family cannot take loans. Needs financial aid. Quiet kid, strong in chem.` },
  { id: 'no-test-scores', title: 'No SAT/ACT, fuzzy major', notes: `Oregon student, 3.6 GPA, strong writer, no SAT or ACT on file. Interested in journalism or maybe political science. Family said test-optional is fine. Not sure how far they want to go.` },
  { id: 'architecture-gap', title: 'Major the catalog does not name', notes: `New Mexico, 1280 SAT, 3.4 GPA, wants architecture. Budget is tight — needs aid. Would like a warm climate. Parents nervous this tool will just dump general engineering on us.` },
  { id: 'undeclared-hedge', title: 'Engineering vs business, changes weekly', notes: `Chicago suburbs. 1180 SAT, 3.2 GPA. Maybe engineering, maybe business — changes his mind weekly. Wants a big school with sports and a real social scene. In-state is cheaper but he does not want to stay in Illinois.` },
  { id: 'sparse-notes', title: 'Three-line file', notes: `Marine biology. Florida. Needs aid.` },
  { id: 'overconstrained', title: 'Wyoming, nursing, cheap, 15 schools', notes: `Must stay in Wyoming. Nursing BSN. Small campus. 980 SAT, 2.9 GPA. Family income under $40k, needs strong financial support. Please build a list of 15 colleges.` },
  { id: 'homeschool-far', title: 'Homeschool, no GPA, far from Idaho', notes: `Homeschool, no official GPA, 1490 SAT. Wants a small liberal arts college far from home — Idaho. Thinking classics or history. Parents can do about $18k a year, not more.` },
  { id: 'risk-averse-high', title: 'High stats, anxious about reaches', notes: `Northern Virginia. 3.95 UW, 1510 SAT, computer science. Anxious about reaches — family wants mostly likelies. Medium-size campus. They can pay sticker if they have to.` },
  { id: 'brand-pressure-weak', title: 'Parents named Duke/Stanford/NYU; scores do not match', notes: `New Jersey. Parents only want Duke, Stanford, NYU. Student is 1090 SAT, 3.3 GPA, business. Needs merit. Quiet, prefers small classes. I am not putting those three on a list unless the numbers support it.` },
]

const GENERATE_PROMPT = `You are an independent educational consultant (IEC) who advises 20 students a year.
Invent 10 synthetic student files as messy counselor notes — the kind you would paste into a list-builder.
These are not real students. Use invented first names only. Do not include race, religion, disability, immigration status, or sexuality.
Each case must stress a different edge of a college-list tool that: extracts criteria from notes, lets a counselor confirm, then uses code (not you) to pick 8–10 schools with separate Likely/Target/Reach and Likely Affordable/Needs Review labels. It only knows these majors: art, performing_arts, design, marine_biology, computer_science, engineering, nursing, biology, business, education, environmental_science, agriculture, law. It never prints a percent chance of admission and never uses the word safety.

Cover these ten pressures, one each: conflicting geography; high stats plus real aid need; missing test scores; a major the tool may not have; undeclared/hedging interests; extremely sparse notes; overconstrained (place + cost + program + weak scores); homeschool / missing GPA; high stats but risk-averse; parental brand-name pressure with mismatched scores.
Return JSON only: { "cases": [ { "id": "kebab-id", "title": "short edge-case name", "notes": "one counselor paragraph", "why_hard": "one sentence" } ] }`

const JUDGE_PREAMBLE = `You are an independent educational consultant reviewing a prototype college-list builder.
You did not pick these schools. Code did. Judge whether you would use each list as a first draft before a family meeting.
Be specific and a little harsh. Never invent a better list of schools. Score only what you were given.
For each case, score 1–5 integers:
- extraction_fidelity: caught what a counselor would, without inventing facts
- list_fit: these schools make sense for THIS student
- balance: Likely/Target/Reach mix is honest for the profile
- affordability_honesty: cost is treated as a separate verdict; aid cases are not waved through
- counselor_usefulness: worth editing, vs starting over
overall is "pass" only if you would actually start from this list. "fail" otherwise.
Return JSON only: { "cases": [ { "id": string, "scores": { "extraction_fidelity": n, "list_fit": n, "balance": n, "affordability_honesty": n, "counselor_usefulness": n }, "overall": "pass"|"fail", "what_worked": string, "what_broke": string, "issues": string[] } ], "headline": string, "prototype_risk": string }`

function loadEnv(file) {
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch (err) {
    console.warn('[evals] no .env.local', err.message)
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
  const models = [
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-2.5-flash-lite',
    process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  ].filter((m, i, all) => all.indexOf(m) === i)
  let lastErr
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), waitMs + 2000)
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ctrl.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json', temperature },
            }),
          }
        )
        const data = await r.json()
        if (data.error) throw new Error(`${model}: ${data.error.message}`)
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) throw new Error(`${model}: empty Gemini response`)
        process.stderr.write(`[evals] Gemini ${model}\n`)
        return JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim())
      } catch (err) {
        lastErr = err
        console.warn(`[evals] ${model} failed`, err.message.split('\n')[0])
        const wait = retrySeconds(err)
        if (/not found|NOT_FOUND|no longer available/i.test(err.message || '')) break
        if (wait && attempt < 2 && models.length === 1) {
          console.warn(`[evals] ${model} retry in ${wait}s`)
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

async function extractLikeApp(notes) {
  const fallback = extractFallback(notes)
  try {
    const data = await callLlm({ mode: 'extract', notes })
    if (!data || !Array.isArray(data.criteria)) return fallback
    return { ...normalizeAiExtraction(data, notes), degraded: false }
  } catch (err) {
    console.warn('[evals] extract fell back', err.message)
    return fallback
  }
}

async function buildLikeApp(notes, extraction) {
  const aid = extraction.affordability_signal?.aid_needed
  const snapshot = {
    notes,
    criteria: extraction.criteria ?? [],
    extraction,
    homeState: extraction.home_state ?? null,
    incomeBand: aid ? '30001-48000' : '75001-110000',
    maxOutOfPocket: aid ? 15000 : 25000,
  }
  const settings = {
    order: [...PRIORITY_LABELS],
    homeState: extraction.home_state || '',
    incomeBand: aid ? '$30,001 – $48,000' : '$75,001 – $110,000',
    maxOop: aid ? '$15,000' : '$25,000',
  }
  const inputs = engineInputs(snapshot, settings)
  const useLlmCatalog = process.env.EVAL_LLM_CATALOG === '1'
  const catalog = useLlmCatalog
    ? await loadSyntheticCatalog({
        notes,
        criteria: inputs.criteria,
        academic: inputs.academic,
        homeState: inputs.home_state,
        incomeBand: inputs.income_band,
        cap: inputs.max_out_of_pocket,
        listSize: inputs.listSize,
      })
    : composeCatalog({
        notes,
        criteria: inputs.criteria,
        academic: inputs.academic,
        homeState: inputs.home_state,
        incomeBand: inputs.income_band,
        cap: inputs.max_out_of_pocket,
        listSize: inputs.listSize,
      })
  let built = buildList({ schools: catalog.schools, ...inputs })
  if (!built.length || (inputs.listSize && built.length < inputs.listSize)) {
    const filled = buildList({
      schools: catalog.schools,
      ...inputs,
      criteria: inputs.criteria.map((c) => (c.category === 'geography' ? { ...c, strength: 'flexible' } : c)),
    })
    if (filled.length > built.length) built = filled
  }
  let rationales = templatesFor(built, snapshot.criteria)
  if (process.env.EVAL_LLM_RATIONALE === '1') {
    try {
      const sentences = await callLlm({
        mode: 'rationale',
        criteria: snapshot.criteria,
        schools: built.map((s) => ({
          id: s.id,
          name: s.name,
          admissions: s.admissions,
          affordability: s.affordability,
          travel: s.travel,
          programs: s.programs,
          clubs: s.clubs ?? null,
        })),
      })
      rationales = Object.fromEntries(built.map((s) => [s.id, sentences[s.id] ?? rationales[s.id]]))
    } catch (err) {
      console.warn('[evals] rationale templates', err.message)
    }
  }
  const labelled = built.map((s) => ({ ...s, rationale: rationales[s.id] ?? '' }))
  const guardrailErrors = []
  try {
    assertList(labelled)
  } catch (err) {
    guardrailErrors.push(err.message)
  }
  return { snapshot, inputs, catalogSource: catalog.source, schools: labelled, warnings: checkBalance(labelled), mix: summarize(labelled), guardrailErrors }
}

function inventedRows(notes, criteria) {
  const lower = notes.toLowerCase()
  return (criteria ?? []).filter((c) => {
    const phrase = String(c.source_phrase || '').trim()
    return !phrase || !lower.includes(phrase.toLowerCase())
  }).length
}

function compactSchool(s) {
  return {
    name: s.name,
    city: s.city,
    state: s.state,
    ownership: s.ownership,
    size: s.size,
    admit_rate: s.admit_rate,
    sat_p25: s.sat_p25,
    sat_p75: s.sat_p75,
    admissions: s.admissions?.band,
    evidence: s.admissions?.evidence,
    affordability: s.affordability?.band,
    net_price: s.affordability?.netPrice ?? null,
    rationale: s.rationale,
  }
}

async function generateCases() {
  try {
    const data = await geminiJson(GENERATE_PROMPT, 0.8, 20000)
    const cases = (data.cases ?? []).filter((c) => c?.notes && c?.id).slice(0, 10)
    if (cases.length === 10) return { cases, source: 'gemini' }
    console.warn('[evals] Gemini returned', cases.length, 'cases; filling from fallback')
    return { cases: [...cases, ...FALLBACK_CASES].slice(0, 10), source: 'mixed' }
  } catch (err) {
    console.warn('[evals] case generation failed, using fallback notes', err.message)
    return { cases: FALLBACK_CASES, source: 'fallback' }
  }
}

async function judgeRuns(runs) {
  const judgePayload = runs.map((r) => ({
    id: r.id,
    title: r.title,
    why_hard: r.why_hard,
    notes: r.notes,
    extraction: r.extraction,
    mix: r.mix,
    warnings: r.warnings,
    guardrail_errors: r.guardrail_errors,
    schools: r.schools,
  }))
  return geminiJson(`${JUDGE_PREAMBLE}\n\nCases:\n${JSON.stringify(judgePayload)}`, 0.2, 60000)
}

function writeReport(report) {
  const outDir = resolve(root, 'evals')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'latest.json'), JSON.stringify(report, null, 2))
  writeFileSync(resolve(outDir, 'latest.md'), markdown(report))
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('Set GEMINI_API_KEY in .env.local')
    process.exit(1)
  }
  const judgeOnly = process.argv.includes('--judge')
  if (judgeOnly) {
    const existing = JSON.parse(readFileSync(resolve(root, 'evals/latest.json'), 'utf8'))
    const judgment = await judgeRuns(existing.cases)
    const byId = Object.fromEntries((judgment.cases ?? []).map((c) => [c.id, c]))
    const scored = existing.cases.map((r) => ({ ...r, judgment: byId[r.id] || r.judgment || null }))
    const passed = scored.filter((r) => r.judgment?.overall === 'pass').length
    const failed = scored.filter((r) => r.judgment?.overall === 'fail').length
    const report = {
      ...existing,
      ran_at: new Date().toISOString(),
      headline: judgment.headline,
      prototype_risk: judgment.prototype_risk,
      pass: passed,
      fail: failed,
      unjudged: scored.length - passed - failed,
      cases: scored,
    }
    writeReport(report)
    console.log(JSON.stringify({ pass: report.pass, fail: report.fail, unjudged: report.unjudged, headline: report.headline, file: 'evals/latest.json' }, null, 2))
    return
  }
  const generated = await generateCases()
  const runs = []
  for (const edge of generated.cases) {
    process.stderr.write(`[evals] ${edge.id}\n`)
    const extraction = await extractLikeApp(edge.notes)
    const built = await buildLikeApp(edge.notes, extraction)
    runs.push({
      id: edge.id,
      title: edge.title,
      why_hard: edge.why_hard || null,
      notes: edge.notes,
      extraction: {
        degraded: Boolean(extraction.degraded),
        student_name: extraction.student_name,
        home_state: extraction.home_state,
        academic: extraction.academic,
        aid_needed: Boolean(extraction.affordability_signal?.aid_needed),
        criteria: (extraction.criteria ?? []).map((c) => ({
          category: c.category,
          label: c.label,
          value: c.value,
          strength: c.strength,
          confidence: c.confidence,
          source_phrase: c.source_phrase,
          understood: c.understood,
        })),
        unresolved: extraction.unresolved ?? [],
        invented_rows: inventedRows(edge.notes, extraction.criteria),
      },
      catalog_source: built.catalogSource,
      list_size: built.schools.length,
      mix: built.mix,
      warnings: built.warnings,
      guardrail_errors: built.guardrailErrors,
      default_priorities: DIMENSIONS,
      overlay_pool_size: composeCatalog({
        notes: edge.notes,
        criteria: built.inputs.criteria,
        academic: built.inputs.academic,
        homeState: built.inputs.home_state,
        incomeBand: built.inputs.income_band,
        cap: built.inputs.max_out_of_pocket,
        listSize: built.inputs.listSize,
      }).schools.length,
      schools: built.schools.map(compactSchool),
    })
  }

  mkdirSync(resolve(root, 'evals'), { recursive: true })
  writeFileSync(resolve(root, 'evals/cases.json'), JSON.stringify(generated, null, 2))
  let judgment = { cases: [], headline: 'Judge call failed', prototype_risk: 'Could not reach Gemini for scoring.' }
  try {
    judgment = await judgeRuns(runs)
  } catch (err) {
    console.warn('[evals] judge failed', err.message)
  }

  const byId = Object.fromEntries((judgment.cases ?? []).map((c) => [c.id, c]))
  const scored = runs.map((r) => ({ ...r, judgment: byId[r.id] || null }))
  const passed = scored.filter((r) => r.judgment?.overall === 'pass').length
  const failed = scored.filter((r) => r.judgment?.overall === 'fail').length
  const report = {
    ran_at: new Date().toISOString(),
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    case_source: generated.source,
    headline: judgment.headline,
    prototype_risk: judgment.prototype_risk,
    pass: passed,
    fail: failed,
    unjudged: scored.length - passed - failed,
    cases: scored,
  }
  writeReport(report)
  console.log(JSON.stringify({ pass: report.pass, fail: report.fail, unjudged: report.unjudged, headline: report.headline, file: 'evals/latest.json' }, null, 2))
}

function markdown(report) {
  const lines = [
    `# Gemini counselor evals`,
    ``,
    `${report.headline || ''}`,
    ``,
    `Ran ${report.ran_at} on ${report.model}. Cases from ${report.case_source}. ${report.pass} pass / ${report.fail} fail.`,
    ``,
    report.prototype_risk ? `Prototype risk: ${report.prototype_risk}` : '',
    ``,
  ]
  for (const c of report.cases) {
    const j = c.judgment
    lines.push(`## ${c.title} (${c.id})`)
    lines.push('')
    lines.push(c.notes)
    lines.push('')
    lines.push(`List: ${c.list_size} schools. Mix L/T/R ${c.mix.likely}/${c.mix.target}/${c.mix.reach}. Affordable: ${c.mix.affordable}. Catalog: ${c.catalog_source}. Invented criteria rows: ${c.extraction.invented_rows}.`)
    if (j) {
      const s = j.scores || {}
      lines.push(`Judge: ${j.overall}. Fit ${s.list_fit}/5, extract ${s.extraction_fidelity}/5, balance ${s.balance}/5, affordability ${s.affordability_honesty}/5, usefulness ${s.counselor_usefulness}/5.`)
      lines.push(`Worked: ${j.what_worked}`)
      lines.push(`Broke: ${j.what_broke}`)
    }
    lines.push('')
  }
  return lines.filter((l) => l !== undefined).join('\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
