# Live Scorecard Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a counselor builds a list, fetch matching U.S. colleges from live College Scorecard, drop schools the student’s SAT cannot reach (200+ points below the school’s SAT 25th percentile), then let `engine.js` pick 8–10 — falling back to the 40-school file if Scorecard is unavailable.

**Architecture:** `/api/scorecard.js` is the only place that talks to Scorecard (key stays on the server). It filters by required-major CIP codes, normalizes rows into the existing college record shape, and overlays catalog courses from `program-tags.json` when a UNITID maps to a snapshot school. `src/lib/catalog.js` is the client adapter: live catalog, snapshot, or a hard empty error. `engine.js` still decides every school and band. The AI still only extracts notes and writes sentences.

**Tech Stack:** Vite + React (existing), Vercel serverless `api/*.js`, College Scorecard `v1/schools` API, no new npm dependencies, no test runner. Checks are `node` scripts using `node:assert`.

## Global Constraints

- The model reads and writes. `engine.js` decides. The AI never picks a school, assigns a band, or produces a number.
- No TypeScript, no test runner, no React Router, no state library, no new npm dependencies.
- Keep each file under ~300 lines when possible.
- Do not swallow errors in an empty `try/catch` — log it.
- Never put `SCORECARD_API_KEY` or `GEMINI_API_KEY` in client code. Scorecard calls go through `/api/scorecard.js` only.
- SAT mismatch rule (verbatim): if the student has an SAT and the school has `sat_p25`, and `studentSAT <= sat_p25 - 200`, exclude the school.
- If student SAT or school `sat_p25` is missing, skip that drop.
- Program strength is bachelor’s awards in the field (Scorecard), never a US News / prestige rank number.
- Named courses only from `program-tags.json`. Never invent courses.
- No required major → do not query the national catalog; use `getColleges()` snapshot.
- Zero Scorecard hits for the CIP → do not invent schools and do not silently swap the snapshot; show a plain error.
- No key / timeout / 4xx/5xx → snapshot + visible banner.
- Tokens only in UI (no Tailwind arbitrary colors/spacing).
- Do not build P1 features.
- Commit `.env.example` with empty placeholders only.

### File map

| File | Responsibility |
|---|---|
| `src/lib/cip.js` | Slug ↔ CIP codes; required-major helpers |
| `src/lib/extract.js` | Add `design` as a real program slug |
| `src/lib/engine.js` | SAT 200-point gate + awards tercile points |
| `src/lib/scorecard-map.js` | Scorecard JSON → college record; tag overlay |
| `src/data/snapshot-unitids.json` | Snapshot slug → IPEDS UNITID |
| `api/scorecard.js` | POST handler: key, query, paginate, normalize |
| `vite.config.js` | Local `/api/scorecard` proxy (same as `/api/llm`) |
| `src/lib/catalog.js` | Client `loadSchoolsForList` |
| `src/lib/progress.js` | Longer timeout constant for Scorecard |
| `src/App.jsx` | `generateList` uses catalog loader |
| `src/lib/caseload.js` | `catalogSource` / `catalogNote` on the student |
| `src/lib/highlights.js` | Program title + awards; no false “not in snapshot” on live rows |
| `src/components/ListStep.jsx` | Catalog banner + awards fact |
| `src/components/FamilyDocument.jsx` | Counselor catalog line |
| `src/lib/rationale.js` | Pass program title + awards into the write call |
| `scripts/verify-mismatch.mjs` | SAT gate checks |
| `scripts/verify-cip.mjs` | CIP + design extraction checks |
| `scripts/verify-scorecard-map.mjs` | Normalize fixture checks |
| `scripts/fixtures/scorecard-school.json` | One fake Scorecard row |
| `.env.example`, `CLAUDE.md`, `README.md` | Runtime Scorecard key + fallback honesty |

---

### Task 1: Design slug and CIP map

**Files:**
- Create: `src/lib/cip.js`
- Create: `scripts/verify-cip.mjs`
- Modify: `src/lib/extract.js` (`PROGRAM_CHOICES`, `INTEREST_KEYWORDS`, `canonicalProgram`)

**Interfaces:**
- Consumes: existing `extractFallback(notes)` in `src/lib/extract.js`
- Produces:
  - `CIP_BY_SLUG` — `{ [slug: string]: string[] }`
  - `cipsForSlugs(slugs: string[]): string[]`
  - `slugForCip(code: string): string | null`
  - `requiredProgramSlugs(criteria: object[]): string[]`

- [ ] **Step 1: Write the failing CIP check**

Create `scripts/verify-cip.mjs`:

