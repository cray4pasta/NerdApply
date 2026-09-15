# Engineering Doc — College List Builder

Written to be read by a designer and executed by Cursor. Plain language first, exact rules second.

---

## 1. Architecture in one picture

```
Counselor pastes notes
        |
        v
[ /api/llm.js  mode: "extract" ]  ← the only AI step that reads
        |
        v
   criteria JSON  →  counselor edits it on screen  ←  THE HUMAN GATE
        |
        v
[ src/lib/engine.js ]  ← plain code. no AI. does all the deciding.
   · hard filters
   · admissions band
   · affordability band
   · fit ranking
   · balance enforcement
        |
        v
   final list of 8–10 schools, with reasons already computed
        |
        v
[ /api/llm.js  mode: "rationale" ]  ← the only AI step that writes
   receives ONLY the facts the engine produced. writes one sentence each.
        |
        v
   list screen  →  counselor removes/annotates  →  print route
```

Two AI calls total. Roughly three to five seconds end to end.

---

## 2. The load-bearing decision

**The model reads and writes. The code decides.**

The AI is allowed to do two things: turn English into a form, and turn a set of given facts into
a readable sentence. It is never allowed to choose a school, assign a label, or produce a number.

Why this matters:

| If the AI picked schools | Because code picks schools |
|---|---|
| It can invent a college or a program | Impossible — it only sees schools that exist in the data file |
| Different list every run | Same input, same list, every time |
| "Make distance matter more" → reword the prompt and hope | → open `engine.js`, change one weight, rerun |
| No audit trail | Every label traces to an arithmetic comparison you can show on screen |

This is also the answer when they ask you to extend the code live. Practise saying it.

---

## 3. Stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite + React | Fast, no framework ceremony, you already run this in Cursor |
| Styling | Tailwind | Speed. The print stylesheet is hand-written CSS, see design doc |
| AI | Google Gemini Flash, free tier | Genuinely free, no card. Key from aistudio.google.com |
| Server | Vercel serverless functions | Keeps the API key off the browser. Free. |
| Data | Static JSON in the repo, generated once by a script | Instant, can't fail live, honest about freshness |
| PDF | Browser print with a dedicated stylesheet | Real HTML/CSS, accessible output, live links, zero deps |

**Local dev:** run `vercel dev`, not `npm run dev`. The `/api` folder only works under `vercel dev`.
This is the single most common thing people get stuck on.

---

## 4. Repo structure

Fewer, larger files. Easier to walk through live than twenty tiny ones.

```
/api
  llm.js                 ← both AI calls, one file, switched by `mode`
/scripts
  fetch-colleges.mjs     ← run once, writes src/data/colleges.json
/src
  main.jsx
  App.jsx                ← step state machine: notes → criteria → list → print
  /components
    NotesStep.jsx
    CriteriaStep.jsx
    ListStep.jsx
    FamilyDocument.jsx   ← the print route
  /lib
    colleges.js          ← getColleges(). THE ADAPTER BOUNDARY.
    extract.js           ← calls /api/llm, plus the no-key fallback
    engine.js            ← all scoring. the heart of the app.
    balance.js           ← list-level checks
  /data
    colleges.json        ← generated
    program-tags.json    ← hand-maintained, ~60 rows
  index.css
  print.css
/docs                    ← these four documents
README.md
.env.local               ← GEMINI_API_KEY=... (gitignored)
.env.example
```

---

## 5. Data

### 5.1 Where it comes from

College Scorecard, run by the U.S. Department of Education. Free API key from **api.data.gov**,
issued instantly by email. Docs at **collegescorecard.ed.gov/data/documentation**.

`scripts/fetch-colleges.mjs` runs once, pulls roughly 60 institutions, writes `colleges.json`,
and is then never run again during the demo.

> **Tell Cursor to verify the exact field names against the current documentation before writing
> the script.** Scorecard field paths change between API versions and guessing them wastes ten
> minutes. The names below are the right shape but treat them as a starting point.

### 5.2 Which 40 schools

