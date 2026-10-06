# Test Evidence

- **Base API URLs used for testing:** `https://equipment-booking-api.skywatch.workers.dev/api` (deployed on
  Cloudflare Workers with a remote D1 database) and `http://localhost:8787/api` (local `wrangler dev`).
  Every evidence file states the URL it was run against; the files recorded on localhost were not rewritten.
- **HTTP client:** `curl` 8.18.0 in Git Bash on Windows 11 for the test scripts; `curl.exe` 8.21.0 for the
  PowerShell example; the concurrency test uses Node.js `fetch`
- **Code tested:** commit `e621a20` (`src/` and `db/` have not changed since; the clean-clone run used commit
  `e094dfb`, and later commits change documents and evidence only), local D1 database reset with `npm run db:reset` before the runs
- **Date:** 2026-10-06
- **Hashes:** the first version is git tag `v1-snapshot`, which points to commit `0c407c0`. The header of
  `race_before_fix.txt` shows `9e33d01`: that is the id of the annotated tag object itself, not another commit.

## Summary of the results

| Run | File | Result |
|---|---|---|
| **Deployed API:** instructor's cURL Quick Test Guide, steps 1–9, full `curl -i` output | [deployed_curl_guide_run.txt](deployed_curl_guide_run.txt) | 9 of 9 match the expected status |
| **Deployed API:** own test script, 25 cases | [deployed_curl_tests_output.txt](deployed_curl_tests_output.txt) | 25 passed, 0 failed |
| **Deployed API:** concurrency test | [deployed_race_test.txt](deployed_race_test.txt) | PASS: 0 of 60 rounds double-booked |
| Instructor's cURL Quick Test Guide, steps 1–9, full `curl -i` output | [curl_guide_run.txt](curl_guide_run.txt) | 9 of 9 match the expected status |
| Own test script, 25 cases (CRUD + 400 + 404 + 409) | [curl_tests_output.txt](curl_tests_output.txt) | 25 passed, 0 failed |
| Concurrency test on the **first version** (`v1-snapshot`) | [race_before_fix.txt](race_before_fix.txt) | FAIL: 3 of 60 rounds double-booked |
| Concurrency test **after the fix** | [race_after_fix.txt](race_after_fix.txt) | PASS: 0 of 60 rounds |
| Extreme-year booking on the **first version** | [extreme_year_before_fix.txt](extreme_year_before_fix.txt) | Defect: start after end accepted (`201`); after the fix it is a `400` (case 16) |
| Other checks after the fixes (new validation rules, PowerShell example, schema, missing database) | [other_checks.txt](other_checks.txt) | all as expected |
| Clean clone: `git clone`, then the README commands, then all three test scripts (on port 8790) | [clean_clone_run.txt](clean_clone_run.txt) | install and setup exit 0; 9 of 9, 25 of 25, concurrency PASS |
| What the AI reviewers reported, with the verifier's verdict for each finding | [ai_review_summary.md](ai_review_summary.md) | 40 reported, 21 confirmed (11 distinct issues) |
| Final checks from PowerShell on commit `74b0f9a`, run by the AI assistant at the student's request | [final_checks_by_ai.txt](final_checks_by_ai.txt) | `200`, `201`, `409`, `404` as expected |
| Commit history with times, and the first-version snapshot (`v1-snapshot`) | [git_history.txt](git_history.txt) | design 13:39, first version 13:42, fixes from 13:50 |

Every error response in these files is JSON of the form `{ "error": "..." }`.

## Coverage required by the guide

| Required case | Where |
|---|---|
| Create | guide step 3; cases 2, 7, 8 |
| Read | guide steps 1, 2, 4; cases 1, 3, 4 |
| Update | guide step 5 (full payload); cases 5, 10 (partial) |
| Delete | guide step 9; cases 21, 24, 25 |
| Invalid input → 400 | guide step 6; cases 12–17 |
| Not found → 404 | guide step 8; cases 18–20, 22, 23 |
| Booking conflict → 409 | guide step 7 (create); cases 6 (create), 9 and 11 (update) |

## The 25 cases of `tests/curl_tests.sh`

Generated from [curl_tests_output.txt](curl_tests_output.txt), which contains each `curl` command and the full response.

| # | Case | Expected | Actual | Result |
|---:|---|---:|---:|---|
| 1 | List equipment | 200 | 200 | PASS |
| 2 | Create a booking | 201 | 201 | PASS |
| 3 | List bookings | 200 | 200 | PASS |
| 4 | Get one booking | 200 | 200 | PASS |
| 5 | Update one field (partial PATCH) | 200 | 200 | PASS |
| 6 | Create an overlapping booking for the same equipment | 409 | 409 | PASS |
| 7 | Create a back-to-back booking (starts when the first one ends) | 201 | 201 | PASS |
| 8 | Create the same time slot on different equipment | 201 | 201 | PASS |
| 9 | Update a booking so that it overlaps another one | 409 | 409 | PASS |
| 10 | Update a booking inside its own time range (no conflict with itself) | 200 | 200 | PASS |
| 11 | Move a booking to equipment that is busy at that time | 409 | 409 | PASS |
| 12 | Create with startAt after endAt | 400 | 400 | PASS |
| 13 | Create without borrowerName | 400 | 400 | PASS |
| 14 | Create with a timestamp that is not ISO 8601 | 400 | 400 | PASS |
| 15 | Create with malformed JSON | 400 | 400 | PASS |
| 16 | Create with a timestamp outside the supported years 2000-2100 (this one is year 10000 in UTC) | 400 | 400 | PASS |
| 17 | Create with a borrowerName longer than 100 characters | 400 | 400 | PASS |
| 18 | Create for equipment that does not exist | 404 | 404 | PASS |
| 19 | Get a booking that does not exist | 404 | 404 | PASS |
| 20 | Update a booking that does not exist | 404 | 404 | PASS |
| 21 | Delete a booking | 204 | 204 | PASS |
| 22 | Get the deleted booking | 404 | 404 | PASS |
| 23 | Delete the same booking again | 404 | 404 | PASS |
| 24 | Clean up: delete the second booking | 204 | 204 | PASS |
| 25 | Clean up: delete the third booking | 204 | 204 | PASS |

## Run the tests again

```bash
npm run db:reset             # clean database (the server may keep running)
bash tests/curl_guide.sh     # 9 guide steps
bash tests/curl_tests.sh     # 25 cases
node tests/race_test.mjs     # concurrency
```
