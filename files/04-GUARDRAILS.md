# Guardrails

Three kinds. Product guardrails stop the software giving harmful advice. Build guardrails stop
the hour disappearing. Demo guardrails stop the walkthrough going sideways.

---

## Part 1 — Product guardrails

These are rules the code enforces, not intentions you hold. A guardrail you have to remember is
not a guardrail.

### 1.1 The hard rules

| # | Rule | Enforced where |
|---|---|---|
| G1 | Never output a percentage chance of admission | Rationale prompt ban list + regex check on output |
| G2 | Never use the word "safety" for a school | Same. Use "Likely." |
| G3 | Never label a school Likely when admit rate < 20% | `engine.js`, hard branch |
| G4 | Never derive an affordability label from sticker price | `engine.js` — missing net price returns `Unknown` |
| G5 | Never blend admissions and affordability into one score | No field in the data model can hold one |
| G6 | Never print a cost figure without its income band, source, and verified date | Document template requires all four or omits the row |
| G7 | Never send a list to print with zero Likely Affordable schools without an explicit counselor confirmation | Print button opens a confirm dialog in that state |
| G8 | Never infer race, religion, disability, immigration status, or sexuality from the notes | Extraction prompt, explicit ban |
| G9 | The AI never produces a fact, only a sentence about facts it was given | Architecture — rationale call receives the finished list only |
| G10 | Never print an application or aid deadline | We have no verified deadline data. See below. |
| G11 | Never let the model generate a club, organisation, or campus-life fact | `student_life` is counselor-authored only; the rationale prompt receives it as input and may not add to it |
| G12 | Never print a named scholarship | No verifiable source. Merit-aid *signal* from Scorecard is allowed; a scholarship name is not. |
| G13 | Never surface identified information about any other student | Architecture. No such data enters the system. |
| G14 | Never print campus safety data on the student document | Document template — the `safety` block renders only when `variant === 'counselor'` |
| G15 | Never print a counselor-authored line without its "counselor-added" mark | Document template requires the provenance mark on any field whose source is not federal data |

### 1.2 Make them executable

A twenty-line file worth building, because it turns the rules from a claim into a demonstration:

```js
// src/lib/guardrails.js
const BANNED = /\b(safety school|guaranteed|\d{1,3}\s?% chance|you will get in)\b/i

export function assertList(list) {
  if (import.meta.env.PROD) return
  for (const s of list) {
    if (s.admissions === 'Likely' && s.admit_rate < 0.20)
      throw new Error(`G3 violated: ${s.name} labelled Likely at ${s.admit_rate} admit rate`)
    if (s.affordability !== 'Unknown' && s.net_price == null)
      throw new Error(`G4 violated: ${s.name} has an affordability label with no net price`)
    if (BANNED.test(s.rationale ?? ''))
      throw new Error(`G1/G2 violated in rationale for ${s.name}`)
    if ('match_score' in s)
      throw new Error('G5 violated: a blended score reached the list')
  }
}
```

Call it once, right before rendering the list. It costs nothing and it means that when someone
asks "how do you know the model won't say 'safety school'," the answer is a file rather than a
hope.

### 1.3 The deadlines cut, explained

Your strategy PRD asks for application and aid deadlines in the family document. **Cut it, and
say why.**

Scorecard has no deadline data. Getting it means scraping sixty admissions sites, which is
outside the hour and would produce a mix of current and stale dates with no way to tell them
apart. Printing an unverified deadline on a document a student acts on is exactly the harm your
own risk table warns about.

Instead the document says: *"Application and aid deadlines vary by school and change year to
year. Confirm each one on the college's own admissions page before you apply."*

Naming a cut and giving the reason is a stronger answer than shipping the feature badly. This
is the cut I'd lead with if they ask what you left out.

### 1.3b The identified-matching cut, explained

The idea: match a student to real people who got into a school — LinkedIn profiles, alumni — so
they can talk to someone and feel reassured.