```js
import assert from 'node:assert/strict'
import { CIP_BY_SLUG, cipsForSlugs, slugForCip, requiredProgramSlugs } from '../src/lib/cip.js'
import { extractFallback } from '../src/lib/extract.js'

assert.deepEqual(CIP_BY_SLUG.design, ['5004'])
assert.ok(cipsForSlugs(['design']).includes('5004'))
assert.equal(slugForCip('5004'), 'design')
assert.deepEqual(
  requiredProgramSlugs([
    { category: 'academic_interest', strength: 'required', value: 'design' },
    { category: 'academic_interest', strength: 'preferred', value: 'art' },
  ]),
  ['design']
)

const extracted = extractFallback('Maya, SAT 600, interested in graphic design')
const row = extracted.criteria.find((c) => c.category === 'academic_interest')
assert.equal(row?.value, 'design')
console.log('verify-cip ok')
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node scripts/verify-cip.mjs`

Expected: `ERR_MODULE_NOT_FOUND` for `src/lib/cip.js` (or extract does not yield `design`).

- [ ] **Step 3: Add `src/lib/cip.js`**

CIP strings are 4-digit with no decimal (Scorecard: `11.07` → `1107`).

```js
export const CIP_BY_SLUG = {
  design: ['5004'],
  art: ['5007', '5001'],
  computer_science: ['1107'],
  nursing: ['5138'],
  engineering: ['1401', '1408', '1409', '1410', '1419'],
  biology: ['2601'],
  marine_biology: ['2613'],
  business: ['5202', '5201'],
  education: ['1301'],
  environmental_science: ['0301'],
  agriculture: ['0100'],
  law: ['2200', '4504'],
}

const SLUG_BY_CIP = Object.fromEntries(
  Object.entries(CIP_BY_SLUG).flatMap(([slug, codes]) => codes.map((code) => [code, slug]))
)

export function cipsForSlugs(slugs) {
  return [...new Set((slugs ?? []).flatMap((slug) => CIP_BY_SLUG[slug] ?? []))]
}

export function slugForCip(code) {
  if (code == null) return null
  const digits = String(code).replace(/\D/g, '').padStart(4, '0').slice(-4)
  return SLUG_BY_CIP[digits] ?? null
}

export function requiredProgramSlugs(criteria) {
  return (criteria ?? [])
    .filter(
      (c) =>
        c.category === 'academic_interest' &&
        c.strength === 'required' &&
        typeof c.value === 'string' &&
        CIP_BY_SLUG[c.value]
    )
    .map((c) => c.value)
}
```

- [ ] **Step 4: Teach extraction about design**

In `src/lib/extract.js`:

1. Add `{ value: 'design', label: 'Design' }` to `PROGRAM_CHOICES` (after Art).
2. Add this keyword **above** the art pattern so “graphic design” does not become only Art:

```js
[/graphic design|industrial design|visual design|\bUX\b|interested in design|\bdesign\b/i, 'design'],
```

3. In `canonicalProgram`, before the art `/\bart/` check:

```js
if (/design/.test(words) && !/interior_design_only_placeholder/.test(words)) return 'design'
```

Use `/design/` only — do not add a fake interior slug. Then keep the existing art rule.

- [ ] **Step 5: Re-run the check**

Run: `node scripts/verify-cip.mjs`

Expected: `verify-cip ok`

- [ ] **Step 6: Commit**

```bash
git add src/lib/cip.js src/lib/extract.js scripts/verify-cip.mjs
git commit -m "$(cat <<'EOF'
Add design as a program slug mapped to Scorecard CIP 5004.

EOF
)"
```

---

### Task 2: SAT mismatch hard filter

**Files:**
- Create: `scripts/verify-mismatch.mjs`
- Modify: `src/lib/engine.js` (`passesHardFilters`, `buildList`; export `isSatMismatch`)

**Interfaces:**
- Consumes: `buildList({ schools, criteria, income_band, max_out_of_pocket, home_state, academic, priorityOrder })`
- Produces: `isSatMismatch(school, studentSAT) => boolean` — true when both SATs exist and `studentSAT <= school.sat_p25 - 200`

- [ ] **Step 1: Write the failing mismatch check**