**Forty enriched beats sixty shallow.** Every dimension you add — travel, application
requirements, student-life hooks — is a column you hand-tag across every row. Six dimensions
across sixty schools is the entire hour. Nobody counts your rows; they read one list of eight.

Choosing the seed set is a product decision, not a technical one. Bias it deliberately:

- ~9 Pennsylvania and mid-Atlantic institutions (covers example student A)
- ~9 warm-climate schools with real marine science programs (covers example student B)
- ~7 regional public universities — the schools counselors forget
- ~4 HBCUs, including at least one with marine science
- ~3 community colleges with strong articulation agreements
- ~4 well-known selective privates, so Reach labels have something to point at
- ~4 large flagships across regions

If the list only contains famous schools, the equity argument in your PRD is words. This is where
it becomes real, and it costs you nothing but the choice.

### 5.3 College record shape

```json
{
  "id": "215293",
  "name": "University of Pittsburgh-Pittsburgh Campus",
  "city": "Pittsburgh",
  "state": "PA",
  "lat": 40.4444,
  "lon": -79.9533,
  "ownership": "public",
  "setting": "city",
  "size": 19000,
  "hbcu": false,
  "admit_rate": 0.49,
  "sat_p25": 1230,
  "sat_p75": 1420,
  "test_optional": true,
  "cost_sticker_in_state": 36000,
  "cost_sticker_out_state": 55000,
  "net_price": {
    "0-30000": 16800,
    "30001-48000": 18200,
    "48001-75000": 22400,
    "75001-110000": 26100,
    "110001-plus": 29800
  },
  "grad_rate_6yr": 0.84,

  "cost_of_attendance": {
    "tuition_in_state": 21000,
    "room_board": 12400,
    "books_other": 3200
  },
  "merit_aid": { "pct_non_need_aid": 0.21, "avg_amount": 6400 },

  "nearest_airport": "PIT",
  "requirements": {
    "essay": true,
    "supplemental_essays": 1,
    "rec_letters": 2,
    "portfolio": false,
    "interview": "optional",
    "test_policy": "test_optional"
  },
  "student_life": [
    "Student-run game dev club with an annual showcase",
    "Large commuter population; strong weekday campus life, quieter weekends"
  ],
  "student_life_source": "counselor-added, unverified",

  "programs": ["computer_science", "engineering", "nursing", "biology"],
  "tags": ["abet_engineering", "co_op", "research_university"],
  "npc_url": "https://oafa.pitt.edu/afford/net-price-calculator/",
  "npc_display": "oafa.pitt.edu/afford",
  "source": "College Scorecard (IPEDS 2023-24)",
  "last_verified": "2026-09-15"
}
```

Where the new fields come from:

| Field | Source | Effort |
|---|---|---|
| `cost_of_attendance` | Scorecard, already in the response. **This is cost of living — no new source needed.** | Free |
| `merit_aid` | Scorecard aid fields | Free |
| `nearest_airport` | Hand-tagged, 40 rows | 5 min |
| `requirements` | Hand-tagged from each admissions page | 15 min |
| `student_life` | Counselor-authored. Pre-fill ~12 schools most likely to appear in the two demo students; leave the rest empty and editable in the UI. | 10 min |

`student_life` is never model-generated. There is no free structured dataset of campus
organisations, and letting the model invent them breaks the rule that the AI produces no facts.
The field is counselor-authored, stamped `counselor-added, unverified`, and that stamp prints.

`programs` and `tags` come from `program-tags.json`, hand-maintained. Scorecard's program data is
coarse — it will tell you a school awards biology degrees but not that it has a marine biology
concentration. Sixty rows of hand tagging takes ten minutes and is the difference between a
generic list and one that finds the right marine science school.

Conceptually, `program-tags.json` is the counselor-knowledge layer. Worth saying out loud.

### 5.4 The adapter boundary

```js
// src/lib/colleges.js
import data from '../data/colleges.json'
import tags from '../data/program-tags.json'

export function getColleges() {
  return data.map(c => ({ ...c, ...(tags[c.id] ?? {}) }))
}
```

