import { Hono } from 'hono'
import type { Context } from 'hono'

type Bindings = { DB: D1Database }
type AppContext = Context<{ Bindings: Bindings }>

type BookingInput = {
  equipmentId: string
  borrowerName: string
  startAt: string
  endAt: string
  purpose: string
}

type Booking = BookingInput & { id: string; createdAt: string; updatedAt: string }

const BOOKING_FIELDS = ['equipmentId', 'borrowerName', 'startAt', 'endAt', 'purpose'] as const

// Maximum length of each text field, in characters.
const TEXT_LIMITS = { equipmentId: 50, borrowerName: 100, purpose: 500 } as const

// Every expected failure is thrown as an ApiError and turned into { "error": ... } in one place (app.onError).
class ApiError extends Error {
  constructor(
    public status: 400 | 404 | 409,
    message: string
  ) {
    super(message)
  }
}

// ---------- validation ----------

// ISO 8601 date-time with an explicit offset, e.g. 2026-10-20T09:00:00.000Z or 2026-10-20T16:00:00+07:00
const ISO_DATE_TIME =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/
const MIN_YEAR = 2000
const MAX_YEAR = 2100
const TIMESTAMP_RULE = `must be an ISO 8601 date-time with a time zone between the years ${MIN_YEAR} and ${MAX_YEAR}, e.g. 2026-10-20T09:00:00.000Z`

// Returns the timestamp normalised to UTC (YYYY-MM-DDTHH:mm:ss.sssZ), or null when it is not valid.
// One fixed format means that comparing two stored strings is the same as comparing the two moments in time.
function parseTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = ISO_DATE_TIME.exec(value)
  if (!match) return null

  // JavaScript silently turns 2026-02-30 into 2 March, so check that the calendar day really exists.
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const calendarDay = new Date(Date.UTC(year, month - 1, day))
  if (calendarDay.getUTCMonth() !== month - 1 || calendarDay.getUTCDate() !== day) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  // Outside 0000-9999 the UTC text gets a different shape ("+010000-..."), and string comparison would
  // no longer match time order. A booking system only needs a sensible range, so limit the year.
  const utcYear = date.getUTCFullYear()
  if (utcYear < MIN_YEAR || utcYear > MAX_YEAR) return null

  return date.toISOString()
}

function validateBooking(data: Record<string, unknown>): BookingInput {
  for (const field of BOOKING_FIELDS) {
    if (data[field] === undefined || data[field] === null) throw new ApiError(400, `${field} is required`)
  }

  const text = {} as Record<keyof typeof TEXT_LIMITS, string>
  for (const field of ['equipmentId', 'borrowerName', 'purpose'] as const) {
    const value = data[field]
    if (typeof value !== 'string' || value.trim() === '') {
      throw new ApiError(400, `${field} must be a non-empty string`)
    }
    if (value.trim().length > TEXT_LIMITS[field]) {
      throw new ApiError(400, `${field} must be at most ${TEXT_LIMITS[field]} characters`)
    }
    text[field] = value.trim()
  }

  const startAt = parseTimestamp(data.startAt)
  if (!startAt) throw new ApiError(400, `startAt ${TIMESTAMP_RULE}`)
  const endAt = parseTimestamp(data.endAt)
  if (!endAt) throw new ApiError(400, `endAt ${TIMESTAMP_RULE}`)
  if (startAt >= endAt) throw new ApiError(400, 'startAt must be before endAt')

  return { ...text, startAt, endAt }
}

async function readJsonObject(c: AppContext): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'Request body must be a JSON object')
  }
  return body as Record<string, unknown>
}

// ---------- SQL (constant text only; request values always go through .bind(), never into the SQL string) ----------

// The database uses snake_case columns; the API contract uses camelCase fields.
const SELECT_BOOKING = `
  SELECT id,
         equipment_id  AS equipmentId,
         borrower_name AS borrowerName,
         start_at      AS startAt,
         end_at        AS endAt,
         purpose,
         created_at    AS createdAt,
         updated_at    AS updatedAt
  FROM bookings`

// The overlap rule, written once and used by create, update and the conflict lookup.
//   ?1 = equipment id, ?2 = new start, ?3 = new end, ?4 = id of the booking being written
// A booking occupies [start, end). Another booking of the same equipment overlaps when it starts
// before the new one ends AND ends after the new one starts. A booking never conflicts with itself (?4).
const OVERLAP = `equipment_id = ?1 AND start_at < ?3 AND end_at > ?2 AND id <> ?4`