```js
import assert from 'node:assert/strict'
import { isSatMismatch, buildList } from '../src/lib/engine.js'

assert.equal(isSatMismatch({ sat_p25: 1460 }, 600), true)
assert.equal(isSatMismatch({ sat_p25: 720 }, 600), false)
assert.equal(isSatMismatch({ sat_p25: 800 }, 600), true)
assert.equal(isSatMismatch({ sat_p25: 799 }, 600), false)
assert.equal(isSatMismatch({ sat_p25: 1460 }, null), false)
assert.equal(isSatMismatch({}, 600), false)

const harvard = {
  id: 'harvard',
  name: 'Harvard University',
  city: 'Cambridge',
  state: 'MA',
  lat: 42.37,
  lon: -71.12,
  ownership: 'private',
  setting: 'city',
  size: 7000,
  admit_rate: 0.03,
  sat_p25: 1460,
  sat_p75: 1580,
  programs: ['design'],
  net_price: { '75001-110000': 15000 },
  tags: [],
}
const openDesign = {
  ...harvard,
  id: 'open-design',
  name: 'Open Design College',
  admit_rate: 0.7,
  sat_p25: 720,
  sat_p75: 980,
  net_price: { '75001-110000': 12000 },
}

const list = buildList({
  schools: [harvard, openDesign],
  criteria: [{ id: 'c1', category: 'academic_interest', value: 'design', strength: 'required' }],
  income_band: '75001-110000',
  max_out_of_pocket: 25000,
  home_state: 'PA',
  academic: { sat: 600, gpa: 3.0 },
  priorityOrder: ['affordability', 'program', 'proximity', 'admissions_realism', 'environment', 'support'],
})

assert.equal(list.some((s) => s.id === 'harvard'), false)
assert.equal(list.some((s) => s.id === 'open-design'), true)
console.log('verify-mismatch ok')
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node scripts/verify-mismatch.mjs`

Expected: fail (`isSatMismatch` is not exported, and Harvard is still eligible).

- [ ] **Step 3: Implement the gate**

Add and export:

```js
const SAT_MISMATCH_POINTS = 200

export function isSatMismatch(school, studentSAT) {
  if (studentSAT == null || school?.sat_p25 == null) return false
  return studentSAT <= school.sat_p25 - SAT_MISMATCH_POINTS
}
```

In `passesHardFilters`, add `studentSAT` to the options object and, after the required-program check:

```js
if (isSatMismatch(school, studentSAT)) return false
```

In `buildList`, pass `studentSAT: academic?.sat` into `passesHardFilters`.

Do not apply this rule when SAT is missing on either side.

- [ ] **Step 4: Re-run the check**

Run: `node scripts/verify-mismatch.mjs`

Expected: `verify-mismatch ok`

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine.js scripts/verify-mismatch.mjs
git commit -m "$(cat <<'EOF'
Drop schools 200+ SAT points above the student as mismatches, not Reaches.

EOF
)"
```

---

### Task 3: Program-strength points from awards

**Files:**
- Modify: `src/lib/engine.js` (`dimensionContributions`, `buildList`)
- Modify: `scripts/verify-mismatch.mjs` (append awards ranking assertion)

**Interfaces:**
- Consumes: `school.program_awards` — `{ [slug: string]: number }`
- Produces: extra `program` dimension points from terciles of awards **among schools that already passed hard filters**. Missing awards → no extra points. A dropped mismatch must not re-enter because it has high awards.

- [ ] **Step 1: Extend the verify script with two passing design schools**

After the Harvard assertion in `scripts/verify-mismatch.mjs`, add:

```js
const smallProgram = {
  ...openDesign,
  id: 'small-design',
  name: 'Small Design College',
  program_awards: { design: 10 },
}
const largeProgram = {
  ...openDesign,
  id: 'large-design',
  name: 'Large Design College',
  sat_p25: 730,
  program_awards: { design: 400 },
}
const ranked = buildList({
  schools: [harvard, smallProgram, largeProgram],
  criteria: [{ id: 'c1', category: 'academic_interest', value: 'design', strength: 'required' }],
  income_band: '75001-110000',
  max_out_of_pocket: 25000,
  home_state: 'PA',
  academic: { sat: 600, gpa: 3.0 },
  priorityOrder: ['program', 'affordability', 'proximity', 'admissions_realism', 'environment', 'support'],
})
assert.equal(ranked.some((s) => s.id === 'harvard'), false)
assert.ok(ranked.findIndex((s) => s.id === 'large-design') < ranked.findIndex((s) => s.id === 'small-design'))
```

- [ ] **Step 2: Run and confirm ranking fails (or ties)**

Run: `node scripts/verify-mismatch.mjs`

Expected: fail on the index comparison until awards affect `fit`.

- [ ] **Step 3: Score awards in terciles**

After computing `surviving` in `buildList`, before mapping `scored`:

```js
function awardsTerciles(schools, slugs) {
  const values = schools
    .map((s) => Math.max(0, ...slugs.map((slug) => s.program_awards?.[slug] ?? 0)))
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
  if (values.length === 0) return null
  return {
    mid: values[Math.floor(values.length / 3)] ?? values[0],
    high: values[Math.floor((values.length * 2) / 3)] ?? values[values.length - 1],
  }
}
```

Pass `awardsTerciles: awardsTerciles(surviving, interestPrograms)` into `fitScore` / `dimensionContributions` ctx.

In the program-points loop, after the existing `school.programs?.includes(c.value)` bonus:

```js
const awards = school.program_awards?.[c.value]
if (awards != null && ctx.awardsTerciles) {
  if (awards >= ctx.awardsTerciles.high) programPoints += 15 * strengthOf(c)
  else if (awards >= ctx.awardsTerciles.mid) programPoints += 8 * strengthOf(c)
  else programPoints += 3 * strengthOf(c)
}
```

`fitScore` must pass `awardsTerciles` through on `ctx`.

- [ ] **Step 4: Re-run**

Run: `node scripts/verify-mismatch.mjs`

Expected: `verify-mismatch ok`

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine.js scripts/verify-mismatch.mjs
git commit -m "$(cat <<'EOF'
Rank remaining schools by how many degrees they award in the student’s major.

EOF
)"
```

