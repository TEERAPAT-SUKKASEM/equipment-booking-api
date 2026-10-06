import { Hono } from 'hono'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

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
  return date.toISOString()
}

function validateBooking(data: Record<string, unknown>): BookingInput {
  const text = {} as Record<'equipmentId' | 'borrowerName' | 'purpose', string>
  for (const field of ['equipmentId', 'borrowerName', 'purpose'] as const) {
    const value = data[field]
    if (typeof value !== 'string' || value.trim() === '') {
      throw new ApiError(400, `${field} is required and must be a non-empty string`)
    }
    text[field] = value.trim()
  }

  const example = 'an ISO 8601 date-time with a time zone, e.g. 2026-10-20T09:00:00.000Z'
  const startAt = parseTimestamp(data.startAt)
  if (!startAt) throw new ApiError(400, `startAt is required and must be ${example}`)
  const endAt = parseTimestamp(data.endAt)
  if (!endAt) throw new ApiError(400, `endAt is required and must be ${example}`)
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

// ---------- database helpers (all values are bound as parameters, never concatenated into SQL) ----------

async function findBooking(db: D1Database, id: string): Promise<Booking | null> {
  return db.prepare(`${SELECT_BOOKING} WHERE id = ?`).bind(id).first<Booking>()
}

async function requireBooking(db: D1Database, id: string): Promise<Booking> {
  const booking = await findBooking(db, id)
  if (!booking) throw new ApiError(404, `Booking not found: ${id}`)
  return booking
}

async function requireEquipment(db: D1Database, equipmentId: string): Promise<void> {
  const equipment = await db.prepare('SELECT id FROM equipment WHERE id = ?').bind(equipmentId).first()
  if (!equipment) throw new ApiError(404, `Equipment not found: ${equipmentId}`)
}

// A booking occupies [startAt, endAt). Two bookings of the same equipment overlap when each one
// starts before the other one ends. On update, the booking itself is excluded from the comparison.
async function requireNoOverlap(db: D1Database, input: BookingInput, excludeId: string | null): Promise<void> {
  const conflict = await db
    .prepare(
      `SELECT id, start_at AS startAt, end_at AS endAt
       FROM bookings
       WHERE equipment_id = ?1 AND start_at < ?3 AND end_at > ?2 AND id IS NOT ?4
       LIMIT 1`
    )
    .bind(input.equipmentId, input.startAt, input.endAt, excludeId)
    .first<{ id: string; startAt: string; endAt: string }>()
  if (conflict) {
    throw new ApiError(
      409,
      `Equipment ${input.equipmentId} is already booked from ${conflict.startAt} to ${conflict.endAt} (booking ${conflict.id})`
    )
  }
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
  await requireNoOverlap(db, input, null)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO bookings (id, equipment_id, borrower_name, start_at, end_at, purpose, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, input.equipmentId, input.borrowerName, input.startAt, input.endAt, input.purpose, now, now)
    .run()

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
  await requireNoOverlap(db, input, id)

  await db
    .prepare(
      `UPDATE bookings
       SET equipment_id = ?, borrower_name = ?, start_at = ?, end_at = ?, purpose = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(input.equipmentId, input.borrowerName, input.startAt, input.endAt, input.purpose, new Date().toISOString(), id)
    .run()

  return c.json(await requireBooking(db, id))
})

app.delete('/bookings/:id', async (c) => {
  const id = c.req.param('id')
  const result = await c.env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) throw new ApiError(404, `Booking not found: ${id}`)
  return c.body(null, 204)
})

// ---------- error handling: every error response is JSON { "error": "..." } ----------

app.notFound((c) => c.json({ error: `Route not found: ${c.req.method} ${c.req.path}` }, 404))

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: err.message }, err.status)
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
