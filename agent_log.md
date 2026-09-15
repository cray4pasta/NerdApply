# Agent log

## 2026-09-15 23:05 UTC — Combined table with the full localhost flow

**What changed.** The criteria table now sits in the real walkthrough: paste notes, review phrase and what I understood, rank what matters, then see a scored list. Local `npm run dev` also answers the extract call, so you do not need a separate API server. Without a Gemini key, keyword matching still fills the table and says so.

**Why.** The earlier preview was only the table. Localhost on your machine still had the old full app, so the new columns never appeared. One app now holds both the new table and the list builder.

**What it affects.** Anyone who pulls this branch and runs `npm install` then `npm run dev` at http://localhost:5173. Scoring still uses the hidden category, value, and importance on each row.

## 2026-09-15 22:35 UTC — Criteria table: phrase, understood, edit/delete

**What changed.** The criteria table no longer shows confidence dots or Required/Preferred/Flexible. Each row now starts with the exact phrase from the notes, then a one-line paraphrase of what that phrase means for the search, then edit and delete icons sitting together. Edit opens the phrase and paraphrase for correction, and still lets you change the program used to build the list. Keyword matching and the Gemini extract prompt both fill in that one-line paraphrase. Scoring still uses the hidden category, value, and importance fields.

**Why.** Confidence and importance did not help anyone audit the notes. The old “what I understood” cell was a short label like “Law (not sure),” not a restatement of the prompt. A phrase such as “wants to pursue law but not sure” should read as exploring law without locking in, with flexible majors and low-stakes ways to test legal work.

**What it affects.** The criteria review screen and the extract step. The ranking math is unchanged. Counselors can no longer flip Required to Flexible on the table itself.