---

### Task 4: Normalize Scorecard rows

**Files:**
- Create: `src/data/snapshot-unitids.json`
- Create: `src/lib/scorecard-map.js`
- Create: `scripts/fixtures/scorecard-school.json`
- Create: `scripts/verify-scorecard-map.mjs`

**Interfaces:**
- Consumes: one Scorecard `results[]` element; `CIP_BY_SLUG` / `slugForCip`; `program-tags.json`; `snapshot-unitids.json`
- Produces: `normalizeScorecardSchool(raw, { queriedSlugs, tagsBySlug, unitIdToSlug, lastVerified }) => school | null`

College record fields to fill: `id`, `name`, `city`, `state`, `lat`, `lon`, `ownership`, `setting`, `size`, `hbcu`, `admit_rate`, `sat_p25`, `sat_p75`, `test_optional`, `net_price`, `grad_rate_6yr`, `cost_of_attendance`, `programs`, `program_names`, `program_awards`, `tags`, `courses`, `course_source`, `npc_url`, `npc_display`, `source`, `last_verified`.

- [ ] **Step 1: Add a fixture**

`scripts/fixtures/scorecard-school.json`:

```json
{
  "id": 166027,
  "school": {
    "name": "Harvard University",
    "city": "Cambridge",
    "state": "MA",
    "ownership": 2,
    "locale": 12,
    "school_url": "https://www.harvard.edu/",
    "minority_serving": { "historically_black": 0 }
  },
  "location": { "lat": 42.3744, "lon": -71.1182 },
  "latest": {
    "student": { "size": 7000 },
    "admissions": {
      "admission_rate": { "overall": 0.03 },
      "sat_scores": {
        "25th_percentile": { "critical_reading": 730, "math": 760 },
        "75th_percentile": { "critical_reading": 780, "math": 800 }
      }
    },
    "cost": {
      "tuition": { "in_state": 54000, "out_of_state": 54000 },
      "roomboard": { "oncampus": 18000 },
      "booksupply": 1000,
      "net_price": {
        "private": {
          "by_income_level": {
            "0-30000": 1000,
            "30001-48000": 2000,
            "48001-75000": 8000,
            "75001-110000": 20000,
            "110001-plus": 40000
          }
        }
      }
    },
    "completion": { "rate_suppressed": { "four_year": 0.97 } },
    "programs": {
      "cip_4_digit": [
        {
          "code": "5004",
          "title": "Design and Applied Arts",
          "credential": { "level": 3 },
          "counts": { "ipeds_awards2": 12 }
        }
      ]
    }
  }
}
```

- [ ] **Step 2: Write the failing normalize check**

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeScorecardSchool } from '../src/lib/scorecard-map.js'

