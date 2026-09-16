A counselor types a free-form description of a student and gets a printable college list.

## How to run

**https://nerdapply-xi.vercel.app**

```bash
git clone https://github.com/cray4pasta/NerdApply.git
cd NerdApply
npm install
npm run dev
```

For live extraction and rationale, put `GEMINI_API_KEY` in `.env.local`. The app runs without it.

## How it works

Free-form notes become a structured student profile through one LLM call, which the counselor can edit. Deterministic code then scores that profile against the college dataset and assigns every school and band. A second LLM call writes a one-sentence fit rationale from those facts only. A print stylesheet turns the reviewed list into a PDF.

## Key decisions

**Facts stay deterministic.** The model parses notes and writes prose. `engine.js` picks every school, band, and number, so a printed list cannot contain an invented school or admit rate.

**The catalog is synthetic.** The brief explicitly allows public and synthetic data; this build uses a synthetic set so the demo cannot fail on a live API. Production replaces that file with College Scorecard / IPEDS — and later the counselor’s own outcomes — behind the same adapter.

**Likely / Target / Reach, not a percentage.** A printed odds number to a 17-year-old is the wrong artifact. Bands plus evidence strength are something a counselor can defend; a fake precision number is not.

**The counselor is the gate.** Extracted criteria are reviewed and edited before any list is generated, and schools can be removed before print. No counselor hands a family an unreviewed AI list.

**Print stylesheet, not a PDF library.** The family document is HTML; Chrome’s print dialog produces a tagged PDF from the DOM. A library would have added a dependency and emitted a flat, unreadable file.

## What I’d do next

- Swap the synthetic catalog for real institutional data (College Scorecard / IPEDS) so every printed figure is a verified one.
- Score against the counselor’s own de-identified historical outcomes, not generic national stats — that is the Nerd Apply dataset, and it is how a list becomes this counselor’s list.
- Replace state-centroid distance with ZIP so two cities in the same state stop looking the same.
- Log every counselor override. A removal is a labelled example of where the engine was wrong, which is how the outcome model gets trained.

## Known limitations

- College figures are synthetic, and labelled that way.
- No authentication.
- One student file in the working view.
- No server-side persistence. Nothing is stored off the machine.
