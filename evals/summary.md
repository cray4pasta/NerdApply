# Eval summary — Gemini counselor cases

**Date:** 16 Sep 2026
**What we ran:** Gemini wrote 10 synthetic student notes. The prototype built a list for each. Gemini scored whether a counselor would start from that list.

**Headline:** 0 of 10 passed. That number is too harsh if you treat the school names as real College Scorecard rows. It is still a fair warning: on these notes, the tool produced the same kind of list over and over, and a counselor would not trust it as a first draft.

## What this eval actually measured

The lists did **not** come from live federal data. They came from the overlay catalog:

- School **names** are real (Temple, Cornell, West Chester).
- **Programs, SAT bands, admit rates, and net prices are invented** for the prompt. Every school is stamped with the student’s major. SAT and cost are tuned so the list can always fill Likely / Target / Reach.
- When home state is missing, the pool starts in **Pennsylvania**.
- Gemini extract was rate-limited, so this run used **keyword extraction**, the same fallback the app uses when the key is missing.

The judge did not stay inside that world. It scored “Cornell” as the real Cornell (nursing, 2.7 GPA, Boston) instead of the invented row on the sheet. Several “this school does not offer that major” and “this admit rate is dishonest” comments are about the real campus, not the synthetic record.

So: **do not treat 0/10 as a Scorecard accuracy score.** Treat it as a first-draft usefulness score against a counselor’s real-world knowledge of those names — which is still how a counselor will read the screen in a demo.

## What still holds, even knowing the data is fake

These problems show up in the notes and the engine, not in Wikipedia.

1. **Same cast of names.** Temple, West Chester, and Millersville open almost every list. Cornell, CMU, and NYU fill the top. That is the PA default plus a fixed name pool, not ten different students.
2. **Home state is guessed from the wrong word.** Liam lives in Chicago; “California” in the mother’s wish list became home state CA. Chloe wanted the East Coast; no state was set, so the pool drifted to PA and the Midwest.
3. **Aid language is too narrow.** Maya’s $0 EFC and “cannot take loans” never set `aid_needed`. The list then used the default income band and a $25k cap, and labeled $16k–$23k “Likely Affordable.” On invented numbers that label is internally consistent. For a counselor it is still the wrong story.
4. **Constraints that are not majors get dropped.** Boston-only, 3-hour drive from Chicago, no hyper-selectives, narrative homeschool transcripts, easy major-switching — none of those changed the mix. The overlay still returned ~3 Likely / 4 Target / 3 Reach.
5. **An empty or honest “cannot fill this” would be better than ten invented rows.** Noah asked for direct-entry nursing in downtown Boston under $15k with a 2.7 GPA. A synthetic catalog can always mint 10 schools. A counselor would rather see “this combination does not yield a defensible list” than Cornell-with-fake-stats.

Extraction was the strongest part (about 3/5). Usefulness was the weakest (1.1/5). The tool often read GPA and SAT and still built a list that ignored the sentence that actually mattered.

## What the judge got wrong because the data is synthetic

- “Temple / West Chester do not offer agriculture or nursing” — in this catalog they do, because every row is stamped with the extracted majors.
- “UCLA at 17% should not be a Target” — on the sheet, 17% plus a strong GPA is exactly how `engine.js` assigns Target. The 17% was invented to match a Target-tier name, not pulled from UCLA.
- “Cornell is impossible for a 980 SAT” — the overlay also invented Cornell’s SAT band around that student, so the engine’s SAT gate often lets the name through.

Those critiques are still useful as **demo risk**: if you put a famous name on the page, people will judge the real school, not your invented row.

## Suggested improvements

### Say the catalog is fake, on the list itself

One line under the table: these names are recognizable stand-ins; programs and numbers are plausible, not verified. That is already in the school record. It is not visible enough on the counselor screen. A demo that looks like Scorecard but is not Scorecard will get torn apart the way this eval did.

### Stop using famous names with invented stats — or stop inventing stats for famous names

Pick one:

- **A.** Keep real names, keep real-ish shape (high-select names stay Reach, net price is not generated from the family’s cap). The list may go empty. That is honest.
- **B.** Use clearly fictional campus names so nobody scores them as Cornell.

The current middle path — real names, SAT and cost bent to the student, every major on every campus — is what made the judge (and would make a live interviewer) feel lied to.

### Default geography to “unknown,” not Pennsylvania

If the notes do not name a home state, do not start the pool in PA. Show the unresolved row and draw from a mixed national set. That single change would stop Temple / West Chester / Millersville from starring in eight of ten edge cases.

### Teach extraction the sentences counselors actually write

- Two geographies in conflict → two rows plus an unresolved flag, not one winner. Chicago vs California should not silently become CA.
- `$0`, `EFC`, `cannot take loans`, `meet full need` → `aid_needed`, and a lower cap, same as “needs financial aid.”
- `anxious about reaches` / `refuses hyper-selective` → fewer Reach slots, not the default 3/4/3.
- Niche majors the catalog does not have (game design, architecture) → unresolved “not in this directory,” not a quiet remap to art.

### Prefer a short honest list over a full fake one

If Boston + nursing + $15k + 2.7 GPA cannot be filled from the pool, return what you have and a balance warning. Do not mint ten campuses so the table looks complete. The print path already asks for confirmation when nothing is Likely Affordable; overconstrained searches need the same kind of stop.

### Change how we judge next time

The next Gemini judge should be told, in the packet:

- Every admit rate, SAT band, net price, and program list on the sheet is **invented for this prompt**.
- Score fit against **those facts**, not against the real university.
- Separately flag **name collision risk**: would a counselor misread this as the real campus?

Add mechanical checks that do not need a model: home state vs notes, `aid_needed` vs aid language, program slugs vs notes, name overlap across the 10 lists, and “did the list change when geography or risk-tolerance changed.” Those would have caught the PA template without arguing about whether real Cornell offers nursing.

## Bottom line

The prototype did what it is built to do: invent a plausible catalog, stamp the major on, fill a balanced table. Against synthetic data, the engine’s math is often consistent. Against a counselor’s eyes, the lists are not useful, because the names repeat, the hard sentence in the notes is ignored, and famous campuses carry invented numbers.

Fix visibility (say it is synthetic), geography (no PA default), aid and conflict extraction, and the “always return 8–10” habit. Then rerun the eval with a judge that is not allowed to use real-world school knowledge — and a second pass that *is* allowed to, so you can see demo risk separately from engine correctness.
