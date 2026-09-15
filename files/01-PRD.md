# PRD — College List Builder (Demo Build)

**Status:** Build spec
**Scope:** One-hour prototype for the Nerd Apply technical round
**Relationship to the strategy PRD:** That document describes the product. This one describes
the slice we are building and, more importantly, the slice we are deliberately not building.

---

## 1. What this is

A counselor-facing web app. A counselor pastes a free-form paragraph about a student. The app
returns an editable, evidence-aware, affordability-conscious college list and prints it as a
document the student takes home.

## 2. What we are being graded on

The brief says: *"We are assessing every part of this from decisions made or rationale,
resource/time/effort allocation, and design."*

So the submission is judged on three things, in this order:

1. **Judgment** — did she scope a fuzzy problem well, and can she defend every tradeoff
2. **Allocation** — did the effort land where it mattered, and were the cuts deliberate
3. **Craft** — is the output something a real counselor would hand to a real family

The code needs to work and be readable. It does not need to be clever.

## 3. The user and the job

**User:** Independent educational consultant. Both buyer and user. Advises 10–50 students a year.

**Job:** "When I sit down with a student's file, I want to turn what I know about them into a
balanced, defensible list, so the student and family can act on it without me spending an
evening in a spreadsheet."

**Not the user:** the student. The student receives the printed document and nothing else.

## 4. Product rules (non-negotiable)

These four rules are the product. Everything else is implementation.

### 4.1 Admissions and affordability are two separate verdicts

Every school carries two independent labels that are never blended into one score.

- **Admissions context:** Likely / Target / Reach
- **Financial viability:** Likely Affordable / Needs Review / Unknown

A student can be a Likely admit at a school the family cannot pay for. Any tool that collapses
these into one "92% match" number fails the second example student in the brief, who has
middling scores and needs aid.

### 4.2 No percentages

The app never prints a number like "37% chance." It uses the three-band labels above, each
paired with an evidence strength: **Strong / Moderate / Limited**.

This is both an ethics position and a defensive one. You cannot be caught out on a wrong number
you never printed.

### 4.3 The counselor confirms before anything generates

Extracted criteria appear on their own screen, editable, before a single college is suggested.
Each extracted item shows a confidence level and the phrase from the notes it came from.

This one screen is what makes it a counselor tool rather than a chatbot.

### 4.4 Every fact carries provenance

Source and "last verified" date on every data point. Where data is missing, the app says so
out loud rather than quietly omitting the field.

### 4.5 The counselor sets the priorities, not the engine

A counselor ranks six dimensions before the list generates. That ranking drives the scoring
weights directly.

This exists because different students weight things differently in ways no model can infer —
one family will trade money for proximity, another the reverse — and because the weights in
`engine.js` are otherwise just the engineer's guesses about what matters. Handing that dial to
the counselor is the difference between a tool that assists expertise and one that overrides it.

It is also only possible *because* code does the deciding. If a model picked the schools, there
would be no weights to expose.

### 4.6 Two audiences, two documents

The counselor optimizes for fit. The student optimizes for desire. These are different jobs and
they need different documents, not the same document at two type sizes.

| | Counselor document | Student document |
|---|---|---|
| Job | Defend the decision | Make them want to go |
| Contains | Evidence, sample sizes, the comparison numbers, schools cut and why, balance warnings, counselor notes | Why you'd love it, what it costs, how far from home, what to do next |
| Omits | Nothing | The machinery |
| Tone | Clinical | Warm, second person |

Same component, a `variant` prop. The student document is the one that gets printed and handed
over. The counselor document is the counselor's own record.

---

## 5. Scope — five screens

### Screen 1: Notes
A single large text area. Two buttons that load the example students from the brief verbatim.
One "Build list" button.

### Screen 2: Criteria review — a table, not chips

Everything the AI understood, in one editable table. Columns:

