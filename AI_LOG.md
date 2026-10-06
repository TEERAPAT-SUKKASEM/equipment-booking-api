# AI Log

- **AI tool:** Claude Code (model: Claude Fable 5.1), used as a coding assistant inside this project folder.
- **Settings I chose:** maximum reasoning effort, and the multi-agent mode ("ultracode"), which lets the
  assistant start several independent AI reviewers.
- **Session:** https://claude.ai/code/session_01AHWQTxatdUg9X6kWryvKjq
- Times are local (UTC+7) on 2026-10-06. Every commit made by the assistant carries a `Co-Authored-By: Claude` line.

**Extent of AI use.** I gave one prompt (entry 1). From the exam brief and the rubric the assistant
wrote the source code, the SQL, the test scripts and the documents in this repository, and ran the
checks listed as "AI checks" below. Checks that the AI ran are **not** counted as my own verification;
what I checked myself is in the last section.

## Entries

### 1 — 13:33 · Read the task and build the first version

**Prompt:** "let's start the exam now you can explore files in this folder now"

**What the AI did**

- Read `exam_brief_en.md` and `rubric_en.md`. The starter repository, `curl_test_guide.md` and
  `quality_gate.md` were not in the folder yet, so it set up a standard Hono + Cloudflare D1 project.
- Wrote the design first: `API_CONTRACT.md`, `SCHEMA.md`, `db/schema.sql` (commit `ff38e6a`, 13:39),
  then `src/index.ts`, `wrangler.jsonc`, `tsconfig.json`, `README.md` (commit `0c407c0`, 13:42, tag `v1-snapshot`).

**AI checks:** `npx tsc --noEmit` → exit code 0; `npm run db:setup` → 4 SQL commands executed; 21 `curl`
requests against `http://localhost:8787/api`, all with the status code the contract states.

**What I used:** all of it, as the first version.

### 2 — 13:46 to 14:18 · Independent review of the first version (no new prompt)

**What the AI did:** started five independent AI reviewers on `v1-snapshot` (contract, business rules,
validation and security, data design, clean-checkout run). A second agent had to reproduce each finding
before it counted: 40 reported, 21 confirmed (11 distinct issues); the list is in `evidence/ai_review_summary.md`.

**What I used:** the confirmed issues, listed with their fixes in `QUALITY_GATE_REVIEW.md`.

**What was not used, and why:** suggestions outside the brief (a `405` status, enforcing `Content-Type`,
rejecting control characters). See "Reviewed and deliberately left unchanged" in `QUALITY_GATE_REVIEW.md`.

### 3 — 13:50 · An AI claim that was wrong

While checking its own README against the installed packages, the assistant found that its statement
"Requires Node.js 20 or newer" was wrong: wrangler 4.147 needs Node 22 or newer. Fixed in commit `f58e4a0`.
Lesson: version numbers and commands written by the AI have to be checked against the real project.

### 4 — from 14:20 · Fixes, tests and documents (no new prompt)

`quality_gate.md` and `curl_test_guide.md` were added to the exam folder at 14:17; the assistant read them.

**What the AI did**

- Recorded the double-booking defect on the first version at 14:25, before changing the code
  (`evidence/race_before_fix.txt`). The extreme-year defect was recorded at 14:36, after the fix, by
  serving the `v1-snapshot` code on a separate port (`evidence/extreme_year_before_fix.txt`).
- Fixed the code (commit `e621a20`): the overlap check is now inside the `INSERT`/`UPDATE` statement;
  years limited to 2000–2100; maximum text lengths; `NOT NULL` primary keys; a clear message when the
  database has not been set up.
- Wrote `tests/curl_guide.sh` (the instructor's nine steps), extended `tests/curl_tests.sh` to 25 cases,
  wrote `tests/race_test.mjs`, recorded the output in `evidence/`.
- Updated `README.md`, `API_CONTRACT.md`, `SCHEMA.md`; drafted `QUALITY_GATE_REVIEW.md` and this log.

**AI checks:** guide run 9 of 9; test script 25 of 25; concurrency test 0 double bookings in 60 rounds
(3 of 60 before the fix); `npx tsc --noEmit` → exit code 0.

### 5 — 14:28 to 14:31 · Independent check of the fixes (no new prompt)

Two more AI agents tried to break the fixed code on a separate server instance (about 200 requests and
seven kinds of simultaneous-request tests, 25 rounds each). Result: no defect in the fixes. One low note (an emoji counts
as two characters towards the length limits) was documented in `API_CONTRACT.md` A12 instead of changed.

### 6 — 14:39 to 14:46 · Clean-clone run and final consistency check (no new prompt)

- The assistant cloned the repository into an empty folder and followed the README: install, database
  setup, start, then all three test scripts (`evidence/clean_clone_run.txt`: 9 of 9, 25 of 25, concurrency PASS).
- Two AI agents compared the documents with the code and the records with the evidence and git history.
  The documents matched the code. Ten inaccuracies in the records (a wrong curl version, two wrong times,
  numbers without a saved source, an evidence file that was not committed yet) were corrected, and
  `evidence/ai_review_summary.md` was added so that the numbers quoted from the AI reviews can be checked.
  Lesson: summaries written by the AI need the same checking as its code.

## My own verification

To be completed by me, by hand, before submitting. I tick a box only after I have done it.

| # | What I do | What I should see | What I saw |
|---|---|---|---|
| 1 | Read `src/index.ts` from top to bottom | I can say what each function does and why | |
| 2 | `npm run db:reset`, then `curl.exe -i http://localhost:8787/api/equipment` | `200` and three equipment records | |
| 3 | `curl.exe -i -X POST http://localhost:8787/api/bookings -H "Content-Type: application/json" --data-binary "@examples/booking.json"` | `201` and a booking with an `id` | |
| 4 | The same command a second time | `409` and `{ "error": "Equipment eq-1 is already booked ..." }` | |
| 5 | `curl.exe -i http://localhost:8787/api/bookings/not-found` | `404` and `{ "error": "Booking not found" }` | |
| 6 | Search `src/index.ts` for `prepare(` | every value from a request goes through `.bind(...)` | |
| 7 | Read "Why 400, 404 and 409" in `API_CONTRACT.md` | I agree with each choice, including `404` for unknown equipment | |
| 8 | Read `QUALITY_GATE_REVIEW.md` | I can explain each change made after the first version and why | |

- [ ] I ran checks 2–5 myself and wrote down what I saw.
- [ ] I can explain the overlap rule for create and for update (`OVERLAP` in `src/index.ts`).
- [ ] I can explain why the check and the write are one SQL statement.
- [ ] I can explain why timestamps are stored as text in one fixed UTC format.
