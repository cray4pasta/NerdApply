# College List Builder

A counselor pastes notes about one student. The app returns an editable, evidence-aware college list and two print documents — one the student takes home, one the counselor keeps. Nothing is stored.

## How to run

```bash
npm install
cp .env.example .env.local   # optional. Put keys in .env.local only — never in .env.example.
npm run dev
```

Open the URL Vite prints. `npm run dev` now serves `/api/llm` locally so a Gemini key in `.env.local` is used. Restart Vite after changing keys. Without a Gemini key the app still works: extraction falls back to keyword matching and says so on the criteria screen.

`SCORECARD_API_KEY` is optional and is used when a list is generated. Restart Vite after adding or changing it. With the key, the app requests a live College Scorecard catalog for a required program. Without the key, it builds from the 40-school snapshot in `src/data/colleges.json`.

## Architecture decisions

**The model reads and writes. The code decides.** Gemini (when a key exists) turns notes into a form and turns engine facts into one sentence. `src/lib/engine.js` picks every school, band, and number. Same notes produce the same list.

**Admissions and affordability are never one score.** Every school carries Likely / Target / Reach and, separately, Likely Affordable / Needs Review / Unknown. No admission percentages.

**Live catalog with a visible fallback.** At generate time, a required program triggers a College Scorecard lookup through `/api/scorecard.js`. If no Scorecard key is configured or the live service is unavailable, the app uses the local 40-school snapshot. The list identifies which source it used.

**The SAT mismatch gate runs before ranking.** A school is excluded when the student's SAT is at least 200 points below its reported SAT 25th percentile. For Scorecard data, that percentile is reading plus math when both component values exist. Missing student or school SAT data does not trigger the exclusion.

**The counselor confirms first.** Extracted criteria appear in a table, with the source phrase, before any list is generated. Ranked priorities set the scoring weights.

## What I deliberately did not build

| Not building | Why |
|---|---|
| Login and accounts | Adds no signal about product judgment. |
| A database | The session is the state. Nothing is written to disk. |
| Percentage chances | Sixty schools of public data cannot support an honest one. |
| Named scholarships | No free structured source. Printing an unverified name is the harm the risk table names. |
| Alumni / LinkedIn introductions | Connects a minor to strangers; conflicts with de-identified outcomes. |
| Campus safety on the student document | Crime counts are confounded. Counselor view only, and not in this build. |
| Application gap, student-life hook, merit-aid | P1. The printed student document is the deliverable. |

## Known limitations

- Distance is estimated from a **state centroid**, so Philadelphia and Pittsburgh look the same. First fix: a ZIP code field.
- Live results cover U.S. Title IV institutions only and are capped at 300 Scorecard rows.
- College Scorecard does not provide program-level admission rates. Admissions evidence remains institution-level.
- When live lookup is unavailable, the seed set is about **40 schools**, biased for the two brief students, not a national catalog.
- In the local snapshot, test-optional SAT percentiles can skew upward from self-reporting, so those schools cap at Moderate evidence. Live Scorecard rows currently default to `test_optional: false`, so live evidence is not capped without a separate test-policy source.
- Scorecard public net price is **in-state**. Out-of-state publics are forced to Needs Review.
- Without `GEMINI_API_KEY`, extraction is keyword matching and is labelled as such.

## What I would build next

1. ZIP-code distance instead of state centroids
2. Broader program mappings and stronger live-catalog observability
3. A counselor override log — every removal or rank change is a labelled example of where the engine was wrong
4. Then a FERPA-compliant retention model, which this demo correctly refuses to fake
