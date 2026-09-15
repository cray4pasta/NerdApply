# Design Doc — College List Builder

Two products live in this repo: a dense working tool for a counselor at a desk, and a calm
printed document for a family at a kitchen table. They should not look the same.

---

## 0. Step one: build the design system

**Nothing else starts until the token file exists.** No component, no screen, no print layout.
And after it exists, **no raw values anywhere in the codebase** — no `#333`, no `p-[13px]`, no
`text-[15px]`. Every colour, size, space, and radius comes from a token.

This is not tidiness. It's the thing that makes the build defensible in a design interview. A
reviewer who opens your CSS and finds hardcoded hex codes has learned something about you in
four seconds. One who finds a token layer has learned something better.

### 0.1 The system mirrors Nerd Apply's own foundations

The goal is that a Nerd Apply designer opens this and it feels like it could ship inside their
product. That means their palette, their typeface, their radius, their density.

**Borrow:** background and surface colours, ink ramp, primary brand colour, typeface and scale,
border radius, border colour and weight, button styling, table row density, section padding.

**Do not borrow:** their semantic colour assignments. The dual-label system in section 2 below is
this product's own argument and has to survive contact with their brand. If their primary is a
strong blue, the admissions track still stays monochrome and the affordability accent still
carries the only colour. You map the system onto their palette; you don't replace it.

Say this out loud if asked: *"I built on your foundations so it feels native, and added a label
system your product doesn't have yet. Those are separate layers on purpose."* That reads as
design judgment. Matching the homepage pixel for pixel reads as tracing.

### 0.2 The extraction — mostly done

Confirmed from Nerd Apply:

```
font family (display)      Libre Baskerville
font family (body)         Albert Sans
brand primary              rgb(91, 91, 152)   #5B5B98
ink primary                rgb(24, 29, 39)    #181D27
page background            #FFFFFF
```

The full derived token set is in section 3. **Three things still need five minutes with devtools**
before you write the token file:

1. **`border-radius`** on a primary button and on a card. Computed tab. This is the single most
   recognisable shape signal in a system and it's a two-second look.
2. **Density.** Roughly how tall is a row in any table or list they show, and how much padding
   sits between page sections. You don't need exact numbers, just whether they run tight or airy.
3. **What they refuse to use.** Gradients? Drop shadows? Illustration? The absences are half the
   system and the easiest half to match.

If you're short on time, skip all three and use the defaults noted in section 3. They won't be
wrong, just less precisely theirs.

### 0.2b How to extract, for next time

1. **Check for a token layer first.** Elements panel → select `<html>` → Styles pane → scroll to
   the `:root` rule. Many modern sites declare `--color-*` custom properties there. If they do,
   you're done in two minutes.
2. **Otherwise use the eyedropper.** Click any colour swatch in the Styles pane to open the
   picker, then sample: page background, surface, body text, a divider, the primary button fill.
3. **Type.** Computed tab on a body paragraph, then an `h1`, then a small label. Note which
   weights are actually loaded; it's usually fewer than you'd think.

### 0.3 Write it once, in two places

