# Task 9 report: Docs and acceptance

**Status:** Passed
**Branch:** `feat/live-scorecard-catalog`
**Date:** 2026-09-15

## Commits

- `cb1fa11` — Document live Scorecard list-building and the SAT mismatch gate.
- `ac8a5cb` — Add remaining demo screens so the Scorecard list flow can run.

## Acceptance commands and outputs

### Production build

Command:

```text
npm run build
```

Output:

```text
npm warn Unknown env config "devdir". This will stop working in the next major version of npm.

> college-list-builder@0.1.0 build
> vite build

vite v5.4.21 building for production...
transforming...
✓ 1911 modules transformed.
[plugin:vite:reporter]
(!) src/lib/colleges.js is dynamically imported by src/lib/catalog.js but also statically imported by src/App.jsx; the dynamic import will not move the module into another chunk.
rendering chunks...
computing gzip size...
dist/index.html                   0.68 kB │ gzip:  0.38 kB
dist/assets/index-Bvc0r1_w.css   15.98 kB │ gzip:  4.25 kB
dist/assets/index-D94fMDIM.js   269.07 kB │ gzip: 81.27 kB
✓ built in 1.79s
```

Exit code: `0`

### SAT mismatch verification

Command:

```text
node scripts/verify-mismatch.mjs
```

Output:

```text
verify-mismatch ok
```

Exit code: `0`

### Design CIP verification

Command:

```text
node scripts/verify-cip.mjs
```

Output:

```text
verify-cip ok
```

Exit code: `0`

### Live Scorecard and SAT 600 verification

A Scorecard key was present in the environment or local environment file. Its value was never printed.

Command:

```text
node --input-type=module <<'EOF'
import assert from 'node:assert/strict'
import { loadEnv } from 'vite'
import scorecardHandler from './api/scorecard.js'
import { buildList } from './src/lib/engine.js'

const env = loadEnv('development', process.cwd(), '')
assert.ok(env.SCORECARD_API_KEY, 'Scorecard key is unavailable')
process.env.SCORECARD_API_KEY = env.SCORECARD_API_KEY

const response = await new Promise((resolve) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(body) { resolve({ status: this.statusCode, body }) },
  }
  scorecardHandler({ method: 'POST', body: { programs: ['design'] } }, res)
})
assert.equal(response.status, 200, `Scorecard handler returned ${response.status}`)
assert.ok(Array.isArray(response.body.schools) && response.body.schools.length > 0, 'Live catalog returned no schools')

const list = buildList({
  schools: response.body.schools,
  criteria: [{ id: 'design', category: 'academic_interest', value: 'design', strength: 'required' }],
  income_band: '75001-110000',
  max_out_of_pocket: 100000,
  home_state: 'PA',
  academic: { sat: 600, gpa: 3.0 },
  priorityOrder: ['program', 'affordability', 'admissions_realism', 'proximity', 'environment', 'support'],
})
assert.ok(list.length > 0, 'SAT 600 live design list was empty')
assert.equal(list.some((school) => /Harvard/i.test(school.name)), false, 'Harvard appeared in SAT 600 list')
console.log(`live catalog schools: ${response.body.schools.length}`)
console.log(`SAT 600 design list: ${list.length}`)
console.log(`sample schools: ${list.slice(0, 5).map((school) => school.name).join('; ')}`)
console.log('Harvard present: false')
EOF
```

Output:

```text
[api/scorecard] sorted request failed; retrying without sort { page: 0, status: 400 }
[api/scorecard] sorted request failed; retrying without sort { page: 1, status: 400 }
[api/scorecard] sorted request failed; retrying without sort { page: 2, status: 400 }
live catalog schools: 300
SAT 600 design list: 5
sample schools: Art Center College of Design; Ringling College of Art and Design; Bradley University; College for Creative Studies; Maryville University of Saint Louis
Harvard present: false
```

Exit code: `0`

The live request reached the 300-school cap. The configured sort was rejected by Scorecard, and the route's documented unsorted retry succeeded on all three pages.

## Exclusions

The `Geist copy/` folder, `.env`, `.env.local`, and all key values were excluded from commits and this report.

## Stuck-generate race fix (2026-09-15)

Browser SAT 600 design test showed snapshot community colleges (e.g. “Design is not in this snapshot”) because the 5s generating-phase recover timeout fired before live Scorecard finished (~12s) plus `holdForSteps` (~2.8s). Harvard was still absent from the list. This commit delays snapshot recover to `SCORECARD_MS + STEP_MS * BUILD_STEPS.length + 3000` (17.8s) so live catalog wins when Scorecard succeeds; snapshot recover remains last resort with the same `console.warn('[app] generate recover used local snapshot')` log.

## Fix: whole-branch review pass (2026-09-15)

- Missing enrollment is now shown as unknown and no longer counts as a small school in print, list highlights, rationale text, or environment scoring.
- The extraction prompt now keeps design separate from art, matching the existing keyword fallback.
- A rejected Scorecard sort is attempted only once per request; every later page and per-CIP fallback stays unsorted.
- Stuck-generation snapshot recovery now replaces any prior live catalog source and note.
- Five existing art schools in the snapshot now also carry a short design program label; no course lists were added.
- Attendance cost totals remain unknown when any required component is missing.
- README now limits the test-optional Moderate-evidence statement to the snapshot and states the live default.

Verification:

```text
verify-cip ok
verify-mismatch ok
verify-scorecard-map ok
verify-catalog-reasons ok
verify-scorecard-handler ok
```