const raw = JSON.parse(readFileSync(new URL('./fixtures/scorecard-school.json', import.meta.url), 'utf8'))
const school = normalizeScorecardSchool(raw, {
  queriedSlugs: ['design'],
  tagsBySlug: {},
  unitIdToSlug: {},
  lastVerified: '2026-09-15',
})
assert.equal(school.id, '166027')
assert.equal(school.name, 'Harvard University')
assert.equal(school.ownership, 'private')
assert.equal(school.setting, 'city')
assert.equal(school.admit_rate, 0.03)
assert.equal(school.sat_p25, 1490)
assert.equal(school.sat_p75, 1580)
assert.deepEqual(school.programs, ['design'])
assert.equal(school.program_names.design, 'Design and Applied Arts')
assert.equal(school.program_awards.design, 12)
assert.equal(school.source, 'College Scorecard (live)')
assert.equal(school.last_verified, '2026-09-15')
console.log('verify-scorecard-map ok')
```

SAT 25th is reading 730 + math 760 = 1490. 75th is 780 + 800 = 1580.

- [ ] **Step 3: Run and confirm fail**

Run: `node scripts/verify-scorecard-map.mjs`

Expected: `ERR_MODULE_NOT_FOUND` for `scorecard-map.js`.

- [ ] **Step 4: Implement mapping**

`src/data/snapshot-unitids.json` — map known snapshot ids to UNITIDs (best-effort; overlay is optional). Include at least:

```json
{
  "pitt": "215293",
  "psu": "214777",
  "temple": "216339",
  "drexel": "212054",
  "lehigh": "213543",
  "cmu": "211440",
  "upenn": "215062",
  "howard": "131520",
  "michigan": "170976",
  "northeastern": "167358",
  "asu": "104151",
  "duke": "198419",
  "uf": "134130",
  "miami": "135726"
}
```

Add more snapshot ids if a 30-second Scorecard `school.name` lookup is handy; missing entries only mean no catalog courses on live rows.

`src/lib/scorecard-map.js` (keep under ~300 lines):

- `ownership`: `1` → `public`, else `private`
- `setting` from `school.locale`: 11–13 `city`, 21–23 `suburban`, 31–33 `town`, 41–43 `rural`, else `city`
- `sat_p25` / `sat_p75`: sum of `critical_reading` + `math` when **both** numbers exist; otherwise `null` (do not use SAT average for the 200-point gate)
- `admit_rate`: `latest.admissions.admission_rate.overall`
- `net_price`: first non-empty of `latest.cost.net_price.public|private|other.by_income_level`, keys `0-30000`, `30001-48000`, `48001-75000`, `75001-110000`, `110001-plus`
- `grad_rate_6yr`: `latest.completion.rate_suppressed.four_year` ?? `latest.completion.rate_suppressed.overall`
- `programs`: slugs from `slugForCip` on each `latest.programs.cip_4_digit` entry whose credential level is 3 **and** whose slug is in `queriedSlugs`. If Scorecard already filtered the nested array, still intersect with `queriedSlugs`.
- `program_awards[slug]`: `counts.ipeds_awards2` ?? `counts.ipeds_awards1` (skip if null)
- `program_names[slug]`: CIP `title`
- Overlay: if `String(raw.id)` is a key in the inverted `snapshot-unitids` map, merge `tags`, `courses`, `program_names` (catalog name wins if present), `program_names` from tags, `npc_url` from tags/snapshot only if present in tags object
- `id`: prefer snapshot slug when UNITID maps, else `String(raw.id)`
- `source`: `'College Scorecard (live)'`
- `test_optional`: `false` if unknown
- Return `null` if `school.name` or `id` is missing

Import `program-tags.json` only from the API handler (or pass `tagsBySlug` in) so the map function stays pure.

- [ ] **Step 5: Re-run**

Run: `node scripts/verify-scorecard-map.mjs`

Expected: `verify-scorecard-map ok`

- [ ] **Step 6: Commit**

```bash
git add src/lib/scorecard-map.js src/data/snapshot-unitids.json scripts/fixtures/scorecard-school.json scripts/verify-scorecard-map.mjs
git commit -m "$(cat <<'EOF'
Normalize Scorecard rows into the college records the engine already scores.

EOF
)"
```

---

### Task 5: `/api/scorecard` route and local proxy

**Files:**
- Create: `api/scorecard.js`
- Modify: `vite.config.js`
- Modify: `.env.example`
- Modify: `src/lib/progress.js` (add `SCORECARD_MS = 12000`)

**Interfaces:**
- Consumes: `POST { programs: string[], income_band?: string }`
- Produces: `200 { schools: object[], vintage: string, source: 'live' }`
- `400 { error: 'malformed' }` if `programs` missing or not a non-empty array of known slugs
- `405` if not POST
- `503 { error: 'no_key' }` if `process.env.SCORECARD_API_KEY` is missing
- `502 { error: 'upstream_failed' }` on Scorecard error/timeout/empty parse

Exact Scorecard request (verify against the live data dictionary if a field 400s; do not invent replacements without logging the failed field list):

```
GET https://api.data.gov/ed/collegescorecard/v1/schools
  api_key=SCORECARD_API_KEY
  school.operating=1
  school.degrees_awarded.predominant=3
  latest.programs.cip_4_digit.code=5004
  latest.programs.cip_4_digit.credential.level=3
  per_page=100
  page=0
  fields=id,school.name,school.city,school.state,school.ownership,school.locale,school.school_url,school.minority_serving.historically_black,location.lat,location.lon,latest.student.size,latest.admissions.admission_rate.overall,latest.admissions.sat_scores.25th_percentile.critical_reading,latest.admissions.sat_scores.25th_percentile.math,latest.admissions.sat_scores.75th_percentile.critical_reading,latest.admissions.sat_scores.75th_percentile.math,latest.cost.tuition.in_state,latest.cost.tuition.out_of_state,latest.cost.roomboard.oncampus,latest.cost.booksupply,latest.cost.net_price.public.by_income_level,latest.cost.net_price.private.by_income_level,latest.cost.net_price.other.by_income_level,latest.completion.rate_suppressed.four_year,latest.completion.rate_suppressed.overall,latest.programs.cip_4_digit.code,latest.programs.cip_4_digit.title,latest.programs.cip_4_digit.credential.level,latest.programs.cip_4_digit.counts.ipeds_awards1,latest.programs.cip_4_digit.counts.ipeds_awards2
