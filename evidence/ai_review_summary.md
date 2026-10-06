# AI Review Record (summary)

Generated from the saved outputs of the three AI review runs of this session. It lists what the AI
agents reported and decided; the raw outputs (requests, scripts, full reasoning) are not included.
The numbers quoted in `QUALITY_GATE_REVIEW.md` and `AI_LOG.md` come from this record.

## Run 1 — review of `v1-snapshot` (13:46 to 14:18)

Five reviewers, one per lens. A second agent per lens had to reproduce each finding itself and then
rate it: **confirmed**, **not-a-defect** (real behaviour, but consistent with the brief) or **refuted**.

### Contract conformance

| # | Finding | Reviewer | Verdict | Verifier |
|---:|---|---|---|---|
| 1 | No length limit on text fields: a 3 MB purpose is accepted and stored, and error bodies echo unbounded input | medium | **confirmed** | low |
| 2 | Timestamps near the year limits are stored in a different format ("+010000-..."), which breaks the documented fixed UTC format, the start/end comparison and the list order | low | **confirmed** | low |
| 3 | Valid ISO 8601 timestamps with more than 3 fractional digits are rejected, and the error message claims the value is not an ISO 8601 date-time | low | **confirmed** | low |
| 4 | Some error responses are not JSON: methods the runtime does not recognise return 501 text/plain, CONNECT returns a plain 500, an over-long URL returns 431 text/plain | low | not-a-defect | low |
| 5 | An unsupported method on an existing path returns 404 "Route not found" (no 405, no Allow header) | low | not-a-defect | low |
| 6 | V5 and A6 are worded differently from what the API does for PATCH | low | **confirmed** | low |
| 7 | API_CONTRACT.md does not describe several behaviours a client can observe (Content-Type not enforced, text fields trimmed) | low | not-a-defect | low |
| 8 | Unknown equipmentId returns 404 while the brief lists "equipmentId must exist" under data validation: a grader's script may expect 400 | low | not-a-defect | low |

Checks in this lens that found nothing wrong: 28.

### Business rules and time handling

| # | Finding | Reviewer | Verdict | Verifier |
|---:|---|---|---|---|
| 1 | Overlap rule is check-then-write, not atomic: concurrent POST and concurrent PATCH requests produce double bookings | high | **confirmed** | high |
| 2 | Timestamps that leave the years 0000-9999 after UTC conversion break the string comparison: a booking with start AFTER end is accepted (create and update) and then blocks the whole equipment | medium | **confirmed** | medium |
| 3 | Accepted timestamp grammar is narrower than the contract says, and the 400 message does not say what is wrong | low | **confirmed** | low |

Checks in this lens that found nothing wrong: 21.

### Input validation and security

| # | Finding | Reviewer | Verdict | Verifier |
|---:|---|---|---|---|
| 1 | Timestamps near year 9999 / 0000 roll over to a non-contract format and break ordering, validation and PATCH | medium | **confirmed** | medium |
| 2 | No maximum length on equipmentId, borrowerName or purpose: multi-megabyte values are stored and echoed back | medium | **confirmed** | low |
| 3 | Text fields are silently trimmed, which the contract does not mention | low | not-a-defect | low |
| 4 | Invisible or ill-formed text passes the non-empty check; ill-formed Unicode is stored as different characters | low | not-a-defect | low |
| 5 | Valid ISO 8601 timestamps with more than 3 fractional digits are rejected with a misleading message | low | **confirmed** | low |
| 6 | Content-Type of the request is not checked although the contract states application/json | low | not-a-defect | low |
| 7 | A few error responses come from the runtime, not the app, and are not JSON (501, 500, 431 as text/plain) | low | not-a-defect | low |

Checks in this lens that found nothing wrong: 22.

### Data design and explainability

