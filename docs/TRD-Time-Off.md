# ExampleHR Time-Off Microservice TRD

## Summary

ExampleHR needs a backend service that lets employees request time off while keeping the HCM system authoritative for balances. This implementation provides a NestJS REST microservice backed by SQLite. It models balances per employee/location, uses authoritative per-cell reads before important writes, supports expensive batch reconciliation, and keeps requests recoverable when HCM behavior is slow, contradictory, or unavailable.

The existing Next.js UI remains as optional demo material. The backend deliverable lives in `src/backend`.

## Requirements And API

Functional requirements:

- Read all balances from an expensive HCM batch endpoint.
- Read or write one authoritative HCM balance cell by employee/location.
- Submit employee time-off requests without ever marking them approved at submission time.
- Let managers approve or deny requests with decision-time balance verification.
- Simulate external balance mutations such as a work-anniversary bonus.
- Defensively handle invalid dimensions, insufficient balance, conflict responses, slow HCM responses, and apparent HCM success that does not reconcile.

REST endpoints:

- `GET /hcm/balances`: batch balance corpus.
- `GET /hcm/balance?employeeId=&locationId=&mode=`: authoritative cell read.
- `POST /hcm/balance`: mock HCM cell write with deltas and simulation mode.
- `POST /hcm/anniversary-bonus`: external HCM balance mutation.
- `GET /time-off/requests?status=`: request listing.
- `POST /time-off/requests`: employee submission.
- `POST /time-off/requests/:requestId/decision`: manager approval/denial.
- `POST /admin/reset`: local test/demo reset.

Supported simulation modes are `normal`, `slow`, `conflict`, `invalid_dimension`, and `silent_wrong`.

## Architecture

`src/backend/app.module.js` creates the NestJS application and wires controllers, the SQLite store, and the time-off service. The controllers in `src/backend/controllers.js` expose REST routes. `src/backend/time-off.service.js` owns business rules. `src/backend/sqlite-store.js` owns schema creation, seed data, transactions, and mapping between SQLite rows and API objects.

SQLite tables:

- `employees`
- `locations`
- `time_off_balances`, keyed by `(employee_id, location_id)`
- `time_off_requests`
- `time_off_request_audit`

`time_off_requests.balance_held` records whether a pending request has already moved days from available to pending. This makes rollback/recovery explicit: a `needs_review` request caused by a silent HCM mismatch has no hold to release, while a manager-time conflict can keep a held balance until a later denial releases it.

## Consistency Strategy

Employee submission is optimistic from the product perspective but conservative in the backend:

1. Read the current employee/location balance cell.
2. Reject invalid dimensions, conflicts, or insufficient balance.
3. In a SQLite `BEGIN IMMEDIATE` transaction, re-read the row, decrement available days, increment pending days, create a `pending` request, and write audit history.
4. If HCM returns apparent success but verification does not match, create a `needs_review` request with `balance_held=false` and leave balances unchanged.

Manager approval is pessimistic:

- Approval rechecks the current balance and requires the request to be `pending`, `balance_held=true`, and backed by enough pending days.
- Approval releases only pending days; available days stay spent.
- Denial releases the held balance only when `balance_held=true`.
- Decision-time conflicts move the request to `needs_review` and retain audit context for recovery.

Batch HCM reads are treated as expensive and are intended for bootstrapping/reconciliation. Per-cell reads are the authority for request submission and approval.

## Alternatives Considered

Next.js route handlers:

- Pro: already existed and worked for the frontend demo.
- Con: the PDF explicitly asks for a backend microservice using NestJS and SQLite. The deliverable now uses NestJS; the Next.js app remains optional.

PostgreSQL/Neon:

- Pro: strong hosted database option and already implemented.
- Con: the assignment guide specifies SQLite. The backend uses SQLite so tests and local runs are deterministic and self-contained.

Native SQLite package:

- Pro: mature ecosystem around `better-sqlite3` and `sqlite3`.
- Con: native install/build scripts add friction. Node 22 provides `node:sqlite`, which is enough for this take-home and avoids another native dependency.

Full optimistic approval:

- Pro: fastest UI feedback.
- Con: violates the requirement that employees should not be told approved and later denied. Submission only creates `pending` or `needs_review`; only manager verification can approve.

## Test Strategy

Unit/service tests in `src/backend/time-off.service.test.js` cover:

- Valid submission and balance hold.
- Insufficient balance rejection.
- Invalid dimension rejection.
- Silent HCM success moved to `needs_review`.
- Anniversary bonus mutation.
- Manager approval after verification.
- Manager denial with hold release.
- Manager conflict moved to `needs_review`.
- Competing submissions serialized against one SQLite row.

HTTP integration tests in `src/backend/time-off.http.test.js` start the real Nest app with an in-memory SQLite database and cover:

- Health, batch HCM reads, and per-cell reads.
- Employee submit plus manager approve over REST.
- HCM silent-wrong and conflict responses.
- Anniversary bonus and reset endpoints.

Current verification:

- `pnpm test`: 19 passing tests.
- `pnpm test:coverage`: 90.41% statement coverage on the backend/reconciliation target.
- `pnpm lint`: passing.

Recommended production additions would include authentication/authorization, idempotency keys for request submission, reviewed migrations, structured logging, and separate test fixtures for multi-manager approval policies.