| What I understood | From this phrase | Confidence | Importance | |
|---|---|---|---|---|
| Computer science | "loves programming" | High | Required ▾ | ✕ |
| Within ~300 miles of home | "aren't too far from home" | Medium | Preferred ▾ | ✕ |

A table because the counselor is auditing, and auditing wants rows. The source-phrase column is
the load-bearing one: a row with no source phrase is a row the model invented, and that becomes
visible at a glance rather than on hover.

An "Add a criterion" row at the bottom. Nothing generates until the counselor presses continue.

**Affordability block sits below, separately**, because the counselor is entering data here
rather than correcting it: approximate family income band, and maximum annual out-of-pocket.
Pre-filled from any narrative signal ("needs financial aid") and marked Low confidence.

### Screen 3: Priorities

Six dimensions the counselor drags into order for this student:

1. Affordability
2. Academic programme strength
3. Closeness to home
4. Admissions realism
5. Campus environment and fit
6. Student support services

Rank position drives the weight multiplier in the scoring engine. Default order is the one
above, so a counselor who doesn't care can press straight through.

One line of copy: *"Drag to reorder. This changes which schools rise to the top."*

This is also the strongest live-demo moment in the build — reorder two rows, regenerate, and the
list visibly changes. Keep it fast.

### Screen 4: The list
8–10 schools, each showing:
- Name, location, type, size
- Admissions band + evidence strength + the underlying comparison ("SAT 1230 vs middle 50%
  1180–1380")
- Affordability band + estimated net price at the stated income band + "last verified"
- **Travel burden** — "about a 6-hour drive" or "one direct flight, ~3h door to door"
- **Total annual cost** — tuition plus room, board, books and personal expenses, from Scorecard
- One sentence of "why it fits"
- The matched criteria as small chips
- Remove button, and an editable note field for the counselor's own reasoning

Above the list: a **balance panel** that flags problems. Below it: two print buttons.

### Screen 5: The two documents
Two print-optimised routes off the same component. Spec in the design doc.

- `/print/student` — the deliverable, handed to the student
- `/print/counselor` — the counselor's own record

---

## 6. Features by priority

### P0 — must work for the demo
- [ ] Free-form paste, plus both example prompts as one-click demos
- [ ] Extraction to structured criteria with confidence + source phrase
- [ ] Editable criteria **table** with Required/Preferred/Flexible
- [ ] Counselor-set income band and out-of-pocket ceiling
- [ ] **Priority ranking screen feeding the scoring weights**
- [ ] Deterministic scoring producing 8–10 schools
- [ ] Dual labels on every school with the comparison shown
- [ ] **Travel burden and total annual cost per school**
- [ ] Balance checks with plain-language warnings
- [ ] Remove a school; list rebalances and re-warns
- [ ] **Two documents — student and counselor — both printing cleanly**
- [ ] Works with the API key removed (degraded, and says so)

### P1 — if there's time, in this order
- [ ] **Application gap per school** — what the student has vs what the school requires
- [ ] Counselor note per school, printed in both documents
- [ ] **Student-life hook** — one counselor-editable line per school, pre-filled where tagged
- [ ] **Merit-aid signal** — share of students receiving non-need aid, and average amount
- [ ] "Why not these" — 3 schools considered and the reason they were cut
- [ ] Non-obvious institution surfacing, called out visually

### P1.5 — designed in the docs, built only if the hour allows
- [ ] **Comparable cases panel** — de-identified, "N students with a similar profile applied
      here." Stubbed with synthetic counts and labelled as the Nerd Apply integration point.
- [ ] **Campus safety** — counselor view only, never the student document. See non-goals.

### P2 — do not build, mention in the README
Versioning, audit trail, accounts, live data fetching, deadline tracking, net-price-calculator
completion tracking, dictation, document upload, multi-counselor collaboration, named
scholarships, alumni introductions.

---

## 7. Explicit non-goals, with reasons

Put these in the README. Naming your cuts is free credit on "resource/time/effort allocation."

| Not building | Why |
|---|---|
| Login and accounts | Adds no signal about product judgment. Costs 20 minutes. |
| A database | The session is the state. Persistence proves nothing here. |
| Live API calls per list | A cached snapshot is faster and can't fail on stage. The freshness cost is surfaced as a "last verified" date, which is a better answer than silent staleness. |
| Percentage chances | See rule 4.2. This is a position, not a shortcut. |
| A predictive admissions model | 60 schools of public data cannot support one honestly. |
| Essay tools, application tracking | Different product. The brief asked for a list. |
| Mobile layout | Counselors do this at a desk. Print layout matters more and is where the time went. |
| **Named scholarships** | No free structured source exists. Printing a scholarship name on a document a family acts on, when you can't verify it's still offered, is the exact harm the risk table names. Merit-aid *signal* from Scorecard is honest; a scholarship name is not. |
| **Alumni / LinkedIn introductions** | Four reasons, in order of seriousness: connecting a minor to strangers is a child-safety problem; the brief says use public and synthetic data; scraping LinkedIn breaks their terms of service; and identified student matching runs directly against Nerd Apply's privacy-first, de-identified positioning. The real need underneath — a student wanting reassurance from someone like them — is served by a **de-identified comparable-cases panel**, with the counselor making any human introduction. That is where their dataset plugs in. |
| **Campus safety in the student document** | The Clery Act data is free and real, so this is a values call rather than a feasibility one. Crime counts are badly confounded: better reporting culture looks worse than suppression, urban campuses look worse by where the boundary is drawn, and "is this area safe" maps onto neighbourhood demographics faster than anyone intends. A counselor has the context to read it. A worried parent at a kitchen table does not. Counselor view only, with the reporting caveat printed beside it. |
| **Verified club and activity lists** | No free structured dataset. The student-life field exists but is counselor-authored and stamped "verify with the school," because the alternative is letting the model invent extracurriculars, which breaks G9. |

---

## 8. Acceptance criteria

The build is done when both example students from the brief produce a defensible list.

**Student A — John Smith, PA, CS, 1230 SAT / 3.5 GPA, near home, practical and hands-on**

Must produce:
- A list weighted toward PA and neighbouring states
- Schools with co-op, ABET-accredited, or applied-CS signals
- At least two Likely admits and at least two Likely Affordable
- In-state publics appearing as affordable, correctly, because in-state net price is real data
- No Ivies labelled Likely on a 1230 SAT

**Student B — quiet, marine biology, middling scores, needs aid, somewhere warm**

Must produce:
- Warm-climate schools with actual marine science or marine biology programs
- At least one non-obvious institution: a regional public, an HBCU with marine science,
  or a community-college transfer pathway
- Affordability doing visible work: schools that meet a high share of need, or publics,
  ranked above expensive privates with the same admissions odds
- At least one **Unknown** affordability label, honestly shown, because the data will be
  patchy and hiding that would break rule 4.4

**System-level:**
- Same input twice produces the same list
- Removing a school triggers a fresh balance warning if the list falls out of balance
- The document prints to exactly two pages with no orphaned headings
- With `GEMINI_API_KEY` deleted, the app still produces a list and says the extraction was
  reduced to keyword matching

---

## 9. What "good" looks like in the walkthrough

Three sentences you should be able to say without hesitating:

1. "The model reads and writes. The code decides. That's why the list is reproducible and
   can't hallucinate a tuition figure."
2. "Admission plausibility isn't affordability plausibility, so I never collapsed them into
   one score."
3. "I cut versioning, accounts, and live data on purpose, and here's the hour I spent instead."

One framing note. The strategy PRD has a section called "What Nerd Apply Is Still Missing."
That analysis is right, but do not lead with it. Frame this as the orchestration layer that
sits on top of their outcomes data and turns it into something a family can hold. You are not
competing with the dataset. You are the thing that consumes it.
