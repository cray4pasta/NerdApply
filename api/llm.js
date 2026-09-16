// Both AI calls, switched by `mode`. This file is the only place in the app that talks to
// Gemini. Extract and rationale never pick a school. Catalog mode may invent plausible
// school facts for this demo; engine.js still assigns every band. Without GEMINI_API_KEY
// it returns 503 and the client falls back (docs/02-ENGINEERING.md 6.4).
//
// Requires `vercel dev` locally — this file is not served by plain `vite dev`. See
// docs/02-ENGINEERING.md section 3.

const CATEGORIES = [
  'academic_interest',
  'geography',
  'environment',
  'size',
  'support_needs',
  'family_constraint',
  'risk_tolerance',
  'other',
]

function extractPrompt(notes) {
  return `You extract structured criteria from a counselor's free-form notes about a student.
Return JSON only, matching this exact shape, and nothing else:

{
  "student_name": string | null,
  "academic": { "gpa": number | null, "sat": number | null, "act": number | null, "rigor_notes": string | null },
  "home_state": string | null,
  "criteria": [ { "id": string, "category": one of ${JSON.stringify(CATEGORIES)}, "label": string,
    "value": string | object, "confidence": "high" | "medium" | "low", "source_phrase": string,
    "strength": "required" | "preferred" | "flexible", "understood": string } ],
  "affordability_signal": { "aid_needed": boolean, "confidence": "high" | "medium" | "low", "source_phrase": string | null },
  "unresolved": [string]
}

Rules:
- Never guess a value. If it isn't in the notes, omit it or mark confidence "low".
- "source_phrase" must be a literal substring of the notes below. This is what lets the counselor
  see where each row came from, and it makes fabrication visible.
- "understood" must be exactly one sentence. Paraphrase what source_phrase means for the college
  search — the implication, not a slug or a restatement of the label. Example: source_phrase
  "wants to pursue law but not sure" → understood "Exploring law without locking into a pre-law
  major — look for flexible programs and low-stakes ways to test legal work."
- Never name a college in "understood". Never use percentages, "best," "safety," or "guaranteed."
- Do not infer race, religion, disability, immigration status, or sexuality. If the notes mention
  a support need explicitly, record it under "support_needs" with the literal phrase, nothing more.
- Prefer these academic_interest slugs when they match: art, performing_arts, design, marine_biology,
  computer_science, engineering, nursing, biology, business, education, environmental_science,
  agriculture, law, political_science. "Interested in art", "art school", "fine arts", or "studio art" → slug "art",
  label "Art", strength "required". "Acting", "actor", "theatre", "theater", "drama", "film",
  "entertainment", or "performing arts" → slug "performing_arts", label "Acting / entertainment",
  not "art". "Graphic design", "industrial design", "visual design", or
  "interested in design" → slug "design", label "Design", not "art". Law / pre-law → slug "law", label "Law / pre-law",
  strength "required" unless the notes hedge ("not sure", "maybe"), then "preferred". Never
  substitute marine_biology. A JD is graduate school; this slug means an undergraduate
  law-related major or catalog law courses, not a law school.
  "Politics", "political science", "poli sci", "public policy", or "international relations" →
  slug "political_science", label "Political science", not "law".
  If the notes name a major that is not in that list, still extract it as academic_interest with a
  snake_case value and a short title-case label (journalism, architecture, kinesiology, and so on).
  Never omit a named major. Never force it into the closest listed slug.
- geography "value" must be an object: { "home_state": "PA", "max_miles": number | null, "prefer_far": boolean }.
  "Far from home", "out of state", "leave the state", or "away from home" (not "aren't too far from home")
  → prefer_far true, max_miles null, label "Out of state — far from home". Copy home_state into
  both the top-level field and geography.value.home_state as a two-letter postal code.
  Only set home_state from where the student or family lives. A climate wish (California, Florida,
  warm) is not home. If home is unknown, use null — never default to Pennsylvania.
  Do not add a geography criterion unless the notes ask to stay close, stay within driving
  distance, or go far from home. Naming a home state alone is not a closeness preference.
- "plays football" or football as a campus activity → category "other", value "football",
  label "Plays football", strength "preferred". Do not label football as basketball. Do not
  invent robotics, design, or other clubs that are not in the notes.
- affordability_signal.aid_needed is true if the notes say needs aid, financial aid, Pell, can't
  afford, $0, EFC, cannot take loans, no loans, meet full need, or demonstrated need. Do not wait
  for the words "financial aid."

Notes:
"""${notes}"""`
}

