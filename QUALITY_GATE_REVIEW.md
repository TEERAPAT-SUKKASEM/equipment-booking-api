# Quality Gate Review

This record was drafted by the AI assistant from the review results (see [AI_LOG.md](AI_LOG.md), entries 2–6).
Each finding below was reproduced, by a second AI agent or by a recorded test, and each fix has evidence
in [evidence/](evidence/README.md). The list of everything the AI reviewers reported is in
[evidence/ai_review_summary.md](evidence/ai_review_summary.md).

## First version (snapshot before the Quality Gate)

- **Snapshot:** git tag `v1-snapshot` → commit `0c407c0`, committed 2026-10-06 13:42:30 (+07:00).
  The Quality Gate checklist was placed in the exam folder afterwards, at 14:17.
- **What it contained:** all six endpoints, the three validation rules, JSON errors, SQL with parameter
  binding, contract and schema documents. 21 `curl` requests run by the AI assistant returned the
  expected status codes (AI_LOG.md entry 1; their output was not saved).
- **See it:** `git show v1-snapshot --stat` · changes since then: `git diff v1-snapshot HEAD -- src db`

## How the review was done

1. **Review of the snapshot (13:46–14:18).** Five independent AI reviewers each examined `v1-snapshot`
   from one angle (contract conformance, business rules and time handling, input validation and
   security, data design and explainability, running from a clean checkout). A second AI agent then had
   to reproduce each reported finding itself before it counted: 40 reported, 21 confirmed, which are
   11 distinct issues (several reviewers found the same ones). The 11 issues are covered by the 9 rows
   below; rows 5 and 8 cover two each.
2. **Fix and test.** Each confirmed issue was fixed and tested. The double-booking defect was recorded
   on the first version at 14:25, before the code was changed. The extreme-year defect was recorded at
   14:36, after the fix, by serving the `v1-snapshot` code on a separate port with its own database.
3. **Check of the fixes (14:28–14:31).** Two more AI agents tried to break the changed code on a
   separate server instance (simultaneous requests; validation and regression). No defect was found in
   the fixes; one low note (emoji length counting) was documented.
4. **Final consistency check (14:39–14:42).** Two AI agents compared the documents with the code and
   the records with the evidence and git history. The documents matched the code; ten inaccuracies in
   the records were corrected.

## Improvement record

| Quality Gate area | Finding | Action taken | Evidence |
|---|---|---|---|
| **2. Reliability** — "Creating or updating a booking cannot create an overlap" | Not true for simultaneous requests. v1 ran a `SELECT` to look for an overlap and then a separate `INSERT`/`UPDATE`; two requests arriving together could both pass the check and both be stored. Ordinary one-after-another `curl` tests cannot show this. | The check is now part of the write statement itself (`INSERT … SELECT … WHERE NOT EXISTS`, `UPDATE … WHERE id = ? AND NOT EXISTS`); "0 rows changed" becomes `409`. Added `tests/race_test.mjs`. | Before: [race_before_fix.txt](evidence/race_before_fix.txt), 3 of 60 rounds double-booked on v1. After: [race_after_fix.txt](evidence/race_after_fix.txt), 0 of 60; the same in a clean clone ([clean_clone_run.txt](evidence/clean_clone_run.txt)). The AI verifier of run 2 also reported 7 kinds of simultaneous-request tests × 25 rounds with no overlapping pair ([ai_review_summary.md](evidence/ai_review_summary.md)). Commit `e621a20`. |
| **6. Accuracy** — "dates contain the correct values", "`startAt` is before `endAt`" | v1 accepted a booking whose start is **after** its end when the time crosses into year 10000 in UTC (`9999-12-31T23:30:00-01:00`). It was stored as `+010000-…`, a different text shape, so comparing the stored strings gave the wrong answer; that row then blocked every other booking of the equipment. | The UTC year is limited to 2000–2100 in `parseTimestamp`, so every stored timestamp has the same shape. Rule added to the contract (V3, A12) and to SCHEMA.md. | Before: [extreme_year_before_fix.txt](evidence/extreme_year_before_fix.txt) (`201`, then `409` for a normal booking). After: case 16 in [curl_tests_output.txt](evidence/curl_tests_output.txt) → `400`; boundaries in [other_checks.txt](evidence/other_checks.txt) block 1. Commit `e621a20`. |
| **2. Reliability** — "handles invalid requests" | Text fields had no maximum length in v1 (`git show v1-snapshot:src/index.ts`). Two AI reviewers reported, and their verifiers reproduced, that a 3 MB `purpose` was stored and then sent to every caller of `GET /bookings` ([ai_review_summary.md](evidence/ai_review_summary.md)); no own "before" run was saved for this one. | Limits of 50 / 100 / 500 characters (`400` above that); booking ids from the URL are no longer echoed in error messages. | Case 17 → `400`; [other_checks.txt](evidence/other_checks.txt) block 1 (500 accepted, 501 rejected). Commit `e621a20`. |
| **6. Accuracy** and **5. Execution Value** — "can be run by following the README" | The README said Node.js 20 is enough. The installed wrangler 4.147 declares `"node": ">=22.0.0"`. It was an AI-written claim nobody had checked. (Found at 13:50, after the snapshot but before the checklist arrived; mapped to areas 5 and 6 afterwards.) | README corrected; `engines` added to `package.json` so npm warns on older versions. | `node_modules/wrangler/package.json` → `"engines": { "node": ">=22.0.0" }`. Commit `f58e4a0`. |
| **5. Execution Value** and **7. Delivery Quality** — "clear run instructions" | Two traps in the README: the `curl -d '{…}'` example returns `400` in PowerShell (the quotes are lost), and after deleting `.wrangler/state` as the README suggested, every route answered a bare `500`. | Added `examples/booking.json` and a PowerShell command that reads the body from it; added `npm run db:reset`; the API now answers `Database is not set up. Run: npm run db:setup`. | [other_checks.txt](evidence/other_checks.txt) block 2 (`201` in PowerShell 7 and in Windows PowerShell 5.1) and block 4 (`500` with the hint). |
| **6. Accuracy** (stored data) | `PRIMARY KEY` columns accepted `NULL`: SQLite allows that for non-integer keys. | `NOT NULL` written on both primary keys in `db/schema.sql`. | [other_checks.txt](evidence/other_checks.txt) block 3: `NOT NULL constraint failed: equipment.id`. Commit `e621a20`. |
| **4. Reasoning** — "I can explain how my overlap check works for both create and update" | The v1 query was hard to explain: numbered placeholders used out of order, `id IS NOT ?4` relying on a `NULL` during create, and SCHEMA.md showed a different query text than the code. | The rule is written once (`OVERLAP` in `src/index.ts`) with a legend for each placeholder, and reused by create, update and the conflict message. SCHEMA.md shows the same text plus a table of which layer enforces which rule. | `src/index.ts` (`OVERLAP`, `INSERT_IF_FREE`, `UPDATE_IF_FREE`), SCHEMA.md "Business rule". All 25 cases still pass. |
| **4. Reasoning** — "why I selected each status code", "limitations or assumptions" | `404` for an unknown `equipmentId` is the one status code the brief can be read two ways on, and the contract listed it only as an assumption. Some wording did not match the real behaviour (V5 said "change", trimming and the timestamp format were not described). | The contract now gives both readings, why `404` was kept and where the one-line change would be; added the exact timestamp format, A11, A12 and a "Known limitations" section. | API_CONTRACT.md: "The one debatable case", "Timestamp format", "Known limitations". Case 18 → `404`. |
| **8. You Own It** — "`AI_LOG.md` truthfully records … how I checked it" | The log listed only checks run by the AI; "what I verified myself" was an empty placeholder. | AI checks and personal checks are separate sections now. The personal checks, with the command and what to look for, are listed in AI_LOG.md to be done by hand. | AI_LOG.md, "My own verification". |

