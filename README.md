# Campus Equipment Booking API

Backend API for reserving shared faculty equipment (cameras, projectors, meeting rooms).
The same equipment cannot be booked for overlapping times.

- **Stack:** TypeScript, [Hono](https://hono.dev), Cloudflare Workers with a D1 (SQLite) database; `wrangler dev` with a local D1 for development
- **Base API URL (deployed):** `https://equipment-booking-api.skywatch.workers.dev/api`
- **Base API URL (local development):** `http://localhost:8787/api`
- **Source:** https://github.com/TEERAPAT-SUKKASEM/equipment-booking-api

## Submission

| Requirement | Where |
|---|---|
| Link for the source code (GitHub) | https://github.com/TEERAPAT-SUKKASEM/equipment-booking-api |
| Link for the API (Cloudflare) | `https://equipment-booking-api.skywatch.workers.dev/api`, for example [/api/equipment](https://equipment-booking-api.skywatch.workers.dev/api/equipment) |
| Runnable source code and run instructions | `src/index.ts`, and [Run it](#run-it) below |
| API contract | [API_CONTRACT.md](API_CONTRACT.md): endpoints, payloads, status codes and why, assumptions |
| Brief schema or ERD | [SCHEMA.md](SCHEMA.md): ERD, tables, constraints, how the overlap rule is enforced |
| AI log | [AI_LOG.md](AI_LOG.md): how AI was used and what was verified |
| Quality Gate review | [QUALITY_GATE_REVIEW.md](QUALITY_GATE_REVIEW.md): findings after the first version, fixes and evidence |
| Evidence of test cases and the Base API URL used | [evidence/README.md](evidence/README.md): 9 guide steps and 25 cases, run against the deployed URL and against localhost |

## Run it

Requires Node.js 22 or newer (wrangler 4 does not run on older versions; developed on Node 24.18) and npm.

```bash
npm install        # install hono, wrangler, typescript
npm run db:setup   # create the tables and seed 3 equipment records in the local D1 database
npm run dev        # start the API on http://localhost:8787
```

These three commands are the same in PowerShell, cmd and bash. Notes:

- `npm run db:setup` is safe to run again: it only creates what is missing.
- `npm run db:reset` deletes **all** bookings and recreates the tables and seed data. It also works while the server is running.
- npm 12 prints a warning that the install scripts of `esbuild` and `workerd` were blocked. The project works without them.
- The local database is stored in `.wrangler/state/`.

**If every request answers `500`** with `Database is not set up. Run: npm run db:setup`, the tables do not exist yet
(for example after deleting `.wrangler/`). Run `npm run db:setup`; no restart is needed.

## Try it

The deployed API needs no installation. To try a local server instead, use `http://localhost:8787/api` as the base URL.

bash / Git Bash:

```bash
BASE_URL="https://equipment-booking-api.skywatch.workers.dev/api"

curl -i "$BASE_URL/equipment"

curl -i -X POST "$BASE_URL/bookings" \
  -H "Content-Type: application/json" \
  -d '{"equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-20T09:00:00.000Z","endAt":"2026-10-20T11:00:00.000Z","purpose":"Class presentation"}'
```

PowerShell (quotes inside `-d '...'` are not passed on reliably, so the body is read from a file; note `curl.exe`, not `curl`):

```powershell
$BASE_URL = "https://equipment-booking-api.skywatch.workers.dev/api"
curl.exe -i "$BASE_URL/equipment"
curl.exe -i -X POST "$BASE_URL/bookings" -H "Content-Type: application/json" --data-binary "@examples/booking.json"
```

Expected: `200` with three equipment records, then `201` with the created booking.
Sending the same booking a second time returns `409`, because the slot is now taken.
The deployed database is shared by everyone who has the URL: if somebody else already holds that slot, the
first `POST` returns `409` too. Delete that booking (`curl -X DELETE "$BASE_URL/bookings/<id>"`) or use another date.

## Deploy it

The API is deployed on Cloudflare Workers with a remote D1 database (id in `wrangler.jsonc`).

```bash
npx wrangler login
npx wrangler d1 create equipment-booking-db   # only for a new account: put the printed database_id into wrangler.jsonc
npm run db:setup:remote                       # create the tables and seed data in the deployed database
npm run deploy
```

`npm run dev` never touches the deployed database; local data stays in `.wrangler/state/`.

## Test it

The API must be running. Start from a clean database so that the time slots used by the tests are free.
The scripts are bash scripts: run them in Git Bash (on Windows), macOS or Linux.

```bash
npm run db:reset
bash tests/curl_guide.sh     # the 9 steps of the instructor's cURL Quick Test Guide
bash tests/curl_tests.sh     # 25 cases: CRUD, 400, 404, 409 (prints PASS/FAIL per case)
node tests/race_test.mjs     # simultaneous requests for one slot: only one may win
```

The scripts use the local server by default. To run them against the deployed API, set the base URL first:

```bash
BASE_URL="https://equipment-booking-api.skywatch.workers.dev/api" bash tests/curl_guide.sh
```

Recorded results, local and deployed, are in [evidence/](evidence/README.md).

## Endpoints

| Method | Path | Success | Errors |
|---|---|---:|---|
| `GET` | `/api/equipment` | 200 | – |
| `GET` | `/api/bookings` | 200 | – |
| `GET` | `/api/bookings/:id` | 200 | 404 |
| `POST` | `/api/bookings` | 201 | 400, 404, 409 |
| `PATCH` | `/api/bookings/:id` | 200 | 400, 404, 409 |
| `DELETE` | `/api/bookings/:id` | 204 | 404 |

Every error is JSON: `{ "error": "message" }`. Details and reasoning are in [API_CONTRACT.md](API_CONTRACT.md).

## Project layout

```
src/index.ts            the whole API: validation, SQL (parameter binding only), routes, error handling
db/schema.sql           tables, constraints, index and seed data
db/reset.sql            drops the tables (used by npm run db:reset)
examples/booking.json   sample request body
tests/curl_guide.sh     the instructor's nine curl steps
tests/curl_tests.sh     25 curl cases with expected status codes
tests/race_test.mjs     concurrency test for the overlap rule
evidence/               recorded output of the tests
```