Tokens live in `tailwind.config.js` so the utility classes exist, and as CSS custom properties
so the print stylesheet and any hand-written CSS can reach them.

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      paper:   'var(--paper)',
      surface: 'var(--surface)',
      ink:     { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
      rule:    'var(--rule)',
      brand:   { DEFAULT: 'var(--brand)', hover: 'var(--brand-hover)', tint: 'var(--brand-tint)' },
      flag:    { DEFAULT: 'var(--flag)', bg: 'var(--flag-bg)' }
    },
    borderRadius: { control: 'var(--r-control)', card: 'var(--r-card)' },
    fontFamily: {
      display: ['Libre Baskerville', 'Georgia', 'serif'],
      sans:    ['Albert Sans', 'system-ui', 'sans-serif']
    }
  }
}
```

`src/tokens.css` holds the custom properties — the full set is in section 3. Semantic names, not
literal ones: `--ink-2`, never `--indigo-gray-600`. Same adapter argument as `getColleges()`,
applied to design.

### 0.4 If a value is still missing

Section 3 notes a sensible default for anything not yet extracted — radius in particular. Use it
and move on. Do not block the build on a border radius.

### 0.5 The design brief their positioning gives you

Before you look at a single pixel, their own language tells you the aesthetic. They describe
themselves as building the foundational data platform for admissions, the way EPIC Systems did
for healthcare, and their product exists to make reasoning and evidence visible.

That is a **clinical, research-grade infrastructure** brief, not a consumer edtech one:

- Data-dense over airy. A counselor is reading, not browsing.
- Tables are first-class, not a fallback for when a card grid won't fit.
- Evidence is always adjacent to the claim. Never a claim on its own line.
- No illustration, no mascots, no gradient hero, no celebratory states.
- Restraint reads as trustworthy. A tool handling a family's finances and a teenager's future
  should not be cheerful at them.

If your build feels like a startup landing page, you've missed the brief regardless of whether
the hex codes match.

### 0.6 Enforcement

Add to your Cursor rules:

> Never use raw colour, size, spacing, or radius values. Use tokens from `tokens.css` and the
> Tailwind theme only. No Tailwind arbitrary values (`text-[#333]`, `p-[13px]`). If a token
> doesn't exist for what I need, tell me and propose adding one — do not inline it.

That last clause matters. Without it the model will silently inline a value when the token is
missing, which is exactly how token systems rot.

---

## 1. Position

**The counselor tool** is an instrument. Dense, quiet, high information per square inch. It
should feel like something you use forty times a week without noticing it.

**The family document** is a letter. Generous, warm, unhurried. It gets read once, possibly
in a stressful moment, possibly by someone for whom English is a second language, possibly by a
parent who has never seen a college list before.

Designing both with the same visual language would be the lazy answer. Designing them
differently, on purpose, is a decision you can defend.

---

## 2. The hardest design problem in this product

Every school carries **two** three-state labels. Encode both with colour and you get six
colours competing on one row, and the screen turns into a traffic-light casserole.

Worse: colour implies judgment. Green-Likely and red-Reach tells a student that a Reach school
is *bad*. It isn't. A well-built list is supposed to contain Reaches. The colour would be lying.

### The solution

**Admissions is position. Affordability is attention.**

**Admissions band — monochrome, positional.** A three-segment track with the current segment
filled, plus the word. It reads as *where on a spectrum*, not *how good*.

```
Likely   ▰▱▱     Target   ▱▰▱     Reach   ▱▱▰
```

No colour. Ever. The three states are visually equal in weight, because they are equal in worth.

**Affordability — the only coloured thing on the screen.** And only one of its three states
carries colour, because only one of them needs the counselor to do something.

| State | Treatment | Why |
|---|---|---|
| Likely Affordable | Solid dark pill, white text | Settled. Quiet confidence, no attention needed. |
| Needs Review | `--flag` clay, filled | The only true call to action in the interface |
| Unknown | Dashed outline, no fill, grey text | Visually *absent*, because the data is absent. Honest. |

Result: a well-balanced list is almost entirely cool monochrome, and the one warm value in the
entire system appears exactly where a human needs to look. On a badly balanced list the screen
warms up. The design does the warning before the warning text does.

The dashed-outline Unknown is worth pointing at specifically. Most tools would hide a missing
value or backfill it. Making absence *look* absent is the visual form of rule 4.4 in the PRD.

**Evidence strength — three dots, monochrome.** ●●● Strong, ●●○ Moderate, ●○○ Limited. Never
coloured. It modifies the label; it doesn't compete with it.

---

## 3. Foundations — extracted from Nerd Apply

These are their real values, not a fallback. Everything below is derived from four confirmed
tokens: Libre Baskerville for display, Albert Sans for body, `rgb(91, 91, 152)` primary,
`rgb(24, 29, 39)` for text, white background.

### Colour

Their ink is a cool blue-black, so the whole neutral ramp runs cool. Do not mix in a warm gray
anywhere — a warm border against a cool black is the kind of thing that looks subtly cheap
without anyone being able to say why.

```css
:root {
  /* confirmed */
  --surface:  #FFFFFF;           /* rgb(255,255,255) — cards, and the printed page */
  --ink:      #181D27;           /* rgb(24,29,39) — primary text */
  --brand:    #5B5B98;           /* rgb(91,91,152) — muted indigo */

  /* derived from --ink, cool ramp */
  --ink-2:    #4A5163;           /* secondary text */
  --ink-3:    #656C7F;           /* metadata, last-verified stamps, 12px labels */
  --rule:     #E4E6EC;           /* 1px borders */

  /* derived from --brand */
  --brand-hover: #4D4D85;
  --brand-tint:  #EFEFF6;        /* selected rows, focus backgrounds */

  /* app chrome — see note below */
  --paper:    #F7F7FA;

  /* semantic flag — the only warm value in the system */
  --flag:     #9C5A3C;
  --flag-bg:  #F7EDE8;
}
```

**Two decisions to check.**

*The paper tint.* Their background is white. But this is a dense data tool where cards need to
read as distinct from the page, and if both are `#FFFFFF` the 1px rules have to carry everything.
`--paper: #F7F7FA` is a barely-there cool tint pulled from their indigo, so surfaces separate
without introducing a new hue. This is the one place the system is extended rather than copied.
If you'd rather stay exactly faithful, set `--paper: #FFFFFF` and lean harder on `--rule` — both
are defensible, but decide it deliberately.

*The flag colour.* `#9C5A3C` is a clay, not an amber. Their palette runs desaturated, so a bright
`#B45309` would read as imported from another product. This value sits at roughly their
saturation level and does its work through **hue** contrast instead — it's the only warm thing in
an entirely cool system, which is more than enough to pull an eye. Verify it clears 4.5:1 on
white before shipping; it should land near 5.3:1.

Also verify `--ink-3` at 12px. It's the one token likely to fall short, and it carries every
provenance stamp in the product.

### Roles, kept strictly apart

| Token | Used for | Never used for |
|---|---|---|
| `--brand` | Primary buttons, links, focus rings, active states | Anything that means something about a school |
| `--flag` | Needs Review, and balance warnings | Buttons, links, or any interactive affordance |
| `--ink` ramp | All admissions labels, all evidence indicators | — |

This separation is what stops an indigo interface from swallowing the label system. Their brand
colour marks *what you can press*. The flag marks *what needs a decision*. Nothing else is
coloured at all.

### Type

Their pairing, used in both products. No third family.

```css
--font-display: 'Libre Baskerville', Georgia, serif;
--font-body:    'Albert Sans', system-ui, sans-serif;
```

Both are on Google Fonts, so they're free and self-hostable. Load Libre Baskerville 400 and 700
only, Albert Sans 400 / 500 / 600. Five files, no more.

**Libre Baskerville** — headings, school names, and the document title block. Two practical
constraints:

- It ships **Regular and Bold only**. There is no medium or semibold, so heading hierarchy comes
  from *size*, never from weight. That's the Swiss discipline enforced by the typeface rather
  than by willpower, which is a better outcome than it sounds.
- It's wide with a large x-height, so it eats horizontal space. Set headings above 28px at
  `-0.02em` and keep them short. Do not set a long sentence in it.

**Albert Sans** — all body text, every number, every label, every table cell. It's a geometric
sans with proper tabular figures, which matters because this product is mostly columns of money
and test scores. Turn them on: `font-variant-numeric: tabular-nums` on any element containing a
figure. Costs one line, and stops the cost column jittering between rows.

Scale: 12 · 14 · 15 · 18 · 22 · 28 · 40. Small uppercase labels get `+0.08em` and never exceed 12px.

**How the two products differ, now that they share a typeface.** Not by family — by density and
scale. The counselor tool runs 15px body, tight rows, Libre Baskerville only at the page title.
The printed document runs 10.5pt body with generous leading and uses Libre Baskerville on every
school name, which gives each entry a visible anchor as the eye moves down the page.

### Structure

- 8px spacing base. Every gap is a multiple.
- 1px `--rule` borders instead of shadows. Depth through structure, not theatre.
- Border radius only on interactive things: `--r-control` on buttons and inputs, `--r-card` on
  cards. **Still to extract** — check a button on their site and match it. If you can't, use
  6px control / 8px card, which sits comfortably with a geometric sans.
- Left-aligned everything. The only centred element in either product is the document's title
  block.

---

## 4. Screens

### 4.1 Notes

Single column, max 720px, centred in the viewport, content left-aligned.

One heading. One large text area — 12 rows minimum, serif, 16px, generous line height, because
the counselor is writing prose and a cramped box makes people write less. Under it, two ghost
buttons that drop the example students in. One primary button: **Build the list.**

Nothing else on this screen. No sidebar, no branding, no tips panel. The emptiness is the point:
there is no form to fill in, which is the product's opening argument.

### 4.2 Criteria review — a table

The counselor is auditing here, and auditing wants rows. Chips are for browsing; a table is for
checking. Four columns plus a delete affordance:

```
WHAT I UNDERSTOOD          FROM THIS PHRASE                CONFIDENCE   IMPORTANCE
──────────────────────────────────────────────────────────────────────────────────────
Computer science           "loves programming"             ●●●          [Required  ▾]   ✕
Within ~300 mi of home     "aren't too far from home"      ●●○          [Preferred ▾]   ✕
Hands-on, applied          "practical and hands-on"        ●●○          [Preferred ▾]   ✕
Quiet / introverted        —                               ●○○          [Flexible  ▾]   ✕
──────────────────────────────────────────────────────────────────────────────────────
+ Add a criterion
```

**The source-phrase column is the load-bearing one.** A row with an em dash instead of a quote
is a row the model invented, and that becomes visible while scanning rather than on hover. It's
the same design argument as the dashed Unknown pill: make absence look like absence.

Set the phrase column in the serif, in quotes, `--ink-2`. It should read as a quotation from the
counselor's own writing, because that's exactly what it is.

Low-confidence rows get a dashed left border in `--ink-3`. Uncertainty and absence share one
visual grammar across the whole product.

**Affordability sits below in its own bordered panel**, because the counselor is *entering* data
here rather than correcting it. Income band as a select, maximum annual out-of-pocket as a number
input. One line of copy: *"This drives every affordability label. A best estimate is fine."*

Primary: **Continue to priorities.** Ghost: **Back to notes.**

### 4.3 Priorities

The most interesting screen in the product and the one that should feel the lightest.

Six draggable rows, numbered, single column, max 560px. Nothing else on the page.

```
  What matters most for this student?

  1  ⣿  Affordability
  2  ⣿  Academic programme strength
  3  ⣿  Closeness to home
  4  ⣿  Admissions realism
  5  ⣿  Campus environment and fit
  6  ⣿  Student support services

  Drag to reorder. This changes which schools rise to the top.
```

Design notes:

- **No icons, no colour, no descriptions.** The six labels carry it. Anything more turns a
  ten-second screen into a reading task.
- Rank number in the sans at 12px, `--ink-3`, tabular figures. The label in 18px `--ink`.
- Drag handle only on hover, `--ink-3`. The row itself is the drag target.
- On drop: a 180ms transform, no bounce. Quiet confidence, not personality.
- Default order is the one shown, so a counselor who doesn't care presses straight through.
  Never force a decision to get past a screen.

Use `@dnd-kit/core` or HTML5 drag events. Do not spend fifteen minutes on drag physics — if it's
fighting you, ship up/down arrow buttons instead. Reordering has to *work*; it does not have to
feel like iOS.

### 4.4 The list

Left: the schools. Right, sticky: the balance panel and the print button.

**School row** — one line tall at rest, expandable:

```
┌───────────────────────────────────────────────────────────────────────┐
│  University of Pittsburgh                    Likely ▰▱▱  ●●●          │
│  Pittsburgh, PA · Public · 19,000 students   ┌──────────────────────┐ │
│                                              │ Likely Affordable    │ │
│  Strong applied CS with co-op placement,     └──────────────────────┘ │
│  about 300 miles from home.                                           │
│                                                                       │
│  SAT 1230 · middle 50% 1180–1380 · 49% admit                          │
│  Est. net price $18,200/yr at $30–48k income · Scorecard 2023–24      │
│  Total cost of attendance $36,600 · About a 5-hour drive              │
│                                                                       │
│  [computer science] [co-op] [within 300mi] [public]         Remove ⤫  │
└───────────────────────────────────────────────────────────────────────┘
```

Travel burden sits on the same quiet metadata line as cost, not as its own badge. It's context,
not a verdict, and giving it a pill would put it in competition with the two labels that matter.
Phrase it in time, never in miles — "about a 5-hour drive," never "412 miles" — because the
question underneath is *can he come home at Thanksgiving*, and hours answer that where miles
don't.

The evidence line is set in `--ink-3` at 12px. It's quiet, but it's always there. The label is
the opinion and the numbers underneath are the receipt, and the receipt is never more than a
glance away.

**Balance panel.** Green-free. A neutral summary — *"3 Likely · 4 Target · 3 Reach · 3 affordable"* —
and beneath it, any warnings in `--flag` with the fix stated, not just the problem. "Add at least two
Likely schools" beats "list is unbalanced."

If there are no warnings, the panel says so in one plain line. Don't celebrate. The tool is not
excited; it's just done.

---

## 5. The two documents

One component, a `variant` prop, two genuinely different documents. The counselor optimizes for
fit; the student optimizes for desire. Those are different jobs.

| | Student document | Counselor document |
|---|---|---|
| Job | Make them want to go, and tell them what to do Monday | Defend the decision, and be the counselor's own record |
| Voice | Second person, warm, grade-8 reading level | Third person, clinical, no hand-holding |
| Type | Serif body, generous | Sans, dense, more per page |
| Per school | Why you'd love it · what it costs · how far · what you'd need | Everything above, plus the comparison numbers, evidence strength, sample sizes, counselor note |
| Also contains | How to read this list · what to do next · questions to ask | Balance warnings · schools cut and why · the priority order used · extraction confidence summary |
| Never contains | Evidence strength, sample sizes, fit reasoning, campus safety data, balance warnings | — |

The student document is the deliverable named in the brief. Build it first and give it the craft.
The counselor document is five minutes once the first one exists, and having both is what proves
you understood that these are two different readers rather than one document at two sizes.

**Why campus safety appears on only one of them.** If you build it at all, Clery data goes on the
counselor document with its reporting caveat printed alongside, and never on the student's. Crime
counts are badly confounded — better reporting culture reads as worse safety, and "is this area
safe" maps onto neighbourhood demographics faster than anyone intends. A counselor has the
context to interpret that. A parent reading a raw number at a kitchen table does not. This is a
values decision, made deliberately, and it's worth saying so.

### Student document structure

**Page 1**

1. **Title block.** *A college list for Jordan Reyes.* Prepared by, date, "reviewed together on
   ___" with a printed rule to write on. The blank line matters — it makes the document an
   artifact of a conversation rather than a machine output.

2. **How to read this list.** A bordered box, the single most important block in the document.
   Six one-line definitions in plain language:

   > **Likely** — students with a profile like yours are usually admitted.
   > **Target** — a realistic possibility, not a certainty.
   > **Reach** — worth applying to, but plan on other options.
   > **Likely affordable** — based on what your family shared, the estimated cost fits.
   > **Needs review** — the cost may work, but it depends on aid. Check before applying.
   > **Unknown** — we don't have reliable cost data yet. Ask the school directly.
   >
   > None of these are guarantees. They are informed estimates based on public data and your
   > counselor's judgment.

   That last sentence is the most important line in the entire product. Set it in italic.

3. **The list begins.** Five to six schools.

**Page 2**

4. Remaining schools.
5. **What to do next.** Numbered, five items max, concrete. Run the net price calculator for
   each school. File the FAFSA. Ask about [intended major] specifically. Visit if you can.
6. **Questions worth asking each school.** Four or five, drawn from what the list didn't resolve.
7. **Where this came from.** Data sources, the date each was verified, and a plain sentence:
   *"Costs are estimates from public federal data and are not a quote. Your actual price depends
   on your family's finances and each school's aid policies."*

### School entry, in print

```
University of Pittsburgh                                    LIKELY · LIKELY AFFORDABLE
Pittsburgh, Pennsylvania · Public · about 19,000 students

Strong applied computer science with a co-op programme, roughly 300 miles from home.

Estimated cost        about $18,200 per year after typical aid
                      full cost before aid is about $36,600
Getting there         about a 5-hour drive — close enough to come home for breaks
You'd probably like   the student-run game dev club, which runs an annual showcase
You already have      a competitive CS portfolio and a state-level award
You'll need           two teacher recommendations and one supplemental essay
Check your price      oafa.pitt.edu/afford
Counselor's note      Ask about the co-op placement rate in CS.
───────────────────────────────────────────────────────────────────────────────────
```

Three of these rows are the difference between a spreadsheet and something a seventeen-year-old
actually reads:

- **"Getting there"** in hours, never miles, with the consequence stated. The number is not the
  point; *coming home for breaks* is the point.
- **"You'd probably like"** is the hook, and the hook should be the *non-obvious* one. For an
  introvert who draws and is studying finance, surface the art club, not the finance club. The
  obvious connection is already in their head. The unexpected one is what makes them picture
  themselves on that campus. This row is counselor-authored and prints with a small
  "counselor-added" mark in `--ink-3`, so a family knows which lines came from federal data and
  which came from a person.
- **"You already have" / "You'll need"** is the only part of the document that tells them what to
  do on Monday. If the hour is tight, this is the last row to cut.

Omit any row with no content rather than printing it blank. An empty "You'd probably like" is
worse than no row at all.

Notes on this:

- Labels print as **words in small caps**, not shapes. Colour and iconography can die in a
  black-and-white office printer. Text survives everything.
- The net price calculator link prints as a **short readable domain**, not a full URL. Store
  the display string in the data. A wrapped 90-character URL on paper is a design failure.
- "Check your price" as the label, not "Net price calculator," because the second phrase means
  nothing to a family who has never applied to college.
- A hairline rule between entries. No boxes. Boxes on paper look like a form.
- If there's no counselor note, the row is omitted rather than left blank.

### Print CSS

```css
@page { size: letter; margin: 0.6in 0.75in; }

@media print {
  .no-print { display: none !important; }
  body { background: #fff; color: #000; -webkit-print-color-adjust: exact; }
  .school-entry { break-inside: avoid; }
  .page-2 { break-before: page; }
  h1, h2, h3 { break-after: avoid; }
  p { orphans: 3; widows: 3; }
  a { text-decoration: none; color: #000; }
}
```

- `break-inside: avoid` on each school entry is the rule that stops a school splitting across
  pages. Non-negotiable.
- `break-after: avoid` on headings stops orphaned headings at a page foot.
- Do **not** use `a::after { content: attr(href) }`. It works and it's ugly. Use the curated
  short domain instead.
- Chrome's print dialog adds its own header and footer. Add a line to the print screen:
  *"For the cleanest copy, turn off 'Headers and footers' in the print dialog."* Ten seconds of
  copy that saves the document from a URL stamped across the top.
- The list is 8–10 schools, so realistically **two pages for eight, three for ten**. Don't promise
  two in the README and ship three.

### In-app preview

Render the document route on screen at page width with a paper-coloured backdrop, behind a
**Preview** toggle. Do this — it's the demo moment. You click Preview and the finished thing
appears, without anyone having to open a print dialog in front of an audience.

---

## 6. Accessibility

Not a checklist item. Your PRD calls it a legal requirement and a moral one, and for a printed
document that gets handed to a stranger it genuinely is.

- **Semantic HTML throughout.** Real `h1`/`h2`/`h3`, real `ul`, real `dl` for the cost rows.
  Chrome generates a tagged PDF from the DOM, so good markup means a screen-reader-navigable
  document for free. `div`-soup produces a flat, unreadable PDF. This is the concrete reason the
  print approach beat `react-pdf`, which does not emit tags at all.
- **Colour is never the only signal.** Every label carries its word. Remove all colour and the
  document still works, which is exactly what happens on a black-and-white printer.
- **Contrast.** `--ink` (#181D27) on white is roughly 16:1. `--brand` (#5B5B98) on white is around
  5.7:1, so it is safe for link text as well as button fills with white labels. `--flag` (#9C5A3C)
  should land near 5.3:1. **Verify `--ink-3` at 12px** — it carries every provenance stamp in the
  product and it is the one token likely to fall short of 4.5:1.
- **Print type size.** Body no smaller than 10.5pt. Metadata no smaller than 9pt. Parents reading
  this may be over fifty.
- **Link text describes its destination.** "Check your price at Pitt," never "click here."
- **Language.** Aim for a grade 8 reading level in the family document. Write "how much you'd
  likely pay" instead of "estimated net price of attendance."

---

## 7. What to cut if you're behind

In this order:

1. The source-phrase highlighting on the criteria screen — nice, not load-bearing
2. Expand/collapse on school rows — just show everything
3. The "questions worth asking" section
4. The in-app preview — go straight to print

**Never cut:** the "How to read this list" box, the evidence line under each label, the
provenance footer, or the dashed Unknown treatment. Those four are the product's argument, and
without them you've built the same tool everyone else built.

---

## 8. Design decisions worth saying out loud

Have these ready. Each is one sentence.

1. "Admissions is monochrome and positional because a Reach isn't a failure, and colour would
   have told the student it was."
2. "Amber appears only on Needs Review, so a healthy list is almost entirely grey and an
   unhealthy one visibly lights up. The design warns you before the warning text does."
3. "Unknown is a dashed outline with nothing in it, because the honest representation of missing
   data is an absence you can see."
4. "The tool is sans and dense, the family document is serif and generous, because a counselor at
   a desk and a parent at a kitchen table are not the same reader."
5. "I used a print stylesheet instead of a PDF library because Chrome tags the DOM, which gives a
   screen-reader-navigable document. The library would have given me a flat one."
6. "Criteria are a table, not chips, because the counselor is auditing. The source-phrase column
   means a row the model invented is visible while scanning, not on hover."
7. "The priority ranking exists because the fit weights were otherwise just my guesses. It's also
   only buildable because code does the deciding — if a model picked the schools there'd be no
   weights to expose."
8. "Distance prints in hours, not miles, because the question underneath is whether he can come
   home at Thanksgiving."
9. "The student-life hook is deliberately the non-obvious one. An introvert studying finance
   already knows about the finance club. The art club is what makes him picture himself there."
10. "Campus safety data goes on the counselor document and never the student's, because crime
    counts are confounded in ways that map onto neighbourhood demographics, and a counselor has
    the context to read that where a worried parent doesn't."
11. "I extracted your foundations into a token layer and built on those. The one thing I added is
    the label system, because your product doesn't have it yet — and I kept it in the ink ramp
    rather than your indigo, so the brand colour still only ever means *you can press this*."
12. "The printed document uses Libre Baskerville on every school name, which is your own display
    face doing what it's best at. The two products share a typeface and differ by density, not by
    family."