```

Pagination: pages `0`, `1`, `2` (max 300 rows) or stop when `results.length === 0` or `metadata.page * per_page + results.length >= metadata.total`.

CIP list: `cipsForSlugs(programs).join(',')` on `latest.programs.cip_4_digit.code`. If the response is 0 results and more than one CIP was sent, retry **once per CIP** and merge by `id`.

Sort: first try `&sort=latest.programs.cip_4_digit.counts.ipeds_awards2:desc`. If that request is not ok, log and retry the same page **without** `sort`.

Timeout: 8s abort (same pattern as `api/llm.js`). Log failures with `console.error('[api/scorecard]', ...)`.

- [ ] **Step 1: Point `.env.example` at runtime use**

Replace the Scorecard comment with:

```
# Used when the counselor builds a list. Without it, the app uses src/data/colleges.json
# and says so. Get a key at https://api.data.gov/signup/
SCORECARD_API_KEY=
```

- [ ] **Step 2: Implement `api/scorecard.js`**

Follow `api/llm.js` handler shape (`req.method`, `req.body`, `res.status().json()`). Import `cipsForSlugs` from `../src/lib/cip.js`, `normalizeScorecardSchool` from `../src/lib/scorecard-map.js`, tags from `../src/data/program-tags.json`, unit ids from `../src/data/snapshot-unitids.json`.

Build `unitIdToSlug` as `{ [unitid]: slug }` from `snapshot-unitids.json`.

`vintage` = today’s UTC date `YYYY-MM-DD`.

Skip `normalizeScorecardSchool` results that are `null`. Deduplicate by `school.id`.

If after normalize `schools.length === 0`, still return `200 { schools: [], vintage, source: 'live' }` — the client treats empty as the “no matching programs” error, not as snapshot fallback.

- [ ] **Step 3: Proxy in Vite**

In `vite.config.js`, load `scorecardHandler` from `./api/scorecard.js`. Duplicate the `/api/llm` middleware for `/api/scorecard`, setting `process.env.SCORECARD_API_KEY = env.SCORECARD_API_KEY` when present. Keep `vercelStyleRes`.

Add to `src/lib/progress.js`:

```js
export const SCORECARD_MS = 12000
```

- [ ] **Step 4: Smoke the local route without a key**

Run: `npm run dev` (if not already running). Then:

```bash
curl -s -o /tmp/sc.json -w "%{http_code}" -X POST http://localhost:5173/api/scorecard \
  -H 'Content-Type: application/json' \
  -d '{"programs":["design"]}'
```

Expected: `503` and body `{"error":"no_key"}` when `.env.local` has no Scorecard key.

If a key **is** present, expected: `200` and `schools` is an array (may be long). Confirm one object has `sat_p25` or `null`, `programs` includes `design`, and `source` is `College Scorecard (live)`.

- [ ] **Step 5: Commit**

```bash
git add api/scorecard.js vite.config.js .env.example src/lib/progress.js
git commit -m "$(cat <<'EOF'
Add a server Scorecard route so list-building can query U.S. colleges by major.