function rationalePrompt(criteria, schools) {
  return `Write one sentence per school for a family reading it at a kitchen table, under 25 words
each. Use only the facts given below — do not add a fact that isn't provided. Never use the words
"safety," "guaranteed," "best," or any percentage. Return JSON only: { "<school id>": "sentence" }.

Criteria: ${JSON.stringify(criteria)}
Schools: ${JSON.stringify(schools)}`
}

function followupPrompt(payload) {
  return `You answer a counselor's follow-up about an existing college list.
Use only the facts provided. Never pick a school, never assign Likely/Target/Reach, never invent a
number, never name a scholarship, never use the word "safety," and never print a percent chance of
admission. Published admit rates already on the sheet may be restated.
If asked about an aid letter or cost after aid, do not invent an award letter. Describe the estimated
net price, tuition line, income band, and cap already provided, and say this is an estimate at that
income band, not an award letter from the school.
If the facts do not support an answer, say so and point the counselor to editing criteria, priorities, or columns.
Return JSON only: { "answer": string } — two to four sentences.

Question: ${payload.question}
Income band: ${payload.incomeBand ?? 'not set'}
Yearly cap: ${payload.maxOop ?? 'not set'}
Priorities: ${JSON.stringify(payload.priorities ?? [])}
Criteria: ${JSON.stringify(payload.criteria ?? [])}
Schools on the list: ${JSON.stringify(payload.schools ?? [])}`
}

function catalogPrompt(payload) {
  const n = Math.max(16, Number(payload.list_size) || 14)
  return `Invent a plausible catalog of ${n} recognizable U.S. colleges that match these counselor notes.
Facts may be approximate. Every school MUST appear to offer the student's academic interests and
must mention any clubs or campus-life wishes from the notes (for example football, robotics, social life).
If the notes name football or another sport, every school's clubs string must mention that sport.
Do not invent robotics, design-build, makerspaces, or other clubs that are not in the notes.
Vary selectivity so some are easier admits and some are much harder. Do not assign Likely/Target/Reach
labels. Do not use the words safety, guaranteed, best, or any percent chance.
Return JSON only: { "schools": [ {
  "id": string, "name": string, "city": string, "state": two-letter code,
  "ownership": "public" | "private", "setting": "city" | "suburban" | "town" | "rural",
  "size": number, "admit_rate": number between 0.08 and 0.88,
  "sat_p25": number, "sat_p75": number,
  "net_price": { "${payload.income_band || '75001-110000'}": number },
  "tuition_in": number, "tuition_out": number,
  "clubs": string, "campus_life": string
} ] }

Home state: ${payload.home_state || 'unknown'}
Cap: ${payload.max_out_of_pocket ?? 25000}
Academic: ${JSON.stringify(payload.academic ?? {})}
Criteria: ${JSON.stringify(payload.criteria ?? [])}
Notes:
"""${payload.notes ?? ''}"""`
}

function stripFences(text) {
  return text.replace(/^```(json)?/i, '').replace(/```$/, '').trim()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const { mode, ...payload } = req.body ?? {}
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    res.status(503).json({ error: 'no_key' })
    return
  }

  const prompt =
    mode === 'extract'
      ? extractPrompt(payload.notes)
      : mode === 'catalog'
        ? catalogPrompt(payload)
        : mode === 'followup'
          ? followupPrompt(payload)
          : rationalePrompt(payload.criteria, payload.schools)
  // New AI Studio keys cannot call retired 2.5 Flash; the API names 3.6 Flash as the replacement.
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  const waitMs = mode === 'catalog' ? 15000 : 8000
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), waitMs + 2000)

  try {
    const r = await Promise.race([
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: mode === 'catalog' ? 0.5 : 0.2 },
          }),
        }
      ),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('gemini timed out')), waitMs)
      }),
    ])
    const data = await r.json()
    if (data.error) {
      console.error('[api/llm] Gemini error', data.error)
      res.status(502).json({ error: 'upstream_failed', detail: data.error.message })
      return
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      console.error('[api/llm] empty response from Gemini', data)
      res.status(502).json({ error: 'empty_response' })
      return
    }
    res.status(200).json(JSON.parse(stripFences(text)))
  } catch (err) {
    console.error('[api/llm] call failed', err)
    res.status(502).json({ error: 'upstream_failed' })
  } finally {
    clearTimeout(timer)
  }
}
