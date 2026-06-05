# Manual API Test Scenarios

Start the backend:

```bash
pnpm dev
```

Base URL: `http://localhost:3001`

To exercise the connected frontend, keep the backend running and start the UI in a second terminal:

```bash
pnpm frontend:dev
```

Open `http://localhost:3000`. By default, the browser calls `http://localhost:3001` through `NEXT_PUBLIC_TIME_OFF_API_BASE_URL`.

Reset data before a manual pass:

```bash
curl -X POST http://localhost:3001/admin/reset
```

## Seed State

- Avery Johnson, New York: 10 available, 0 pending.
- Avery Johnson, London: 4 available, 0 pending.
- Mina Patel, Remote: 14 available, 2 pending.
- One seeded Mina Patel request with status `pending`.

## Scenario 1: Batch And Cell Reads

```bash
curl http://localhost:3001/hcm/balances
curl "http://localhost:3001/hcm/balance?employeeId=emp-1001&locationId=nyc"
```

Expected:

- Batch endpoint returns all three balance rows and an expensive-read warning.
- Cell endpoint returns Avery/New York with 10 available and HCM version 7.

## Scenario 2: Valid Employee Submission

```bash
curl -X POST http://localhost:3001/time-off/requests \
  -H "content-type: application/json" \
  -d '{
    "employeeId": "emp-1001",
    "locationId": "nyc",
    "days": 2,
    "startsOn": "2026-05-04",
    "endsOn": "2026-05-05",
    "reason": "Recharge"
  }'
```

Expected:

- HTTP 202.
- Request status is `pending`.
- `balanceHeld` is `true`.
- New York moves to 8 available, 2 pending.
- The request is not approved.

## Scenario 3: Manager Approval

Use the request ID from Scenario 2:

```bash
curl -X POST http://localhost:3001/time-off/requests/REQUEST_ID/decision \
  -H "content-type: application/json" \
  -d '{ "managerId": "mgr-3001", "decision": "approve" }'
```

Expected:

- Request status becomes `approved`.
- `balanceHeld` becomes `false`.
- New York remains 8 available and moves to 0 pending.

## Scenario 4: Manager Denial

Submit another small request, then deny it:

```bash
curl -X POST http://localhost:3001/time-off/requests/REQUEST_ID/decision \
  -H "content-type: application/json" \
  -d '{ "managerId": "mgr-3001", "decision": "deny" }'
```

Expected:

- Request status becomes `denied`.
- Held days are released back to available.

## Scenario 5: Insufficient Balance

```bash
curl -X POST http://localhost:3001/time-off/requests \
  -H "content-type: application/json" \
  -d '{
    "employeeId": "emp-1001",
    "locationId": "london",
    "days": 20,
    "startsOn": "2026-06-01",
    "endsOn": "2026-06-02",
    "reason": "Long trip"
  }'
```

Expected:

- HTTP 409.
- London remains 4 available, 0 pending.
- No approved request is created.

## Scenario 6: Silent HCM Success

```bash
curl -X POST http://localhost:3001/time-off/requests \
  -H "content-type: application/json" \
  -d '{
    "employeeId": "emp-1001",
    "locationId": "nyc",
    "days": 1,
    "startsOn": "2026-06-01",
    "endsOn": "2026-06-01",
    "reason": "Errand",
    "mode": "silent_wrong"
  }'
```

Expected:

- HTTP 202 with a warning.
- Request status is `needs_review`.
- `balanceHeld` is `false`.
- New York balance does not decrease.

## Scenario 7: Manager Approval Conflict

Submit a normal request, then approve with conflict mode:

```bash
curl -X POST http://localhost:3001/time-off/requests/REQUEST_ID/decision \
  -H "content-type: application/json" \
  -d '{ "managerId": "mgr-3001", "decision": "approve", "mode": "conflict" }'
```

Expected:

- HTTP 409.
- Request status becomes `needs_review`.
- `balanceHeld` remains `true` so a later denial can release the hold.

## Scenario 8: Anniversary Bonus

```bash
curl -X POST http://localhost:3001/hcm/anniversary-bonus \
  -H "content-type: application/json" \
  -d '{ "employeeId": "emp-1001" }'
```

Expected:

- Avery's New York and London balances each gain 1 available day.
- Existing request statuses do not change.