Every other file imports `getColleges()`. Nothing else touches the JSON. To go live, you change
the inside of this one function. This is a twelve-second answer to "how would you plug in real
data?" and it's worth having.

---

## 6. The two AI calls

### 6.1 Extract

`POST /api/llm` with `{ mode: "extract", notes: "..." }`

Response contract — the model must return exactly this shape and nothing else:

```json
{
  "student_name": "John Smith",
  "academic": {
    "gpa": 3.5,
    "sat": 1230,
    "act": null,
    "rigor_notes": "AP Calc BC 4, AP CS A 5, AP Human Geo 3"
  },
  "criteria": [
    {
      "id": "c1",
      "category": "academic_interest",
      "label": "Computer science",
      "value": "computer_science",
      "confidence": "high",
      "source_phrase": "loves programming",
      "strength": "required"
    },
    {
      "id": "c2",
      "category": "geography",
      "label": "Within ~300 miles of home",
      "value": { "max_miles": 300, "home_state": "PA" },
      "confidence": "medium",
      "source_phrase": "schools that aren't too far from home",
      "strength": "preferred"
    }
  ],
  "affordability_signal": {
    "aid_needed": false,
    "confidence": "low",
    "source_phrase": null
  },
  "unresolved": ["No home city given; distance is estimated from state centroid."]
}
```

Categories, fixed list: `academic_interest`, `geography`, `environment`, `size`,
`support_needs`, `family_constraint`, `risk_tolerance`, `other`.

Prompt rules to enforce:
- Return JSON only. Use Gemini's `responseMimeType: "application/json"`.
- Never guess a value. If it isn't in the notes, omit it or mark confidence `low`.
- `source_phrase` must be a literal substring of the notes. This is what lets the UI show the
  counselor where each chip came from, and it makes fabrication visible.
- Do not infer race, religion, disability, immigration status, or sexuality. If the notes mention
  a support need explicitly, record it as `support_needs` with the literal phrase, nothing more.

### 6.2 Rationale

`POST /api/llm` with `{ mode: "rationale", criteria, schools }` where `schools` is the finished
list, each entry already carrying its labels, matched criteria, and numbers.

Response: `{ "215293": "One sentence.", "..." : "..." }`

Prompt rules:
- One sentence per school, under 25 words.
- Use only the facts provided. Do not add a fact not in the input.
- Do not use the words "safety," "guaranteed," "best," or any percentage.
- Written for a family reading it at a kitchen table, not for a counselor.

If this call fails, fall back to a template sentence assembled from the matched criteria. The
list still works; it just reads a bit flatter.

### 6.3 The serverless function

```js
// api/llm.js  — sketch
export default async function handler(req, res) {
  const { mode, ...payload } = req.body
  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(503).json({ error: 'no_key' })

  const prompt = mode === 'extract' ? extractPrompt(payload) : rationalePrompt(payload)

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    }
  )
  const data = await r.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  res.status(200).json(JSON.parse(text))
}
```

> Verify the current model name and endpoint in Google AI Studio before building. Model names
> change and a stale one fails with an unhelpful 404.

Temperature 0.2, not 0. Slightly above zero reads better for the rationale sentences and makes
no practical difference to extraction.

### 6.4 The no-key fallback

Lives in `src/lib/extract.js`. If `/api/llm` returns 503 or throws:

- SAT: `/\b(1[0-6]\d{2})\b/` and check 400–1600
- ACT: `/\b(\d{1,2})\s*ACT\b/i`
- GPA: `/\b([0-4]\.\d{1,2})\b/`
- State: match against a list of state names and postal codes
- Interest: keyword map — "programming|coding|computer science" → `computer_science`,
  "marine biology|marine science|ocean" → `marine_biology`, and so on
- Aid: `/financial aid|needs aid|low income|pell|can't afford|scholarship/i`
- Setting/size: "small|large|big school|city|rural|urban"

Everything it produces gets `confidence: "low"`. The criteria screen shows a visible banner:
*"AI extraction unavailable — criteria were matched by keyword. Please review carefully."*

