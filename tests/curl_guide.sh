#!/usr/bin/env bash
# The nine steps of the instructor's "cURL Quick Test Guide", in the same order and with the same payloads.
# The only difference: the booking id is read from the response of step 3 instead of being copied by hand.
#
# Usage (API must be running, database clean: npm run db:reset):
#   bash tests/curl_guide.sh

BASE_URL="${BASE_URL:-http://localhost:8787/api}"
PASS=0
FAIL=0
LAST_BODY=""

# run <expected status> <curl arguments...>
# Prints the full response (status line, headers, body) exactly as "curl -i" shows it.
run() {
  local expected="$1"
  shift
  local out status
  out=$(curl -s -i "$@" | tr -d '\r')
  echo "$out"
  LAST_BODY=$(printf '%s\n' "$out" | tail -n 1)
  status=$(printf '%s\n' "$out" | head -n 1 | awk '{print $2}')
  if [ "$status" = "$expected" ]; then
    PASS=$((PASS + 1))
    echo "=> PASS (expected $expected, got $status)"
  else
    FAIL=$((FAIL + 1))
    echo "=> FAIL (expected $expected, got $status)"
  fi
}

CREATE_BODY='{
    "equipmentId": "eq-1",
    "borrowerName": "Somchai Jaidee",
    "startAt": "2026-10-20T09:00:00.000Z",
    "endAt": "2026-10-20T11:00:00.000Z",
    "purpose": "Class presentation"
  }'
UPDATE_BODY='{
    "equipmentId": "eq-1",
    "borrowerName": "Somchai Jaidee",
    "startAt": "2026-10-20T12:00:00.000Z",
    "endAt": "2026-10-20T14:00:00.000Z",
    "purpose": "Updated class presentation"
  }'
INVALID_BODY='{
    "equipmentId": "eq-1",
    "borrowerName": "Somchai Jaidee",
    "startAt": "2026-10-21T11:00:00.000Z",
    "endAt": "2026-10-21T09:00:00.000Z",
    "purpose": "Invalid time range test"
  }'
CONFLICT_BODY='{
    "equipmentId": "eq-1",
    "borrowerName": "Suda Dee",
    "startAt": "2026-10-20T12:30:00.000Z",
    "endAt": "2026-10-20T13:30:00.000Z",
    "purpose": "Conflict test"
  }'

echo "cURL Quick Test Guide - run of all nine steps"
echo "BASE_URL=\"$BASE_URL\""
echo "Date:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

echo
echo "## 1. List equipment - expect 200"
echo "\$ curl -i \"\$BASE_URL/equipment\""
run 200 "$BASE_URL/equipment"

echo
echo "## 2. List bookings - expect 200"
echo "\$ curl -i \"\$BASE_URL/bookings\""
run 200 "$BASE_URL/bookings"

echo
echo "## 3. Create a booking - expect 201"
echo "\$ curl -i -X POST \"\$BASE_URL/bookings\" -H \"Content-Type: application/json\" -d '$CREATE_BODY'"
run 201 -X POST "$BASE_URL/bookings" -H "Content-Type: application/json" -d "$CREATE_BODY"
BOOKING_ID=$(printf '%s' "$LAST_BODY" | sed -E 's/.*"id":"([^"]+)".*/\1/')
echo "BOOKING_ID=\"$BOOKING_ID\""

echo
echo "## 4. Get one booking - expect 200"
echo "\$ curl -i \"\$BASE_URL/bookings/\$BOOKING_ID\""
run 200 "$BASE_URL/bookings/$BOOKING_ID"

echo
echo "## 5. Update a booking - expect 200"
echo "\$ curl -i -X PATCH \"\$BASE_URL/bookings/\$BOOKING_ID\" -H \"Content-Type: application/json\" -d '$UPDATE_BODY'"
run 200 -X PATCH "$BASE_URL/bookings/$BOOKING_ID" -H "Content-Type: application/json" -d "$UPDATE_BODY"

echo
echo "## 6. Invalid time range - expect 400"
echo "\$ curl -i -X POST \"\$BASE_URL/bookings\" -H \"Content-Type: application/json\" -d '$INVALID_BODY'"
run 400 -X POST "$BASE_URL/bookings" -H "Content-Type: application/json" -d "$INVALID_BODY"

echo
echo "## 7. Overlapping booking - expect 409"
echo "\$ curl -i -X POST \"\$BASE_URL/bookings\" -H \"Content-Type: application/json\" -d '$CONFLICT_BODY'"
run 409 -X POST "$BASE_URL/bookings" -H "Content-Type: application/json" -d "$CONFLICT_BODY"

echo
echo "## 8. Missing booking - expect 404"
echo "\$ curl -i \"\$BASE_URL/bookings/not-found\""
run 404 "$BASE_URL/bookings/not-found"

echo
echo "## 9. Delete a booking - expect 204"
echo "\$ curl -i -X DELETE \"\$BASE_URL/bookings/\$BOOKING_ID\""
run 204 -X DELETE "$BASE_URL/bookings/$BOOKING_ID"

echo
echo "Summary: $PASS passed, $FAIL failed, 9 steps - Base API URL: $BASE_URL"
[ "$FAIL" -eq 0 ]