EOF
)"
```

---

### Task 6: Client catalog adapter

**Files:**
- Create: `src/lib/catalog.js`
- Create: `scripts/verify-catalog-reasons.mjs` (pure helpers only, no fetch)

**Interfaces:**
- Consumes: `fetchWithTimeout`, `SCORECARD_MS`, `getColleges()`, `requiredProgramSlugs`
- Produces:
  - `loadSchoolsForList({ criteria, incomeBand }) => Promise<{ schools, source, reason, vintage, error }>`
  - `source`: `'live' | 'snapshot'`
  - `reason`: `'ok' | 'no_required_major' | 'unavailable' | 'empty'`

Rules (implement exactly):

1. `requiredProgramSlugs(criteria).length === 0` → `{ schools: getColleges(), source: 'snapshot', reason: 'no_required_major', vintage: null, error: null }`
2. POST `/api/scorecard` with `{ programs, income_band: incomeBand }` and `SCORECARD_MS`
3. Network throw / abort → log `console.warn('[catalog] Scorecard unavailable', err)` → snapshot, `reason: 'unavailable'`
4. Status 503 or not ok → snapshot, `reason: 'unavailable'`
5. `200` and `Array.isArray(schools)` and `schools.length === 0` → `{ schools: [], source: 'live', reason: 'empty', error: 'No matching programs in College Scorecard for this major. Mark the major Flexible, or add a different program, then build again.' }`
6. `200` with schools → `{ schools, source: 'live', reason: 'ok', vintage: data.vintage ?? null, error: null }`
7. Malformed 200 (no array) → snapshot, `reason: 'unavailable'`, log the body shape

- [ ] **Step 1: Implement `src/lib/catalog.js` with those seven branches**

- [ ] **Step 2: Commit**

```bash
git add src/lib/catalog.js
git commit -m "$(cat <<'EOF'
Load colleges from Scorecard at generate time, with a snapshot fallback.

EOF
)"
```

---

### Task 7: Wire `generateList`

**Files:**
- Modify: `src/lib/caseload.js` (`createConversation` adds `catalogSource: null`, `catalogNote: null`)
- Modify: `src/App.jsx` (`generateList`; stuck-timeout path stays on `getColleges()`)

**Interfaces:**
- Consumes: `loadSchoolsForList`, `buildList`, `assertList`
- Produces: conversation fields `catalogSource`, `catalogNote`, `list`

- [ ] **Step 1: Extend conversation state**

In `createConversation`:

```js
catalogSource: null,
catalogNote: null,
```

- [ ] **Step 2: Change `generateList`**

After `snapshot` is captured, replace `const built = buildList({ schools: getColleges(), ...})` with:

```js
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
```

When patching the list message, set:

```js
catalogSource: catalog.source,
catalogNote:
  catalog.reason === 'ok'
    ? `Catalog: College Scorecard (live)${catalog.vintage ? ` · ${catalog.vintage}` : ''}.`
    : catalog.reason === 'no_required_major'
      ? 'No required major — using the local college snapshot.'
      : 'College data is the local snapshot. Scorecard was unavailable.',
```

Keep the existing user-facing list intro sentences. The catalog line belongs on the list card (Task 8), not as a replacement for that intro.

On generate failure, existing `err.message` path already shows a flag — the empty-catalog throw uses that.

Leave the **stuck generating timeout** on `getColleges()` so a hung live fetch can still recover from the snapshot. Log `console.warn('[app] generate recover used local snapshot')`.

- [ ] **Step 3: BUILD_STEPS copy**

In `src/lib/progress.js` change the second build step to `'Looking up colleges that offer this program'`.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/lib/caseload.js src/lib/progress.js
git commit -m "$(cat <<'EOF'
Build lists from the live catalog when Scorecard is available.

EOF
)"
```

---

### Task 8: Show program facts, not prestige ranks

**Files:**
- Modify: `src/lib/highlights.js`
- Modify: `src/components/ListStep.jsx`
- Modify: `src/components/FamilyDocument.jsx`
- Modify: `src/App.jsx` (pass `catalogNote` into `ListStep` / print)
- Modify: `src/lib/rationale.js`

**Interfaces:**
- Consumes: `school.program_names`, `school.program_awards`, `school.source`
- Produces: highlight objects `{ key, label, courses, kind, awards }` where `awards` is a number or `null`

- [ ] **Step 1: Highlights**

For live rows (`school.source === 'College Scorecard (live)'`) if the interest is not in `school.programs`, **omit** that highlight (return nothing for that interest) — do not say “not in this snapshot”.

For matched programs, `label` = `school.program_names[value] ?? PROGRAM_LABEL[value]`, `awards` = `school.program_awards?.[value] ?? null`.

Filter out null entries if you use `flatMap`.

- [ ] **Step 2: List banner and awards line**

`ListStep` new optional prop `catalogNote`. Render it under the Balance heading with `font-sans text-12 text-ink-2` when present.

Under each highlight label, if `p.awards != null`:

```jsx
<p className="mt-1 font-sans text-12 text-ink-3">
  Awarded {p.awards} bachelor&apos;s degrees ({school.source}
  {school.last_verified ? ` · ${school.last_verified}` : ''})
</p>
```

