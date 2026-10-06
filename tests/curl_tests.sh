#!/usr/bin/env bash
# cURL test run for the Campus Equipment Booking API.
#
# Usage (API must be running: npm run dev):
#   bash tests/curl_tests.sh
#   BASE_URL=http://localhost:8787/api bash tests/curl_tests.sh
#
# Start from a clean database (npm run db:reset) so that the time slots used below are free.
# The script deletes every booking it creates, so it can be run again afterwards.

BASE_URL="${BASE_URL:-http://localhost:8787/api}"
PASS=0
FAIL=0
N=0
BODY=""
STATUS=""

# call <title> <expected status> <method> <path> [json body]
# Prints the curl command, the response status, content type and body, and PASS/FAIL.
call() {
  local title="$1" expected="$2" method="$3" path="$4" data="${5-}"
  local out meta
  N=$((N + 1))
  echo
  echo "### Case $N: $title (expect $expected)"
  if [ -n "$data" ]; then
    echo "\$ curl -X $method $BASE_URL$path -H 'Content-Type: application/json' -d '$data'"
    out=$(curl -s -X "$method" "$BASE_URL$path" -H 'Content-Type: application/json' -d "$data" -w '\n%{http_code} %{content_type}')
  else
    echo "\$ curl -X $method $BASE_URL$path"
    out=$(curl -s -X "$method" "$BASE_URL$path" -w '\n%{http_code} %{content_type}')
  fi
  meta=$(printf '%s' "$out" | tail -n 1)
  BODY=$(printf '%s' "$out" | sed '$d')
  STATUS=${meta%% *}
  echo "HTTP $STATUS ${meta#* }"
  if [ -n "$BODY" ]; then echo "$BODY"; fi
  if [ "$STATUS" = "$expected" ]; then
    PASS=$((PASS + 1))
    echo "=> PASS"
  else
    FAIL=$((FAIL + 1))
    echo "=> FAIL (expected $expected, got $STATUS)"
  fi
}

# Reads the "id" of the booking in the last response body.
last_id() { printf '%s' "$BODY" | sed -E 's/.*"id":"([^"]+)".*/\1/'; }

echo "Campus Equipment Booking API - cURL test run"
echo "Base API URL: $BASE_URL"
echo "Date:         $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Commit:       $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

# ---------- read + create ----------
call "List equipment" 200 GET /equipment

call "Create a booking" 201 POST /bookings \
  '{"equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-20T09:00:00.000Z","endAt":"2026-10-20T11:00:00.000Z","purpose":"Class presentation"}'
A=$(last_id)

call "List bookings" 200 GET /bookings
call "Get one booking" 200 GET "/bookings/$A"

# ---------- update ----------
call "Update one field (partial PATCH)" 200 PATCH "/bookings/$A" '{"purpose":"Final project presentation"}'

# ---------- overlap rule (409) ----------
call "Create an overlapping booking for the same equipment" 409 POST /bookings \
  '{"equipmentId":"eq-1","borrowerName":"Malee Srisuk","startAt":"2026-10-20T10:00:00.000Z","endAt":"2026-10-20T12:00:00.000Z","purpose":"Club meeting"}'

call "Create a back-to-back booking (starts when the first one ends)" 201 POST /bookings \
  '{"equipmentId":"eq-1","borrowerName":"Malee Srisuk","startAt":"2026-10-20T11:00:00.000Z","endAt":"2026-10-20T13:00:00.000Z","purpose":"Club meeting"}'
B=$(last_id)

call "Create the same time slot on different equipment" 201 POST /bookings \
  '{"equipmentId":"eq-2","borrowerName":"Anan Wongsa","startAt":"2026-10-20T09:00:00.000Z","endAt":"2026-10-20T11:00:00.000Z","purpose":"Photo shoot"}'
C=$(last_id)

call "Update a booking so that it overlaps another one" 409 PATCH "/bookings/$B" '{"startAt":"2026-10-20T10:30:00.000Z"}'
call "Update a booking inside its own time range (no conflict with itself)" 200 PATCH "/bookings/$A" '{"endAt":"2026-10-20T10:30:00.000Z"}'
call "Move a booking to equipment that is busy at that time" 409 PATCH "/bookings/$C" '{"equipmentId":"eq-1"}'

# ---------- validation (400) ----------
call "Create with startAt after endAt" 400 POST /bookings \
  '{"equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-21T11:00:00.000Z","endAt":"2026-10-21T09:00:00.000Z","purpose":"Wrong order"}'
call "Create without borrowerName" 400 POST /bookings \
  '{"equipmentId":"eq-1","startAt":"2026-10-21T09:00:00.000Z","endAt":"2026-10-21T11:00:00.000Z","purpose":"Missing field"}'
call "Create with a timestamp that is not ISO 8601" 400 POST /bookings \
  '{"equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"tomorrow morning","endAt":"2026-10-21T11:00:00.000Z","purpose":"Bad timestamp"}'
call "Create with malformed JSON" 400 POST /bookings '{"equipmentId": '

# ---------- not found (404) ----------
call "Create for equipment that does not exist" 404 POST /bookings \
  '{"equipmentId":"eq-999","borrowerName":"Somchai Jaidee","startAt":"2026-10-21T09:00:00.000Z","endAt":"2026-10-21T11:00:00.000Z","purpose":"Unknown equipment"}'
call "Get a booking that does not exist" 404 GET /bookings/does-not-exist
call "Update a booking that does not exist" 404 PATCH /bookings/does-not-exist '{"purpose":"Nothing to update"}'

# ---------- delete ----------
call "Delete a booking" 204 DELETE "/bookings/$A"
call "Get the deleted booking" 404 GET "/bookings/$A"
call "Delete the same booking again" 404 DELETE "/bookings/$A"

# ---------- clean up ----------
call "Clean up: delete the second booking" 204 DELETE "/bookings/$B"
call "Clean up: delete the third booking" 204 DELETE "/bookings/$C"

echo
echo "Summary: $PASS passed, $FAIL failed, $N cases - Base API URL: $BASE_URL"
[ "$FAIL" -eq 0 ]