This is not a compromise, it's a design position: the tool degrades loudly rather than silently.
Say that if it comes up.

---

## 7. The engine — exact rules

This is the part where vagueness costs you. Give Cursor these rules verbatim.

### 7.1 Hard filters (a school is excluded outright if any fail)

1. Does not offer the intended program (`programs` array or explicit tag)
2. A `required` geography criterion is violated (outside the radius, wrong region)
3. Estimated net price exceeds the counselor's ceiling by more than 60%, **unless** the school
   meets ≥95% of demonstrated need or carries a `strong_merit` tag

### 7.2 Academic strength

Scorecard does not publish GPA. So SAT does the work and GPA modifies it.

```js
// where the student sits in the school's middle 50%
// 0.0 = at the 25th percentile, 1.0 = at the 75th
let position = (studentSAT - school.sat_p25) / (school.sat_p75 - school.sat_p25)
position = clamp(position, -1, 2)

const gpaMod = studentGPA >= 3.7 ? 0.15 : studentGPA <= 3.2 ? -0.15 : 0
const strength = position + gpaMod
```

If no student SAT: use GPA alone on a coarser scale and force evidence strength to `limited`.
If the school has no SAT data (test-blind, or missing): same.

### 7.3 Admissions band

```
if admit_rate < 0.08                      → Reach          (always, no exceptions)
else if admit_rate < 0.20
      strength >= 1.0 → Target  else Reach
else if admit_rate < 0.50
      strength >= 1.0 → Likely
      strength >= 0.2 → Target
      else            → Reach
else  (admit_rate >= 0.50)
      strength >=  0.2 → Likely
      strength >= -0.4 → Target
      else             → Reach
```

**Hard rule: never label a school Likely when admit_rate < 0.20.** A 1500 SAT at a 6% admit
school is still a Reach. This rule exists so the app cannot produce a false safety, which is the
top risk in your strategy PRD.

Always display the comparison alongside the label: *"SAT 1230 · middle 50% is 1180–1380 · 49%
admit rate."* The label is an opinion; the numbers are the evidence.

### 7.4 Evidence strength

| Level | Condition |
|---|---|
| Strong | Student SAT present, school has both percentiles, admit rate present, data ≤2 years old |
| Moderate | One of those missing, or school is test-optional (self-reported scores skew the percentiles upward) |
| Limited | No student test score, or no school score data, or no admit rate |

Test-optional capping at Moderate is a real methodological point and a good detail to raise.

### 7.5 Affordability band

Inputs the counselor confirms on screen: `income_band` and `max_out_of_pocket` (annual).

```
est = school.net_price[income_band]

if est == null                        → Unknown
else if est <= ceiling                → Likely Affordable
else if est <= ceiling * 1.25         → Needs Review
else                                  → Needs Review
```

Note there is no "Unaffordable." Merit aid, appeals, and outside scholarships are real, and
declaring a school unaffordable is the counselor's judgment, not the software's.

**Two required overrides:**

1. **Out-of-state publics.** Scorecard's public net price is the in-state figure. If the student's
   home state differs from the school's state, downgrade to `Needs Review` and display:
   *"Net price shown is in-state. Out-of-state cost is typically higher — verify with the
   school's net price calculator."* This is a small detail that shows you actually read the data
   dictionary, and it's worth mentioning unprompted.

2. **Never derive affordability from sticker price.** If `net_price` is missing, the answer is
   `Unknown`, never a guess from `cost_sticker`.

Every affordability figure prints with the income band it assumes, the source, and the
last-verified date. Estimates without their assumptions are how families get hurt.

### 7.6 Fit score — counselor-weighted, ranking only, never displayed

The counselor ranks six dimensions on screen 3. Rank position becomes a multiplier.

```js
// rank 1 → 1.6, rank 2 → 1.4, rank 3 → 1.2, rank 4 → 1.0, rank 5 → 0.85, rank 6 → 0.7
const W = [1.6, 1.4, 1.2, 1.0, 0.85, 0.7]
const weight = dim => W[priorityOrder.indexOf(dim)]
```