**Do not build this.** Four reasons, in order of seriousness:

1. It would connect a minor to strangers on the internet. That is a child-safety problem before
   it is a product problem, and no amount of consent flow fixes it inside a demo.
2. The brief says to use public and synthetic data, not real people.
3. Scraping LinkedIn breaks their terms of service and is a technical dead end anyway.
4. It runs directly against Nerd Apply's positioning. Their entire thesis is privacy-first,
   de-identified outcomes. Proposing identified student matching to them would be a bad read of
   the room.

The need underneath is real and worth serving. A student wants reassurance from someone like
them. The correct form is **de-identified**: *"Three students with a profile similar to yours
applied here in the last three years."* That is precisely Nerd Apply's dataset, which makes this
an integration point rather than a feature you build.

Any human introduction is made by the counselor, not the software. A tool does not introduce
minors to strangers; a professional who knows both people does.

Stub the panel with synthetic counts, label it clearly as the integration point, and explain the
reasoning. The cut is a better answer than the feature. It shows you can tell the difference
between a real need and a dangerous implementation of it, which is most of what product judgment
actually is.

### 1.4 Data handling

- Synthetic students only. Both demo prompts come from the brief. If you write a third, invent
  it. Nothing about a real student goes near this.
- No persistence. Nothing is written to disk or to a server. Notes live in React state and
  vanish on refresh. For a demo this is the correct privacy posture and it's one sentence in
  the README: *"Nothing is stored. A real deployment would need a FERPA-compliant retention
  model, which is out of scope here."*
- Names in the document come from the notes and are printed only in the title block.

### 1.5 Honest degradation

Every failure mode in this app must fail *loudly*, never silently.

| Failure | Behaviour |
|---|---|
| AI extraction unavailable | Keyword fallback runs, banner says so, all criteria marked low confidence |
| Rationale call fails | Template sentence from matched criteria, no banner needed |
| Net price missing | `Unknown`, dashed treatment, never a guess |
| Program tag missing | School still listed, but flagged "program availability unverified" |
| Fewer than 2 affordable schools | List still generated, balance panel states the problem plainly |

The list is never silently shortened, silently padded, or silently guessed at. A tool that hides
its gaps is worse than one that has them.

---

## Part 2 — Build guardrails

The hour is the scarcest resource. These protect it.

### 2.1 Order of operations

Build the engine against fake criteria before you connect the AI. If the AI goes in first, every
engine bug looks like an AI bug and you will lose twenty minutes to the wrong problem.

### 2.2 Commit at every working state

After each of the seven steps in the engineering doc, commit. Something will break at minute
forty-five and you want a working state to fall back to rather than a debugging session.

### 2.3 Rules for Cursor

Paste these into your Cursor rules or the top of your prompt:

- Do not refactor files I did not ask you to change
- **Never use raw colour, size, spacing, or radius values. Use tokens from `tokens.css` and the
  Tailwind theme only. No arbitrary values (`text-[#333]`, `p-[13px]`). If a token doesn't exist
  for what I need, tell me and propose adding one — do not inline it.**
- Do not add dependencies without telling me what and why
- Do not add `try/catch` that swallows an error silently — log it
- Do not invent College Scorecard field names, check the documentation
- Keep each file under 300 lines; prefer a few large files over many small ones
- Do not add TypeScript, tests, a state library, or a router unless I ask
- When you change scoring logic, tell me which rule number in the engineering doc it maps to

That last one keeps the code and the docs in sync, which matters when you're walking someone
through both.

### 2.4 Things that will eat the hour if you let them

| Trap | Signal you're in it | Escape |
|---|---|---|
| Perfecting the seed dataset | Still tagging schools at minute 25 | 60 rough rows beats 200 perfect ones. Move on. |
| Fighting `vercel dev` | Nothing on `/api` works | Hardcode the extraction output temporarily and come back |
| Chasing exact page breaks | Reprinting for the fifth time | Two clean pages of eight schools is fine. Ship it. |
| Tailwind config rabbit hole | Still editing `tailwind.config.js` at minute 20 | Extract tokens, wire them in, stop. Naming the tokens is the work; theming the config beyond that is not. |
| Deploying too early | Debugging Vercel before it works locally | Local first. Deploy in the last ten minutes. |

