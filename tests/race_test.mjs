// Concurrency test: several requests that want the same free slot arrive at the same moment.
// The rule "the same equipment cannot be booked for overlapping times" means exactly ONE may win.
//
// Usage (API must be running):  node tests/race_test.mjs
//                               BASE_URL=http://localhost:8787/api node tests/race_test.mjs
// Uses equipment eq-3 in the year 2027 only and deletes every booking it creates.

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8787/api'
const ROUNDS = 30
const PARALLEL = 20
const JSON_HEADERS = { 'Content-Type': 'application/json' }

const slot = (round, hour) => {
  const month = round < 28 ? '11' : '12'
  const day = String((round % 28) + 1).padStart(2, '0')
  return `2027-${month}-${day}T${String(hour).padStart(2, '0')}:00:00.000Z`
}
const booking = (round, startHour, purpose) => ({
  equipmentId: 'eq-3',
  borrowerName: 'Race test',
  startAt: slot(round, startHour),
  endAt: slot(round, startHour + 1),
  purpose,
})
const post = (body) => fetch(`${BASE_URL}/bookings`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })
const patch = (id, body) =>
  fetch(`${BASE_URL}/bookings/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) })
const remove = (id) => fetch(`${BASE_URL}/bookings/${id}`, { method: 'DELETE' })
// Open the connections first, so that the real requests leave at the same moment.
const warmUp = () =>
  Promise.all(Array.from({ length: PARALLEL }, () => fetch(`${BASE_URL}/equipment`).then((r) => r.arrayBuffer())))
const count = (statuses) => JSON.stringify(Object.fromEntries([...new Set(statuses)].sort().map((s) => [s, statuses.filter((x) => x === s).length])))

console.log('Concurrency test - Base API URL: ' + BASE_URL)
let failedRounds = 0

console.log(`\nCREATE: ${PARALLEL} identical POST requests for one free slot, ${ROUNDS} rounds (expect exactly one 201 per round)`)
for (let round = 0; round < ROUNDS; round++) {
  await warmUp()
  const responses = await Promise.all(Array.from({ length: PARALLEL }, () => post(booking(round, 9, 'create race'))))
  const statuses = responses.map((r) => r.status)
  const created = []
  for (const r of responses) {
    const body = await r.json()
    if (r.status === 201) created.push(body.id)
  }
  const ok = created.length === 1 && statuses.every((s) => s === 201 || s === 409)
  if (!ok) failedRounds++
  if (!ok || round === 0) console.log(`  round ${round + 1}: ${count(statuses)} ${ok ? 'ok' : '<-- DOUBLE BOOKING'}`)
  await Promise.all(created.map(remove))
}

console.log(`\nUPDATE: two bookings are moved onto the same free slot at the same moment, ${ROUNDS} rounds (expect one 200 and one 409)`)
for (let round = 0; round < ROUNDS; round++) {
  const first = await (await post(booking(round, 13, 'update race A'))).json()
  const second = await (await post(booking(round, 15, 'update race B'))).json()
  await warmUp()
  const target = { startAt: slot(round, 17), endAt: slot(round, 18) }
  const responses = await Promise.all([patch(first.id, target), patch(second.id, target)])
  const statuses = responses.map((r) => r.status)
  for (const r of responses) await r.arrayBuffer()
  const ok = statuses.filter((s) => s === 200).length === 1 && statuses.filter((s) => s === 409).length === 1
  if (!ok) failedRounds++
  if (!ok || round === 0) console.log(`  round ${round + 1}: ${count(statuses)} ${ok ? 'ok' : '<-- DOUBLE BOOKING'}`)
  await Promise.all([remove(first.id), remove(second.id)])
}

console.log(`\nResult: ${failedRounds === 0 ? 'PASS' : 'FAIL'} - ${failedRounds} of ${ROUNDS * 2} rounds produced a double booking`)
process.exit(failedRounds === 0 ? 0 : 1)