Six dimensions, and every point scored belongs to exactly one of them:

| Dimension | Points available |
|---|---|
| `affordability` | +30 Likely Affordable · +12 Needs Review within 10% of ceiling · +8 strong merit signal |
| `program` | +25 intended programme with a matching specialty tag · +10 programme present but generic |
| `proximity` | +25 within the stated radius · +12 drivable (<300 mi) · +6 one direct flight |
| `admissions_realism` | +20 Target · +12 Likely · +6 Reach — *deliberately favours Target*, because a list of certainties is as badly built as a list of longshots |
| `environment` | +10 setting match · +10 size match · +8 per matched preference tag |
| `support` | +15 per matched support need |

```
raw = Σ (dimension points × weight(dimension))

then apply criterion strength from the criteria table:
   required 1.5   ·   preferred 1.0   ·   flexible 0.5

then two flat modifiers, outside the weighting:
+ 12   graduation rate above 65%
+  8   non-obvious institution (regional public, HBCU, CC pathway)  ← deliberate thumb on scale
```

The non-obvious bonus sits outside the counselor's weighting on purpose. It's the product's
equity position, not a preference, and a counselor shouldn't be able to rank it away by accident.
Worth saying out loud if asked.

This number orders the list. It is never shown to the counselor as a score and never printed for
the student. Ranking is internal; labels are what people see.

**Demo behaviour to verify:** move `proximity` from rank 3 to rank 1 on student A and at least
two schools should change position. If nothing moves, the weights are too flat — widen the `W`
array. The whole point of this screen is that the counselor can *see* their judgment take effect.

### 7.7 Selection

1. Compute band and fit for every surviving school
2. Sort by fit within each band
3. Take 2–3 Likely, 3–4 Target, 2–3 Reach → 8 to 10 total
4. Count Likely Affordable. If fewer than 2, swap the lowest-fit Reach for the highest-fit
   Likely Affordable school still available. Repeat up to twice.
5. If that still can't reach 2, keep the list and let the balance panel raise it loudly. Do not
   silently pad the list with schools that don't fit — surfacing the gap is the honest behaviour
   and it's the behaviour a counselor actually needs.

### 7.8 Balance checks — rerun after every counselor edit

| Check | Message |
|---|---|
| Zero Likely Affordable | "This list has no school the family is likely to afford. Consider adding an in-state public or a school that meets full need." |
| Fewer than 2 Likely admits | "This list is reach-heavy. Add at least two Likely schools." |
| More than 4 Reach | Same as above |
| All schools in one state | "Every school is in {state}. Worth confirming that's intentional." |
| No regional public, HBCU, or CC pathway present | "All recommendations are large or well-known institutions. Consider regional options." |
| Any school missing a program tag | "Program availability at {school} is unverified — check before sharing." |

Warnings do not block printing. They appear on the counselor screen and never in the family
document. The counselor decides.

### 7.9 Distance, and travel burden

Haversine between the school's lat/lon and a state-centroid lookup for the student's home state.
A state centroid is crude — Philadelphia and Pittsburgh are 300 miles apart. Flag this in the UI
as *"distance estimated from home state"* and note it in the README as the first thing you'd fix
with a ZIP code field. Naming a known limitation beats having it found.

**Then convert the number into something a family can act on.** "412 miles" means nothing. What
a parent is actually asking is *can he come home at Thanksgiving.*

```
miles < 60    → "Close enough to come home any weekend"
miles < 180   → "About a {h}-hour drive"
miles < 350   → "About a {h}-hour drive, or a short flight"
else, and home state has an airport hub with a direct route to nearest_airport
              → "One direct flight, roughly {h}h door to door"
else          → "Usually a connecting flight, most of a day each way"
```

Direct-route lookup is a tiny hand-maintained map of major hubs, not an airline API. For a
40-school seed set that's about fifteen pairs. If you skip it, default everything over 350 miles
to "a flight, roughly half a day each way" and label it an estimate — still far more useful than
a raw mileage figure.