### 2.5 The stop rule

At minute fifty, stop building and write the README. An excellent README on a good demo beats a
missing README on a great one, because the README is what they read before they open the code
and it's where your reasoning lives. Reasoning is the primary grading criterion.

---

## Part 3 — Demo and interview guardrails

### 3.1 Before you present

- Run both example students end to end, twice, and confirm you get identical lists
- Delete the API key, reload, confirm the fallback works and the banner appears
- Print both documents to PDF and actually look at them at 100%
- Open the deployed URL on a different network
- Screenshot both finished documents, in case the live demo fails entirely

### 3.2 The single biggest risk

The example students are in the brief, which means whoever wrote it knows what a good list for
each looks like. **Run both and check the output against your own judgment**, not just against
whether the code ran. If the marine biology student comes back with eight expensive northeastern
privates, the engine is wrong regardless of whether it crashed.

Specifically check that student B gets warm-climate schools with actual marine programs, that
affordability visibly changes the ordering, and that at least one school is somewhere a
counselor might not have thought of. That last one is the moment the demo lands.

### 3.3 Framing

Do not open with "what Nerd Apply is missing." Open with what you built and why. If the
competitive framing comes up, the line is: *this is the orchestration layer that sits on top of
outcomes data and turns it into something a family can hold.* You consume their dataset, you
don't compete with it.

### 3.4 Answers to have ready

**"Why doesn't the AI pick the schools?"**
Reproducibility and hallucination. The model reads and writes; the code decides. Same input,
same list, and it can't invent a tuition figure because it's never asked to produce one.

**"How would you plug in real data?"**
One function, `getColleges()`. Everything else imports from it. Swap the inside for a Scorecard
call or a Nerd Apply feed and nothing downstream changes.

**"Why no percentage chances?"**
Sixty schools of public data can't support an honest one, and a precise-looking number a family
can't interrogate is worse than an honest band. The bands carry an evidence strength instead.

**"What's wrong with it?"**
Distance is estimated from a state centroid, so Philadelphia and Pittsburgh look identical.
The seed set is sixty schools. Test-optional percentiles skew upward from self-reporting, which
is why test-optional schools cap at Moderate evidence. Scorecard's public net price is in-state,
so out-of-state publics are forced to Needs Review.

Having four specific limitations ready is a stronger answer than any feature you could have
added instead.

**"Why does the counselor rank priorities?"**
Because the weights were otherwise my guesses about what matters, and different families trade
money against proximity in opposite directions. It's also only possible because code does the
deciding — if a model picked the schools there'd be no weights to expose.

**"Did you think about connecting students to alumni?"**
Yes, and I cut it. It connects a minor to strangers, the brief says synthetic data, and it runs
against your de-identification thesis. The need underneath is real, so I designed it as a
de-identified comparable-cases panel with the counselor making any introduction. That's where
your dataset plugs in.

**"Why isn't campus safety on the student's copy?"**
Crime counts are confounded — better reporting reads as worse safety, and urban campuses look
worse by where the boundary is drawn. A counselor can read that with context. A parent at a
kitchen table can't. So it's on the counselor document with the caveat, and nowhere else.

**"What would you build next?"**
ZIP-code distance, then the counselor override log, because every override is a labelled example
of where the engine was wrong and that's the only training signal in the product that doesn't
require touching student data.

### 3.5 If it breaks live

Say what you expected to happen, what you're seeing, and what you'd check first. Then open the
screenshots and keep going. Debugging calmly in front of someone is a better signal than a demo
that never wobbled, and they have almost certainly seen more broken demos than working ones.
