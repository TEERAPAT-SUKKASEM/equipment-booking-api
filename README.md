# Campus Equipment Booking API

Backend API for reserving shared faculty equipment (cameras, projectors, meeting rooms).
The same equipment cannot be booked for overlapping times.

- **Stack:** TypeScript, [Hono](https://hono.dev), Cloudflare Workers runtime (`wrangler dev`), local D1 (SQLite)
- **Base API URL:** `http://localhost:8787/api`
- **Contract:** [API_CONTRACT.md](API_CONTRACT.md) · **Data model / ERD:** [SCHEMA.md](SCHEMA.md) · **AI log:** [AI_LOG.md](AI_LOG.md)

## Run it

Requires Node.js 22 or newer (wrangler 4 does not run on older versions; developed on Node 24.18) and npm.

```bash
npm install        # install hono, wrangler, typescript
npm run db:setup   # create the tables and seed 3 equipment records in the local D1 database
npm run dev        # start the API on http://localhost:8787
```

`npm run db:setup` is safe to run again: it only creates what is missing.
The local database is stored in `.wrangler/state/` (delete that folder to start from an empty database).

## Try it

```bash
curl -i http://localhost:8787/api/equipment

curl -i -X POST http://localhost:8787/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-20T09:00:00.000Z","endAt":"2026-10-20T11:00:00.000Z","purpose":"Class presentation"}'
```

On Windows PowerShell use `curl.exe` instead of `curl`, or run the commands in Git Bash.

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
src/index.ts      the whole API: validation, SQL (parameter binding only), routes, error handling
db/schema.sql     tables, constraints, index and seed data
API_CONTRACT.md   endpoints, payloads, status codes, assumptions
SCHEMA.md         ERD and data-model decisions
AI_LOG.md         how AI was used and what was verified
```
