# CLAUDE.md

This repo builds the College List Builder demo specified in `files/01-PRD.md`,
`files/02-ENGINEERING.md`, `files/03-DESIGN.md`, and `files/04-GUARDRAILS.md`. Read those four
files before making product or architecture decisions — this file only carries the session-level
build rules layered on top of them.

## Architecture

- The model reads and writes. `engine.js` decides. The AI never picks a school, assigns a band,
  or produces a number.
- No TypeScript, no test runner, no React Router, no state library.
- Do not add dependencies without saying what and why.
- Keep each file under ~300 lines when possible; prefer a few larger files over many small ones.
- Do not refactor files you weren't asked to change.
- Do not swallow errors in an empty `try/catch` — log it.
- Nothing is stored. Session state only — no database, no persistence layer.

## Design tokens

Never use a raw color, size, spacing, or radius value. Once `src/tokens.css` and the Tailwind
theme exist, use only tokens from them — no Tailwind arbitrary values (`text-[#333]`,
`p-[13px]`). If a token is missing for something you need, propose adding one — do not inline it.

## Secrets and keys

There is no Gemini key and no Scorecard key in this environment. The app must work fully on
keyword extraction (`src/lib/extract.js` fallback path) and the hand-built `colleges.json` —
these are not degraded placeholders, they are the primary path for this build. Never put a
secret in client code; API calls that need a key go through `/api/llm.js` only.
`.env.local` is gitignored. Commit `.env.example` with empty placeholders only.

## Scope

Build P0 only, per `files/01-PRD.md` section 6. Do not build the P1 features: application gap,
student-life hook, merit-aid signal, "why not these," comparable-cases panel, or campus safety.

## Process

Build and commit in small, working steps — scaffold, then tokens, then data, then engine, then
screens, then documents, then README — rather than in one large batch. Confirm each step runs
before moving to the next.
