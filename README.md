# Campus Equipment Booking API

Backend API for reserving shared faculty equipment (cameras, projectors, meeting rooms).
The same equipment cannot be booked for overlapping times.

- **Stack:** TypeScript, [Hono](https://hono.dev), Cloudflare Workers runtime (`wrangler dev`), local D1 (SQLite)
- **Base API URL:** `http://localhost:8787/api`

| Document | Content |
|---|---|
| [API_CONTRACT.md](API_CONTRACT.md) | Endpoints, payloads, status codes and why, assumptions |
| [SCHEMA.md](SCHEMA.md) | ERD, tables, constraints, how the overlap rule is enforced |
| [evidence/README.md](evidence/README.md) | Test results (curl) and the Base API URL used |
| [QUALITY_GATE_REVIEW.md](QUALITY_GATE_REVIEW.md) | Findings after the first version, fixes and evidence |
| [AI_LOG.md](AI_LOG.md) | How AI was used and what was verified |

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

bash / Git Bash:

```bash
curl -i http://localhost:8787/api/equipment

curl -i -X POST http://localhost:8787/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-20T09:00:00.000Z","endAt":"2026-10-20T11:00:00.000Z","purpose":"Class presentation"}'
```

PowerShell (quotes inside `-d '...'` are not passed on reliably, so the body is read from a file; note `curl.exe`, not `curl`):

```powershell
curl.exe -i http://localhost:8787/api/equipment
curl.exe -i -X POST http://localhost:8787/api/bookings -H "Content-Type: application/json" --data-binary "@examples/booking.json"
```

Expected: `200` with three equipment records, then `201` with the created booking.
Sending the same booking a second time returns `409`, because the slot is now taken.

## Test it

The API must be running. Start from a clean database so that the time slots used by the tests are free.
The scripts are bash scripts: run them in Git Bash (on Windows), macOS or Linux.

```bash
npm run db:reset
bash tests/curl_guide.sh     # the 9 steps of the instructor's cURL Quick Test Guide
bash tests/curl_tests.sh     # 25 cases: CRUD, 400, 404, 409 (prints PASS/FAIL per case)
node tests/race_test.mjs     # simultaneous requests for one slot: only one may win
```

Recorded results are in [evidence/](evidence/README.md).

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
