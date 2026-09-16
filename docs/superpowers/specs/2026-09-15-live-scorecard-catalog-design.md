# Live Scorecard catalog — design spec

**Date:** 2026-09-15
**Status:** Ready for review
**Product:** College List Builder (Nerd Apply demo)

## 1. Goal

When a counselor builds a list, the 8–10 schools should come from **U.S. colleges in the federal College Scorecard** that match the confirmed criteria — not only the 40 names in `src/data/colleges.json`.

The list must still **assess the student’s profile**. A 600 SAT student interested in design must not see Harvard because Harvard has a design program. Profile fit is a gate. Program fit is ranking among schools that already passed that gate.

The model still does not pick schools, assign bands, or invent numbers.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Catalog | Live College Scorecard at list-build time |
| Fallback | Today’s 40-school file if the key or API is missing |
| “Ranking” | Strength of the **major at that school** (bachelor’s degrees awarded in that field), not US News |
| Courses | Official Scorecard program name always; named catalog courses only when we already have a real source |
| Academic mismatch | **Drop** the school if student SAT is **200 or more points below** that school’s SAT 25th percentile |
| Search shape | Filter Scorecard by required major (CIP codes), then run the existing engine |

## 3. What does not change

- Notes → criteria table → counselor edits → priority ranking → generate.
- Admissions and affordability stay separate labels (Likely / Target / Reach vs Likely Affordable / Needs Review / Unknown).
- No percentage chance of admission.
- No AI-chosen schools. `/api/llm` extract and rationale stay as they are.
- Print documents, caseload, and session-only state stay as they are.

## 4. End-to-end flow

1. Counselor pastes notes and confirms the criteria table (including SAT/GPA, required major, geography, income).
2. Counselor ranks the six dimensions and builds the list.
3. The app POSTs confirmed criteria to **`/api/scorecard`** (server only; key never in the browser).
4. The route maps each **required** academic interest to CIP codes, asks Scorecard for 4-year U.S. colleges that award that program, and returns a list of school records in the shape `engine.js` already uses.
5. `buildList` applies hard filters (including the new SAT mismatch drop), bands, fit scores, and 8–10 selection.
6. If `/api/scorecard` returns an error or 503, `generateList` uses `getColleges()` from the snapshot file, applies the **same** mismatch rule, and tells the counselor the catalog is the local snapshot.

Live fetch happens at **generate**, not at extract. The criteria screen does not wait on Scorecard.

## 5. Student profile gate (hard filter)

Add a hard filter in `engine.js` (with the other 7.1 rules):

**If the student has an SAT and the school has `sat_p25`, and `studentSAT <= sat_p25 - 200`, exclude the school.**

Worked example:

- Student SAT 600, interested in design.
- Harvard SAT 25th percentile is well above 800 (typically ~1460+).
- 600 is more than 200 points below → Harvard is **not** on the list, not even as a Reach.

A Reach is still allowed when the student is in range or only somewhat below it (less than 200 points below the 25th percentile). Those schools then get Likely / Target / Reach from today’s admit-rate + SAT-position rules.

### 5.1 When SAT is missing

Do **not** invent a program-level acceptance rate (Scorecard does not publish “Harvard undergrad design admit rate”).

- If student SAT or school `sat_p25` is missing, skip this 200-point drop.
- Continue to use today’s GPA-only academic strength (coarse, limited evidence) and overall admit rate for the band.
- The UI already shows limited evidence in that case.

### 5.2 Program cannot override the gate

“Awards degrees in design” must not restore a school the SAT gate dropped. Completions / program strength are computed only on schools that survived hard filters.

## 6. Live Scorecard query

New serverless route: `api/scorecard.js`, same pattern as `api/llm.js` (POST, key from env, timeout, JSON).

**Auth:** `SCORECARD_API_KEY` from `.env.local`. If missing, respond `503 { error: "no_key" }`.

**Request body (from the confirmed form, not raw notes):**

- required program slugs
- optional home state (for later travel scoring; not required to query)
- income band (so net-price fields can be attached)

**Query rules:**

- 4-year / bachelor’s-predominant U.S. institutions only.
- Filter `latest.programs.cip_4_digit.code` to the CIP list for required majors.
- Credential level = bachelor’s (Scorecard credential level 3).
- Fields include: unit id, name, city, state, lat/lon, ownership, locale, size, HBCU flag, admission rate, SAT 25/75, net price by income, cost of attendance, 6-year completion, matching CIP title, CIP code, awards/completions in that CIP, school URL, data year if available.
- `per_page=100`. Paginate up to **3 pages (300 schools)** or until Scorecard reports no further results, whichever is first. This cap exists so the Vercel function finishes in time.
- Prefer sorting by awards in that CIP if that field is indexed. If it is not, fetch pages in API default order and let `engine.js` rank. Confirm field names against the current Scorecard data dictionary before shipping; do not guess paths.

**No required major:** do not download the national catalog. Use the 40-school snapshot and keep the existing unresolved warning on the criteria screen.

**Multiple required majors:** union the CIP codes into one query where the API allows it; otherwise one request per slug and merge by school id.

**Normalize** each hit into the existing college record shape (`id`, `name`, `admit_rate`, `sat_p25`, `sat_p75`, `net_price`, `programs`, `tags`, `source`, `last_verified`, …) so `buildList` does not grow a second data model.