Never render “#1” or “top ranked”.

- [ ] **Step 3: Print (counselor)**

In the counselor “How this list was built” section, if `catalogNote` is passed, render it as a `<p className="mt-2">`.

Student document: omit the machinery sentence.

- [ ] **Step 4: Rationale facts**

In `getRationales`, add to each school payload:

```js
program_names: s.program_names ?? null,
program_awards: s.program_awards ?? null,
```

Do not add extra prompt instructions that ask for a rank. Existing “use only the facts given” is enough.

- [ ] **Step 5: Wire props in `App.jsx`**

Pass `catalogNote={active.catalogNote}` into `ListStep` and both `FamilyDocument` usages.

- [ ] **Step 6: Commit**

```bash
git add src/lib/highlights.js src/components/ListStep.jsx src/components/FamilyDocument.jsx src/App.jsx src/lib/rationale.js
git commit -m "$(cat <<'EOF'
Show Scorecard program names and degree counts instead of a prestige rank.

EOF
)"
```

---

### Task 9: Docs and acceptance

**Files:**
- Modify: `CLAUDE.md` (Secrets: Scorecard is used at generate via `/api/scorecard.js`; snapshot is the fallback)
- Modify: `README.md` (remove “live API out of scope”; describe live + fallback + SAT gate)
- Modify: `agent_log.md`

**Interfaces:** none.

- [ ] **Step 1: Update `CLAUDE.md` Secrets**

Replace “API calls that need a key go through `/api/llm.js` only” with: extract/rationale through `/api/llm.js`; college catalog through `/api/scorecard.js`. The app must still produce a list with both keys missing (keyword extract + 40-school snapshot + SAT gate).

- [ ] **Step 2: Update `README.md`**

- How to run: Scorecard key is optional at runtime; restart Vite after changing it.
- Architecture: live Scorecard at generate; snapshot if no key.
- Known limitations: U.S. Title IV only; max 300 Scorecard rows; program-level admit rates do not exist; SAT 25th is reading+math when both exist.
- Delete or rewrite the row that says live API calls per list are out of scope.

- [ ] **Step 3: Browser acceptance** (required)

With `npm run dev`:

1. **No Scorecard key:** paste Student A, continue, build. List still appears. Banner says local snapshot.
2. **SAT 600 + design, with key:** new student, notes `SAT 600, interested in graphic design`. Confirm Design is Required. Build. **Harvard is not on the list.** Remaining schools should be design/art programs whose SAT 25th is not 200+ above 600. Banner says live Scorecard.
3. **SAT 1540 + design, with key:** highly selective design/art schools **may** appear as Reach/Target. Harvard only if Scorecard lists a bachelor’s CIP we mapped to design **and** 1540 is not 200+ below Harvard’s 25th.
4. Student A and Student B still produce a defensible list (live if key present).
5. Same notes twice → same list for the same catalog response.
6. Print counselor copy mentions the catalog source. Student copy does not grow a prestige rank.

If browser tools are unavailable, use curl against `/api/scorecard` plus `node scripts/verify-mismatch.mjs` and say what was not clicked in the UI.

- [ ] **Step 4: Log and commit**

Append `agent_log.md` in plain English: live Scorecard catalog, SAT 200-point gate, design CIP, snapshot fallback.

```bash
git add CLAUDE.md README.md agent_log.md
git commit -m "$(cat <<'EOF'
Document live Scorecard list-building and the SAT mismatch gate.

EOF
)"
```

---

## Self-review

**Spec coverage**

| Spec section | Task |
|---|---|
| Live Scorecard at generate | 5–7 |
| Snapshot fallback if no key / error | 6, 7, 9 |
| SAT ≤ p25 − 200 drop | 2 |
| Skip drop if SAT missing | 2 |
| Program cannot restore a dropped school | 2–3 (awards only on `surviving`) |
| Filter by required major CIP | 1, 5 |
| No required major → snapshot | 6 |
| Zero hits → error, not snapshot | 6–7 |
| 300-row cap / pagination | 5 |
| Normalize to engine shape | 4 |
| Overlay catalog courses via UNITID | 4 |
| Awards tercile ranking | 3 |
| Show awards fact, never prestige rank | 8 |
| Design slug | 1 |
| UI catalog banner | 8 |
| Rationale gets facts only | 8 |
| Docs / CLAUDE secrets | 9 |
| Student A/B + 600 SAT Harvard | 9 |

**Out of scope (intentionally no task):** US News ranks, non-U.S. colleges, program-specific admit rates, Scorecard at extract time, new npm deps, P1 features, `scripts/fetch-colleges.mjs`.