| # | Finding | Reviewer | Verdict | Verifier |
|---:|---|---|---|---|
| 1 | AI_LOG.md has no personal verification: 'What I verified myself' is a placeholder and all 5 checklist boxes are unticked | high | **confirmed** | high |
| 2 | Timestamps that normalise outside years 0000-9999 are stored in a different format ('+010000-...', '-000001-...'): a valid range is rejected with a false 400 and the list order breaks | medium | **confirmed** | low |
| 3 | SCHEMA.md overstates what the CHECK constraint guarantees: the database compares text, does not enforce the timestamp format, and accepts empty strings | medium | not-a-defect | low |
| 4 | PRIMARY KEY columns accept NULL in SQLite/D1: two equipment rows and a booking with id NULL were inserted | low | **confirmed** | low |
| 5 | The no-overlap rule exists only in API code as two separate statements (SELECT, then INSERT/UPDATE); the database itself accepts overlapping rows and SCHEMA.md does not say so | low | not-a-defect | low |
| 6 | Hardest part to explain: the 120-character timestamp regex and the two-step date check in parseTimestamp | medium | not-a-defect | low |
| 7 | Overlap query is harder to explain than necessary: numbered placeholders used out of order plus `id IS NOT ?4` with a null; SCHEMA.md documents a different query text | medium | **confirmed** | low |
| 8 | TypeScript idioms and duplicated field lists that the student may be asked to justify | low | not-a-defect | low |
| 9 | Unreachable branch: HTTPException is imported and handled, but nothing in this app can throw it | low | not-a-defect | low |
| 10 | Timestamp rules that the contract does not state: more than 3 fractional digits is rejected, seconds are optional, and the 400 message says 'is required' for a value that was sent | low | **confirmed** | low |
| 11 | Two small contract/behaviour mismatches: V5 says PATCH must 'change' a field but a no-op PATCH succeeds, and silent trimming of text fields is undocumented | low | **confirmed** | low |

Checks in this lens that found nothing wrong: 24.

### Clean-checkout run and completeness

| # | Finding | Reviewer | Verdict | Verifier |
|---:|---|---|---|---|
| 1 | AI_LOG.md has no record of the student's own verification (placeholder text and five unchecked boxes) | high | **confirmed** | high |
| 2 | README states Node.js 20 is enough, but the pinned wrangler refuses to run below Node 22 | medium | **confirmed** | medium |
| 3 | README's PowerShell advice does not work: the POST example returns 400 in Windows PowerShell 5.1 and breaks on the backslash line continuations in PowerShell 7 | medium | **confirmed** | medium |
| 4 | If the database step is skipped, or .wrangler/state is deleted as the README suggests, every endpoint answers 500 "Internal server error" with no hint | medium | **confirmed** | medium |
| 5 | Timestamps are not always stored in the one fixed format the documents promise; a valid interval near a year boundary is rejected with 400 | medium | **confirmed** | low |
| 6 | README does not mention the npm 12 "install scripts blocked" warning that every fresh install prints | low | not-a-defect | low |
| 7 | README "Try it" shows no expected results, and its POST example returns 409 the second time it is run | low | not-a-defect | low |
| 8 | The documented Base API URL itself answers 404 | low | not-a-defect | low |
| 9 | Rule V5 says PATCH must "change" a field, but a PATCH that changes nothing returns 200 and bumps updatedAt | low | not-a-defect | low |
| 10 | The claim "20 curl requests ... all returned the status code the contract states" cannot be checked from the repository | low | not-a-defect | low |
| 11 | The missing starter repository, curl_test_guide.md and quality_gate.md are noted only in AI_LOG.md, not among the stated assumptions | low | not-a-defect | low |

Checks in this lens that found nothing wrong: 19.

**Totals: 40 findings reported, 21 confirmed, 19 not-a-defect or refuted.**

The confirmed findings are 11 distinct issues (several reviewers found the same ones). Where each one
is handled in the improvement record of `QUALITY_GATE_REVIEW.md`:

| Distinct issue | Found by | Row |
|---|---|---:|
| Overlap check and write were two statements (double booking under simultaneous requests) | rules | 1 |
| Timestamps outside years 0000–9999 after UTC conversion break the comparison | all five lenses | 2 |
| No maximum length on text fields | contract, security | 3 |
| README said Node.js 20 is enough | runnable (also found by the assistant at 13:50) | 4 |
| README PowerShell example fails | runnable | 5 |
| Bare `500` when the database is not set up / after deleting `.wrangler/state` | runnable | 5 |
| `PRIMARY KEY` columns accept `NULL` | design | 6 |
| Overlap query hard to explain; SCHEMA.md showed a different query text | design | 7 |
| Timestamp format stricter than the contract described | contract, rules, security, design | 8 |
| Wording of V5 / A6, trimming not documented | contract, design | 8 |
| AI_LOG.md had no personal verification | design, runnable | 9 |

## Run 2 — check of the fixes (14:28 to 14:31)

Two agents on a separate server instance (port 8788, own database) running the fixed code.

### Try to break the overlap guarantee

Findings: 0.

What the agent reported as checked and correct:

- Method: one Node script, <scratch>/verify-2051/t.mjs, run once as `node t.mjs 25` against http://localhost:8788/api only. It uses a keep-alive http.Agent with 8 sockets, warmed by 8 GET /equipment before each race, then sends the racing requests in the same tick. Every response was checked for 5xx and for error bodies that are n …
- Placeholder mapping by reading src/index.ts: writeValues returns [equipmentId, startAt, endAt, id, borrowerName, purpose, now] for ?1..?7. OVERLAP uses ?1 equipment, start_at < ?3 (new end), end_at > ?2 (new start), id <> ?4. INSERT_IF_FREE selects ?4, ?1, ?5, ?2, ?3, ?6, ?7, ?7 in the column order id, equipment_id, borrower_nam …
- Create stores every column correctly: POST {equipmentId eq-1, borrowerName ' Alice A ', startAt 2051-01-10T16:00:00+07:00, endAt 2051-01-10T11:00:00Z, purpose ' P one '} -> 201; GET by id returned equipmentId eq-1, borrowerName 'Alice A', startAt 2051-01-10T09:00:00.000Z, endAt 2051-01-10T11:00:00.000Z, purpose 'P one', same id, …
- Update stores every column correctly: PATCH with all five fields (eq-3, 'Bob B', 2051-02-01T08:15:00+07:00, 2051-02-01T03:45:30.5Z, 'full') -> 200; GET returned eq-3, 'Bob B', 2051-02-01T01:15:00.000Z, 2051-02-01T03:45:30.500Z, 'full', createdAt unchanged, updatedAt advanced.
- Sequential create matrix against an eq-1 booking 09:00-11:00: identical, contained, containing, partial overlap at start, partial overlap at end, same start shorter, same end shorter, and an overlapping interval written with +07:00 offset all returned 409 with {"error":"Equipment eq-1 is already booked from ... to ... (booking < …
- Sequential update matrix (PATCH startAt+endAt of another eq-1 booking): identical, contained, containing, partial at start, partial at end all 409; touching after the last booking (13-14) and touching before the first (06-07) both 200. GET afterwards showed the refused updates left the row untouched and the last accepted one app …
- Update does not conflict with itself: PATCH with its own startAt/endAt -> 200; shrinking inside its own slot -> 200; growing back to touch both neighbours -> 200; growing 1 minute into a neighbour -> 409 naming that neighbour.
- Purpose-only update: PATCH {purpose:'new purpose'} -> 200; GET showed purpose changed and equipmentId, borrowerName, startAt, endAt, createdAt unchanged.
- Moving a booking to other equipment: PATCH {equipmentId:'eq-2'} where eq-2 is busy at that time -> 409 naming the eq-2 booking, and GET showed the booking still on eq-1. PATCH {equipmentId:'eq-3'} (free) -> 200, after which a POST into the vacated eq-1 slot -> 201, and moving the booking back to eq-1 -> 409. PATCH {equipmentId:' …
- Concurrency, 8 identical POSTs for one free slot, 25 rounds: every round gave exactly one 201 and seven 409.
- Concurrency, 8 different mutually overlapping POST intervals on one equipment, 25 rounds: every round gave exactly one 201 and seven 409.
- Concurrency, two PATCHes moving two bookings of the same equipment onto overlapping slots, 25 rounds: every round 200 + 409. Variant with two bookings on eq-2 and eq-3 both moved to eq-1 at the same time, 25 rounds: every round 200 + 409.
- Concurrency, POST and PATCH targeting the same slot (send order alternated), 25 rounds: exactly one success each round (POST won 17 times with 201/409, PATCH won 8 times with 200/409).
- Concurrency, PATCH racing DELETE of the same booking (send order alternated), 25 rounds: DELETE was always 204; PATCH was 404 in 19 rounds and 200 in 6 rounds; no 5xx; GET afterwards was always 404. Two simultaneous DELETEs of one booking, 25 rounds: always 204 + 404.
- After the sequential block and after each of the 25 concurrency rounds, GET /bookings was fetched and every pair of bookings on the same equipment was compared: no overlapping pair was ever present.
- No 5xx and no non-JSON or wrongly shaped error body in any response of the run (script counter: 0).
- Cleanup: all bookings the script created were deleted; the final GET /bookings contained 0 bookings in 2051 or with borrowerName V2051. No request went to port 8787; nothing was written under D:/LAB_TEST_2.
- Not covered within the time budget: races between more than two PATCHes, two PATCHes of the same booking, higher parallelism than 8 connections, and the git diff against v1-snapshot (only the current src/index.ts, db/schema.sql and the exam brief were read; the curl guide was not opened).

### New validation rules and regression

Findings: 1.
- (low) Length limits count UTF-16 code units, so emoji count as 2 characters while the message says "characters" — handled by documenting it in API_CONTRACT.md A12.

What the agent reported as checked and correct:

- Curl guide steps 1-9, run with curl -i exactly as written against BASE_URL=http://localhost:8788/api: 1 GET /equipment 200 (eq-1, eq-2, eq-3); 2 GET /bookings 200 []; 3 POST 201 with Location header and id/equipmentId/borrowerName/startAt/endAt/purpose; 4 GET one 200; 5 PATCH full payload 200 (12:00-14:00, purpose updated); 6 PO …
- All remaining checks come from one Node script: <scratch>/verify-2052/t.mjs, output in out.txt in the same folder (about 200 requests). The script flags any 5xx and any 4xx body that is not exactly {"error": string} with Content-Type application/json: 0 flags.
- Year range on POST, lower boundary. To avoid storing bookings outside my year 2052, I used equipmentId "nope": 404 "Equipment not found: nope" means the timestamp passed validation, 400 means rejected. startAt 2000-01-01T00:00:00.000Z -> 404 (accepted); 1999-12-31T23:59:59.999Z -> 400; 2000-01-01T00:00:00+00:01 (UTC 1999) -> 400 …
- Year range on POST, upper boundary (same method): endAt 2100-12-31T23:59:59.999Z -> 404 (accepted); 2101-01-01T00:00:00.000Z -> 400; 2100-12-31T23:59:59-00:01 (UTC 2101) -> 400; 2101-01-01T00:59:00+01:00 (UTC 2100-12-31T23:59) -> 404 (accepted); 2101-01-01T01:00:00+01:00 (UTC 2101-01-01T00:00) -> 400.
- Far out-of-range years on POST all gave 400 with the timestamp rule message: 0000-01-01T00:00:00.000Z, 0000-01-01T00:00:00+23:59, 9999-12-31T23:59:59-23:59, endAt 9999-12-31T23:59:59.999Z, 1970-01-01T00:00:00.000Z, +002052-01-01T00:00:00.000Z.
- Year range on PATCH of a real 2052 booking: startAt 1999-12-31T23:59:59.999Z, startAt 2000-01-01T00:00:00+00:01, endAt 2101-01-01T00:00:00.000Z, endAt 2100-12-31T23:59:59-00:01, endAt 9999-12-31T23:59:59.999Z, startAt 0000-01-01T00:00:00Z all gave 400. A GET afterwards showed startAt, endAt and equipmentId unchanged. Boundary va …
- Fixed output form YYYY-MM-DDTHH:mm:ss.sssZ on stored 2052 bookings (regex-checked on startAt and endAt): POST 2052-01-10T16:00:00+07:00 / 2052-01-10T18:00+07:00 -> 201 with 2052-01-10T09:00:00.000Z / 2052-01-10T11:00:00.000Z; POST 2052-01-11T09:00Z / 2052-01-11T10:00:00.5Z -> ...09:00:00.000Z / ...10:00:00.500Z; POST 2052-01-12T …
- Malformed timestamps on POST all gave 400 with the timestamp rule message: 2052-02-30T09:00:00Z, 2052-13-01T09:00:00Z, '2052-01-01 09:00:00Z', 2052-01-01T09:00:00 (no zone), 2052-01-01, 2052-01-01T24:00:00Z, 2052-01-01T09:00:00.1234Z, offset +24:00, 2051-02-29T09:00:00Z, leading space, lower-case t/z, empty string, 'abc', number …
- Length limits with ASCII and Thai (U+0E01), POST (via "nope" equipment) and PATCH (real booking): borrowerName 100 -> accepted (PATCH 200, value returned intact, length 100), 101 -> 400 "borrowerName must be at most 100 characters"; purpose 500 -> accepted (PATCH 200, intact), 501 -> 400 "purpose must be at most 500 characters". …
- equipmentId length: 50 chars -> 404 Equipment not found (passed validation), 51 -> 400 "equipmentId must be at most 50 characters" on POST and PATCH; 50 and 51 Thai characters behave the same.
- Space padding: PATCH borrowerName = 3 spaces + 100 'b' + space/tab/newline -> 200, stored value is exactly the 100 'b' (trimmed); 101 'b' padded -> 400; POST purpose 500 padded -> passed validation, 501 padded -> 400; equipmentId 50 padded -> passed validation (error message shows the trimmed id), 51 padded -> 400; PATCH equipme …
- Messages: for each of equipmentId, borrowerName, startAt, endAt, purpose: field missing on POST -> 400 "<field> is required"; null on POST -> same; null on PATCH -> same; number or empty string -> 400 "<field> must be a non-empty string" for the text fields and "<field> must be an ISO 8601 date-time with a time zone between the …
- Body handling: POST {} -> 400 "equipmentId is required"; malformed JSON and empty body -> 400 "Request body must be valid JSON"; array, null, string bodies -> 400 "Request body must be a JSON object"; PATCH {} and PATCH {"foo":1} -> 400 "Provide at least one field to update: ..."; PATCH malformed / array -> 400.
- Overlap 409 on create (eq-2, existing 08:30-10:00Z on 2052-03-01): partial overlap, the same overlap written with a +07:00 offset, and a containing range all gave 409 naming the blocking booking. Adjacent booking starting exactly at 10:00Z -> 201. Same time on eq-3 -> 201.
- Overlap 409 on update: PATCH startAt of the adjacent booking into the other one -> 409; PATCH equipmentId eq-3 -> eq-2 at the same time -> 409; full-payload PATCH overlapping -> 409. Updating a booking's own time (self) -> 200, no false conflict.
- PATCH full payload (with Thai text and an emoji in borrowerName) -> 200 with all fields updated and text returned intact; partial PATCH {purpose} -> 200 with the other fields kept.
- start not before end: POST start == end -> 400; POST start == end expressed with different offsets (17:00+07:00 vs 10:00Z) -> 400; PATCH startAt equal to endAt -> 400; PATCH endAt before startAt -> 400; all "startAt must be before endAt".
- 404s, all JSON {"error":...} with application/json: unknown equipment on POST and on PATCH ("Equipment not found: eq-999"); unknown booking on GET, PATCH, DELETE ("Booking not found"); unknown routes GET /api/nope, POST /api/equipment, PUT /api/bookings/:id, DELETE /api/bookings ("Route not found: <METHOD> <path>"); second DELET …
- SQL-looking input treated as plain data: GET /bookings/' OR '1'='1 -> 404 Booking not found; POST equipmentId "eq-1' OR '1'='1" -> 404 Equipment not found.
- DELETE -> 204, empty body, no Content-Type header (seen with curl -i and with fetch).
- Cleanup: every booking I created (the 2026-10-20 guide booking and all 2052 bookings) was deleted; the final GET /bookings returned []. No request was sent to port 8787, nothing was written under D:/LAB_TEST_2, no process was started or stopped.
- Not done: (1) I did not store a real booking at exactly year 2000 or 2100, because of the private-year rule; boundary acceptance is shown only by validation passing (404 on unknown equipment), so the fixed-form output was confirmed for 2052 values only. (2) No concurrent-request test of the overlap check. (3) I read the current …

## Run 3 — final consistency check (14:39 to 14:42)

Documents versus code and behaviour: 0 problems, 17 groups of statements verified.

Completeness and internal consistency of the records: 10 problems, all corrected in the commit that added this file:

- (low) `evidence/README.md`: The curl version stated does not match the curl installed in Git Bash on this machine.
- (medium) `evidence/race_before_fix.txt`: The hash given for the snapshot differs from the one used everywhere else (`0c407c0` in QUALITY_GATE_REVIEW.md, AI_LOG.md and extreme_year_before_fix.txt). A marker comparing hashes will see two different values for the same snapshot.
- (medium) `AI_LOG.md`: The extreme-year 'before' evidence was recorded after the fix was already committed, not before the code was changed. The same ordering is implied in QUALITY_GATE_REVIEW.md step 2 ('"before" evidence was recorded on the snapshot code').
- (low) `AI_LOG.md`: The end time is later than the commit that contains this log, so the log states a time that had not yet happened when it was committed.
- (low) `QUALITY_GATE_REVIEW.md`: 14:16 is not the file time of quality_gate.md. AI_LOG.md entry 4 repeats it ("`quality_gate.md` and `curl_test_guide.md` were added to the exam folder at 14:16").
- (medium) `QUALITY_GATE_REVIEW.md`: No evidence file supports these numbers. The same applies to '40 reported, 21 confirmed, which are 11 distinct issues' and to AI_LOG.md entry 5 'about 200 requests and six kinds of simultaneous-request tests'. The record's opening line says 'every fix has evid …
- (low) `QUALITY_GATE_REVIEW.md`: The finding has no 'before' evidence, although the record says every finding was reproduced before it was fixed. Only the after state is shown.
- (medium) `QUALITY_GATE_REVIEW.md`: The clean-clone claim points to evidence/README.md, which contains nothing about a clean clone. A file that would support it exists on disk but is not committed and not referenced.
- (low) `QUALITY_GATE_REVIEW.md`: 'Manual' can be read as checks done by the student by hand; the log attributes them to the AI.
- (low) `QUALITY_GATE_REVIEW.md`: This row is presented as a Quality Gate improvement, but it was found and fixed before the Quality Gate checklist was available, by the record's own timeline. The rubric asks for improvements 'clearly connected to the Quality Gate'.
