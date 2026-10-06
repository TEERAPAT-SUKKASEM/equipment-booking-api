# AI Log

- **AI tool:** Claude Code (model: Claude Fable 5.1), used as a coding assistant inside this project folder.
- **Session:** https://claude.ai/code/session_01AHWQTxatdUg9X6kWryvKjq
- Times are local (UTC+7) on 2026-10-06.

The log separates three things: what I asked, what the AI did, and what **I** checked myself.
Checks that the AI ran are listed as AI checks, not as my own verification.

## Entries

### 1 — 13:33 · Read the task and build the first version

**Prompt:** "let's start the exam now you can explore files in this folder now"

**What the AI did**

- Read `exam_brief_en.md` and `rubric_en.md`; noticed that the starter repository, `curl_test_guide.md`
  and `quality_gate.md` were not in the folder, and chose a standard Hono + Cloudflare D1 project.
- Wrote the design first: `API_CONTRACT.md` (endpoints, status codes, 10 assumptions), `SCHEMA.md`
  and `db/schema.sql` — committed at 13:39 (`ff38e6a`) before any API code existed.
- Wrote `src/index.ts` (all routes, validation, overlap check, JSON error handling), `wrangler.jsonc`,
  `tsconfig.json`, `README.md`.

**AI checks (run by the AI, output seen in the session)**

- `npx tsc --noEmit` → exit code 0.
- `npm run db:setup` → 4 SQL commands executed successfully.
- 20 `curl` requests against `http://localhost:8787/api`: all returned the status code the contract
  states (200/201/204 for the happy paths; 400 for bad time order, missing field, malformed JSON and
  30 February; 404 for unknown booking, unknown equipment and unknown route; 409 for overlap on
  create and on update).

**What I used:** all of the above, as the first version (snapshot tag `v1-snapshot`).

**What I verified myself:** _to be filled in by me after running the checks below._

## My own verification checklist

- [ ] Read `src/index.ts` top to bottom and can explain each function.
- [ ] Ran `npm run dev` and `curl http://localhost:8787/api/equipment` myself.
- [ ] Created a booking, then tried an overlapping one and saw `409`.
- [ ] Confirmed every SQL statement uses `?` placeholders with `.bind(...)`.
- [ ] Agree with the assumptions in `API_CONTRACT.md` (especially A5: unknown `equipmentId` → 404).
