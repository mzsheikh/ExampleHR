# ExampleHR Time-Off Microservice

Backend-first implementation of the ExampleHR take-home assignment. The primary deliverable is now a NestJS REST microservice backed by SQLite that manages time-off balances, request submission, manager decisions, and mock HCM behavior.

The Next.js frontend remains in the repo and now calls the NestJS backend directly through `NEXT_PUBLIC_TIME_OFF_API_BASE_URL`.

## Stack

- NestJS REST API using JavaScript modules.
- SQLite persistence through Node 22's built-in `node:sqlite` module.
- Vitest unit tests for service rules and Supertest integration tests against the real NestJS HTTP app.
- Existing Next.js/Storybook UI wired to the NestJS API for local visualization.

## Run

Backend only:

```bash
pnpm install
pnpm dev
```

The microservice starts on `http://localhost:3001` by default.

Frontend plus backend:

```bash
# Terminal 1
pnpm dev

# Terminal 2
pnpm frontend:dev
```

The frontend starts on `http://localhost:3000` and calls the backend at `http://localhost:3001`.

Environment variables:

```bash
PORT=3001
TIME_OFF_DB_PATH=./data/examplehr.sqlite
CORS_ORIGIN=
NEXT_PUBLIC_TIME_OFF_API_BASE_URL=http://localhost:3001
```

Leave `CORS_ORIGIN` empty for local development, or set it to a comma-separated allowlist such as `http://localhost:3000,http://localhost:3002`.

## Test And Coverage

```bash
pnpm test
pnpm test:coverage
pnpm test:coverage:backend
pnpm lint
```

Current local verification:

- `pnpm test`: 19 tests passing.
- `pnpm test:coverage`: 90.41% statement coverage across the backend/reconciliation target.
- `pnpm test:coverage:backend`: 90.76% statement coverage across backend files only.
- `pnpm lint`: passing.

GitHub Actions runs lint, the full test suite, backend-only coverage, and uploads `coverage/backend` as the `backend-coverage-report` artifact.

## API Surface

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health check. |
| `GET` | `/hcm/balances` | Expensive batch HCM balance corpus read. |
| `GET` | `/hcm/balance?employeeId=&locationId=&mode=` | Authoritative per-employee/per-location HCM cell read. |
| `POST` | `/hcm/balance` | Mock HCM cell write with optional `availableDelta`, `pendingDelta`, and simulation `mode`. |
| `POST` | `/hcm/anniversary-bonus` | External HCM mutation that adds one day to an employee's balances. |
| `GET` | `/time-off/requests?status=` | List time-off requests. |
| `POST` | `/time-off/requests` | Submit an employee request as pending after authoritative balance verification. |
| `POST` | `/time-off/requests/:requestId/decision` | Manager approve/deny with decision-time HCM verification. |
| `POST` | `/admin/reset` | Reset local SQLite data to seed state. |

Supported HCM simulation modes:

- `normal`: authoritative read/write succeeds.
- `slow`: delays the HCM interaction.
- `conflict`: HCM rejects the operation.
- `invalid_dimension`: HCM no longer recognizes the employee/location cell.
- `silent_wrong`: HCM appears to succeed but read-after-write verification does not match.

## Seed Data

- Avery Johnson:
  - New York: 10 available, 0 pending.
  - London: 4 available, 0 pending.
- Mina Patel:
  - Remote: 14 available, 2 pending.
  - One seeded pending request for manager review.

## Example Requests

Submit a request:

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

Approve after decision-time verification:

```bash
curl -X POST http://localhost:3001/time-off/requests/REQUEST_ID/decision \
  -H "content-type: application/json" \
  -d '{ "managerId": "mgr-3001", "decision": "approve" }'
```

Simulate a silent HCM contradiction:

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

## Frontend

```bash
pnpm frontend:dev
pnpm storybook
```

The Next.js UI demonstrates employee/manager states against the NestJS service. If the backend runs somewhere else, set `NEXT_PUBLIC_TIME_OFF_API_BASE_URL` before starting `pnpm frontend:dev`.