## Reviewed and deliberately left unchanged

Reported by the reviewers, checked, and kept as they are, because the brief does not ask for them
(Quality Gate 1: no unrelated features; Quality Gate 4: required behaviour versus design choices).

| Observation | Decision |
|---|---|
| Unknown `equipmentId` returns `404`, a grader might expect `400` | Kept and justified in the contract; a one-line change if `400` is wanted. |
| An unsupported method on an existing path returns a JSON `404`, not `405` | The brief names only 400, 404 and 409. |
| The `Content-Type` request header is not enforced | Any body that parses as JSON is accepted; listed under "Known limitations". |
| An invalid HTTP method name or an over-long URL gets a plain-text error | Produced by the runtime before the API code runs; listed under "Known limitations". |
| Timestamps with more than 3 fractional digits are rejected | Documented in the timestamp format instead of widening the parser. |
| An emoji counts as 2 characters towards the length limits | Documented in A12. |
| The overlap rule is not a table constraint | SQLite has no such constraint; it is enforced inside the write statement and documented in SCHEMA.md. |
| No CORS configuration | No browser client was built (Quality Gate 7). |

## Quality Gate status after the fixes

| Area | Status | Where to see it |
|---|---|---|
| 1. Purpose | Routes, bodies and status codes match the common contract; all deliverables present; no extra features | API_CONTRACT.md, README.md |
| 2. Reliability | Overlap impossible on create and update, also for simultaneous requests; `equipmentId` checked; invalid requests give 4xx, not a crash | evidence: race tests, cases 6, 9, 11–18 |
| 3. Course Context | TypeScript + Hono + local D1 as in the brief; AI use recorded | README.md, AI_LOG.md |
| 4. Reasoning | Status-code reasons, overlap explanation, assumptions and limitations written down | API_CONTRACT.md, SCHEMA.md |
| 5. Execution Value | Runs from a clean clone with the three README commands; all endpoints work; tests recorded | [evidence/clean_clone_run.txt](evidence/clean_clone_run.txt), evidence/README.md |
| 6. Accuracy | `startAt < endAt` enforced; every error is `{ "error": "..." }`; every SQL value goes through `.bind()` | `src/index.ts`, evidence |
| 7. Delivery Quality | README, contract, ERD, evidence for 34 cases (9 + 25); no CORS | repository root, evidence/ |
| 8. You Own It | Personal verification and explanation | AI_LOG.md, "My own verification" |

## Submission decision

Technical state: all required work is present and all recorded tests pass.

Decision (ticked by me after my own verification in AI_LOG.md):

- [ ] **READY**
- [ ] REVIEW WITH INSTRUCTOR
- [ ] REWORK
- [ ] DO NOT SUBMIT YET