- `programs` = slugs we queried that this school actually matched (e.g. `design`).
- `program_names[slug]` = Scorecard CIP title (real source).
- `program_awards[slug]` = completions/awards count (number from Scorecard, or omit if null).
- `source` = `College Scorecard (live)` and `last_verified` = today or the Scorecard data vintage if returned.
- Overlay `program-tags.json` **by unit id or current snapshot id** when present, so named catalog courses still appear for the 40 hand-tagged schools.

Local Vite must proxy `/api/scorecard` the same way it proxies `/api/llm`.

## 7. Program strength (the “ranking”)

Not a prestige rank. Not a printed league-table number.

Among schools that passed hard filters, add program-dimension points from **awards in the student’s required field**, relative to the fetched set (for example more points in the top third of completions, fewer in the bottom third). Missing completions → no extra program-strength points; the school can still remain if it matched the CIP filter.

**On the list and print document, show a fact, not a rank:**
“Awarded *N* bachelor’s degrees in Design and Applied Arts (College Scorecard, vintage).”

Never label a school “#1 design program.”

## 8. Relevant courses

| What | Source | When shown |
|---|---|---|
| Program title | Scorecard CIP title | Always, for live rows |
| Degree count in that field | Scorecard completions | When not null |
| Named courses (e.g. “Criminal Law”) | `program-tags.json` catalog copy | Only if that school id is tagged |
| Anything else | — | Never. No model-generated courses |

`highlights.js` already follows this pattern. Live schools without tags show program title and empty course list — not “missing from snapshot” unless we are on the fallback file and the slug was never tagged.

## 9. Design vs art (student example)

Add a `design` program choice (keyword: design, graphic design, industrial design, UX, visual design).

Map slugs to 4-digit CIP codes at implementation time against the dictionary. Starting point (must be verified):

| Slug | Intended CIP (4-digit, no decimal) |
|---|---|
| design | 5004 (Design and Applied Arts) |
| art | 5007 / 5001 (Fine Arts / Visual Arts) |
| computer_science | 1107 |
| nursing | 5138 |
| engineering | 1401, 1408, 1409, 1410, 1419 (general, civil, EE, ME, mechanical-related — verify against dictionary; include extra 14xx codes only if the first query is too thin) |
| biology | 2601 |
| marine_biology | 2613 |
| business | 5202 / 5201 |
| education | 1301 |
| environmental_science | 0301 |
| agriculture | 0100 |
| law | 2200 and/or 4504 (undergraduate legal / criminal justice — not a JD) |

A note that only says “design” must not be treated as a generic prestige search.

## 10. Engine selection (unchanged intent)

After filters and scoring, keep 2–3 Likely, 3–4 Target, 2–3 Reach, 8–10 total, never silently pad. Affordability swap rule stays.

Because far-mismatch Reaches are gone, the Reach band should be schools the student is actually near, not lottery tickets.

## 11. UI copy

When live data is used, one line above the list: the catalog is College Scorecard (live), with vintage/date.

When fallback is used: keyword-style honesty — “College data is the local snapshot. Scorecard was unavailable.” Same pattern as degraded extraction.

Do not show a numbered prestige rank column.

## 12. Failure handling

| Case | Behavior |
|---|---|
| No `SCORECARD_API_KEY` | 503 → snapshot, visible banner |
| Scorecard 4xx/5xx or timeout (8s, same order as Gemini) | snapshot, log the error, visible banner |
| Malformed payload | 400, do not generate a partial invented list |
| Zero Scorecard hits for the CIP | Do not invent schools. Show a plain error: no matching programs in Scorecard for this major; counselor can loosen Required or use snapshot |
| Snapshot fallback | Identical SAT 200-point gate |

Do not swallow errors in empty `try/catch`.

## 13. Guardrails this feature must not break

- G3: never Likely if admit rate &lt; 20%.
- G4: no affordability label from sticker price.
- G5: no blended match score on the document.
- G9: rationale call still receives only engine facts (including awards count and program title).
- G11: no invented campus-life or courses.

## 14. Out of scope

- US News or any copyrighted league-table rank.
- Non-U.S. universities.
- Program-specific admission rates.
- Live Scorecard at extraction time.
- Downloading every U.S. college when no major is required.
- New npm dependencies, TypeScript, a database, or persistence.
- P1 features (application gap, merit-aid panel, why-not-these, etc.).

## 15. Acceptance checks

- Notes: “SAT 600, interested in design.” After confirm + build with live Scorecard: **Harvard is not on the list.** Schools that remain should be design/art programs whose SAT 25th percentile is not 200+ above 600.
- Notes: high SAT (e.g. 1540) + design: highly selective design/art programs **may** appear as Reach/Target per existing band rules.
- Same confirmed form twice with the same live Scorecard response → same list.
- With `SCORECARD_API_KEY` removed: list still builds from the 40-school file, SAT gate still applies, banner shown.
- Student A (CS, 1230, near home) and Student B (marine biology, aid, warm) still produce a defensible list; prefer live hits when the key is present, snapshot otherwise.
- No rationale sentence invents a course or a prestige rank.

## 16. Files likely to change (implementation, not this spec)

- `api/scorecard.js` (new)
- `vite.config.js` (proxy)
- `.env.example` (comment that the Scorecard key is now used at generate time)
- `src/lib/colleges.js` or new `src/lib/scorecard.js` (fetch + normalize)
- `src/lib/engine.js` (200-point gate + program-awards points)
- `src/lib/extract.js` (design slug)
- `src/App.jsx` (generateList calls live catalog)
- `src/components/ListStep.jsx` / highlights (program title + awards)
- `CLAUDE.md` / `README.md` (runtime Scorecard key; snapshot is fallback)

No change to the “model reads and writes, code decides” split.