Drive time: `miles / 60`, rounded. Say "about," never a precise figure.

### 7.10 Application gap

For each school, diff `school.requirements` against what the notes revealed the student has.

```
has      = things the extraction found (portfolio, awards, test scores, essay drafts)
needs    = school.requirements
gap      = needs - has
```

Prints on the student document as two short lines:

> **You already have** a competitive CS portfolio and a state-level award.
> **You'll need** two teacher recommendations and one supplemental essay.

Only claim `has` for things literally present in the notes. Absence of evidence is not evidence
of absence, so an empty `has` line is omitted rather than printed as "you have nothing."

This is the highest-value-per-minute feature on the student document. It's the only part that
tells them what to *do* on Monday.

---

## 8. Build order and time budget

Build in this order. Each step leaves you with something that runs, so if you're out of time you
stop at a working state rather than a broken one.

| # | Step | Minutes | Done when |
|---|---|---|---|
| 1 | Scaffold Vite + React + Tailwind, `vercel dev` running | 5 | Blank page loads |
| 1b | **Extract Nerd Apply tokens, write `tokens.css` + Tailwind theme** | 12 | Every token has a real value; nothing hardcoded anywhere after this point |
| 2 | Fetch script, hand-tag programs + requirements + airports | 12 | `colleges.json` has ~40 enriched rows |
| 3 | `engine.js` with hardcoded fake criteria and a fixed priority order | 15 | `console.log` prints a sensible labelled list |
| 4 | Notes + criteria **table** + priority ranking, real extraction | 12 | Student A produces correct rows; reordering priorities changes the list |
| 5 | List screen with dual labels, travel burden, balance panel | 10 | Both example students produce good lists |
| 6 | Student document + print stylesheet | 18 | Prints two clean pages |
| 7 | Counselor document (same component, `variant` prop) | 5 | Prints, differs correctly |
| 8 | README, deploy to Vercel | 8 | Live URL works |

That totals 85 minutes, not 60. That is on purpose: steps 7 and 8 are the compressible ones,
and the P1 list in the PRD is what gets dropped first. **If you are at minute 45 and step 6
hasn't started, cut P1 entirely and go straight to the student document.** The document is the
deliverable named in the brief; the application gap and student-life hook are not.

**Step 3 before step 4 is deliberate.** Build the brain against fake input first. If you wire the
AI in first, every engine bug looks like an AI bug and you'll lose twenty minutes chasing ghosts.

---

## 9. Things that will go wrong

| Symptom | Cause | Fix |
|---|---|---|
| `/api/llm` 404s locally | Running `npm run dev` | Run `vercel dev` |
| Gemini returns prose wrapped in ```json fences | `responseMimeType` not set | Set it, and strip fences defensively anyway |
| Model 404s | Stale model name | Check current names in AI Studio |
| Every school is a Reach | SAT percentiles missing in the data, division producing NaN | Guard every divide; null data means `limited` evidence, not a bad band |
| Net price is `null` for many schools | Real and expected in Scorecard | That's what `Unknown` is for. Do not backfill from sticker price. |
| Document prints as three pages | Content overflow | See the print section of the design doc |
| API key visible in the browser | Called Gemini from React directly | It must go through `/api/llm` |
| Rate limited mid-demo | Free tier limits | The fallback covers you. Also cache the last result in state so re-renders don't re-call. |

---

## 10. README contents

Keep it to one page. The reviewer reads this before the code.

1. What it does, two sentences
2. How to run it — `.env.example`, `vercel dev`
3. **Architecture decisions and why** — the model reads and writes, the code decides; static data
   snapshot with visible freshness; dual labels never blended; no percentages
4. **What I deliberately did not build, and why** — the table from the PRD
5. **Known limitations** — state-centroid distance, 60-school seed set, test-optional percentile
   skew, in-state net price on out-of-state publics
6. **What I'd build next, in order** — ZIP-code distance, Scorecard live with caching, counselor
   override log, then the audit trail

Section 5 is the one that makes you look senior. Engineers who can't name their own limitations
are the ones who haven't found them yet.
