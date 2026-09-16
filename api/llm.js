// Both AI calls, switched by `mode`. This file is the only place in the app that talks to
// Gemini. It never picks a school, assigns a band, or produces a number — see the load-bearing
// decision in docs/02-ENGINEERING.md section 2. Without GEMINI_API_KEY it returns 503 and the
// client falls back to keyword extraction / template rationale (docs/02-ENGINEERING.md 6.4).
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
    "value": string | object, "confidence": "high" | "medium" | "low", "source_phrase": string, "strength": "required" | "preferred" | "flexible" } ],
  "affordability_signal": { "aid_needed": boolean, "confidence": "high" | "medium" | "low", "source_phrase": string | null },
  "unresolved": [string]
}

Rules:
- Never guess a value. If it isn't in the notes, omit it or mark confidence "low".
- "source_phrase" must be a literal substring of the notes below. This is what lets the counselor
  see where each row came from, and it makes fabrication visible.
- Do not infer race, religion, disability, immigration status, or sexuality. If the notes mention
  a support need explicitly, record it under "support_needs" with the literal phrase, nothing more.
- academic_interest "value" must be one of these slugs, never a sentence: art, marine_biology,
  computer_science, engineering, nursing, biology, business, education, environmental_science,
  agriculture, law. "Interested in art", "art school", "fine arts", or "studio art" → slug "art",
  label "Art", strength "required". Law / pre-law → slug "law", label "Law / pre-law",
  strength "required" unless the notes hedge ("not sure", "maybe"), then "preferred". Never
  substitute marine_biology. A JD is graduate school; this slug means an undergraduate
  law-related major or catalog law courses, not a law school.
- geography "value" must be an object: { "home_state": "PA", "max_miles": number | null, "prefer_far": boolean }.
  "Far from home", "out of state", "leave the state", or "away from home" (not "aren't too far from home")
  → prefer_far true, max_miles null, label "Out of state — far from home". Copy home_state into
  both the top-level field and geography.value.home_state as a two-letter postal code.

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

  const prompt = mode === 'extract' ? extractPrompt(payload.notes) : rationalePrompt(payload.criteria, payload.schools)
  // New AI Studio keys cannot call retired 2.5 Flash; the API names 3.6 Flash as the replacement.
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10000)

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
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
          }),
        }
      ),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('gemini timed out')), 8000)
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