// Check and write are ONE statement: the row is written only if no overlapping booking exists.
// Two requests that arrive at the same moment therefore cannot both pass the check.
//   ?5 = borrower name, ?6 = purpose, ?7 = current time
const INSERT_IF_FREE = `
  INSERT INTO bookings (id, equipment_id, borrower_name, start_at, end_at, purpose, created_at, updated_at)
  SELECT ?4, ?1, ?5, ?2, ?3, ?6, ?7, ?7
  WHERE NOT EXISTS (SELECT 1 FROM bookings WHERE ${OVERLAP})`

const UPDATE_IF_FREE = `
  UPDATE bookings
  SET equipment_id = ?1, start_at = ?2, end_at = ?3, borrower_name = ?5, purpose = ?6, updated_at = ?7
  WHERE id = ?4
    AND NOT EXISTS (SELECT 1 FROM bookings WHERE ${OVERLAP})`

// The values for ?1 ... ?7, in that order, for INSERT_IF_FREE and UPDATE_IF_FREE.
function writeValues(input: BookingInput, id: string): string[] {
  const now = new Date().toISOString()
  return [input.equipmentId, input.startAt, input.endAt, id, input.borrowerName, input.purpose, now]
}

async function findBooking(db: D1Database, id: string): Promise<Booking | null> {
  return db.prepare(`${SELECT_BOOKING} WHERE id = ?`).bind(id).first<Booking>()
}

async function requireBooking(db: D1Database, id: string): Promise<Booking> {
  const booking = await findBooking(db, id)
  if (!booking) throw new ApiError(404, 'Booking not found')
  return booking
}

async function requireEquipment(db: D1Database, equipmentId: string): Promise<void> {
  const equipment = await db.prepare('SELECT id FROM equipment WHERE id = ?').bind(equipmentId).first()
  if (!equipment) throw new ApiError(404, `Equipment not found: ${equipmentId}`)
}

// Builds the 409 error after a write was refused, naming the booking that is in the way.
async function conflictError(db: D1Database, input: BookingInput, id: string): Promise<ApiError> {
  const other = await db
    .prepare(`SELECT id, start_at AS startAt, end_at AS endAt FROM bookings WHERE ${OVERLAP} LIMIT 1`)
    .bind(input.equipmentId, input.startAt, input.endAt, id)
    .first<{ id: string; startAt: string; endAt: string }>()
  const when = other ? `from ${other.startAt} to ${other.endAt} (booking ${other.id})` : 'at that time'
  return new ApiError(409, `Equipment ${input.equipmentId} is already booked ${when}`)
}

// ---------- routes ----------

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

app.get('/equipment', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, name, location FROM equipment ORDER BY id').all()
  return c.json(results)
})

app.get('/bookings', async (c) => {
  const { results } = await c.env.DB.prepare(`${SELECT_BOOKING} ORDER BY start_at, id`).all<Booking>()
  return c.json(results)
})

app.get('/bookings/:id', async (c) => {
  return c.json(await requireBooking(c.env.DB, c.req.param('id')))
})

app.post('/bookings', async (c) => {
  const db = c.env.DB
  const input = validateBooking(await readJsonObject(c))
  await requireEquipment(db, input.equipmentId)

  const id = crypto.randomUUID()
  const result = await db.prepare(INSERT_IF_FREE).bind(...writeValues(input, id)).run()
  if (result.meta.changes === 0) throw await conflictError(db, input, id)

  return c.json(await requireBooking(db, id), 201, { Location: `/api/bookings/${id}` })
})

app.patch('/bookings/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await readJsonObject(c)
  const existing = await requireBooking(db, id)

  // Partial update: fields that are not sent keep their current value, then the whole booking is validated again.
  const changes: Record<string, unknown> = {}
  for (const field of BOOKING_FIELDS) {
    if (body[field] !== undefined) changes[field] = body[field]
  }
  if (Object.keys(changes).length === 0) {
    throw new ApiError(400, `Provide at least one field to update: ${BOOKING_FIELDS.join(', ')}`)
  }
  const input = validateBooking({ ...existing, ...changes })
  await requireEquipment(db, input.equipmentId)

  const result = await db.prepare(UPDATE_IF_FREE).bind(...writeValues(input, id)).run()
  if (result.meta.changes === 0) {
    await requireBooking(db, id) // 404 if another request deleted this booking in the meantime
    throw await conflictError(db, input, id)
  }

  return c.json(await requireBooking(db, id))
})

app.delete('/bookings/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(c.req.param('id')).run()
  if (result.meta.changes === 0) throw new ApiError(404, 'Booking not found')
  return c.body(null, 204)
})

// ---------- error handling: every error response is JSON { "error": "..." } ----------

app.notFound((c) => c.json({ error: `Route not found: ${c.req.method} ${c.req.path}` }, 404))

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: err.message }, err.status)
  console.error(err)
  if (err.message.includes('no such table')) {
    return c.json({ error: 'Database is not set up. Run: npm run db:setup' }, 500)
  }
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
