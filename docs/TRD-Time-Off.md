# ExampleHR Time-Off Technical Requirements Document

## Summary

ExampleHR needs a time-off experience that feels fast while remaining honest that the HCM owns balances. This implementation provides a Next.js App Router application with:

- Employee balance and request workflow per employee/location.
- Manager review queue with decision-time balance context.
- Vercel serverless API routes backed by Neon PostgreSQL.
- Drizzle ORM schema/query usage for a lightweight typed-ish SQL layer without a heavy runtime client.
- Mock-HCM behavior implemented against real persisted rows: batch hydration, real-time cell reads, conflicts, slow responses, invalid dimensions, silent wrong successes, and external anniversary bonuses.
- A React Query data layer that uses optimistic pending holds, read-after-write verification, polling reconciliation, and rollback/review states.
- Zustand for UI-only state such as selected location, form values, simulation mode, and toast messages.
- Storybook stories and unit/integration tests covering the non-happy paths.

## Requirements

Functional requirements:

- Show all time-off balances for the current employee by location.
- Allow an employee to submit a request against a selected location.
- Never show a request as approved directly after employee submission. Employee submission creates a pending request only.
- Let managers approve or deny pending requests.
- Show managers the current authoritative balance context before a decision.
- Support external HCM balance mutation during an open session.
- Represent slow, stale, rejected, and silently inconsistent HCM behavior in the UI.

Non-functional requirements:

- Treat HCM real-time per-cell reads as authoritative.
- Use expensive HCM batch reads for initial hydration and periodic reconciliation.
- Keep request state recoverable when HCM success does not match read-after-write verification.
- Make states easy to review in Storybook.
- Test the pure reconciliation rules and mock HCM state transitions.

## Solution Structure

- `src/app/api/hcm/balances/route.js`: expensive batch corpus read.
- `src/app/api/hcm/balance/route.js`: authoritative per-cell balance read.
- `src/app/api/hcm/anniversary-bonus/route.js`: external balance mutation simulation.
- `src/app/api/time-off/requests/route.js`: ExampleHR request creation and listing.
- `src/app/api/time-off/requests/[requestId]/decision/route.js`: manager approve/deny endpoint.
- `src/app/api/admin/setup/route.js`: schema creation and seed endpoint for Neon.
- `src/lib/db/schema.js`: Drizzle table definitions.
- `src/lib/db/client.js`: lazy Neon/Drizzle connection factory for Vercel API routes.
- `src/lib/db/setup.js`: idempotent table creation and seed logic.
- `src/lib/time-off/repository.js`: Neon-backed request and balance operations.
- `src/lib/time-off/reconciliation.js`: pure reconciliation rules.
- `src/lib/time-off/use-time-off.js`: client data layer and mutation orchestration.
- `src/lib/time-off/ui-store.js`: Zustand UI state store.
- `src/components/time-off/*`: presentational UI for employee and manager views.
- `src/components/time-off/time-off.stories.jsx`: state matrix stories.

## State And Data Strategy

Initial load uses the HCM batch endpoint because it gives a complete per-employee/per-location view. After that, the app prefers per-cell reads for important moments: employee submission and manager approval.

React Query owns server state:

- `["balances"]` polls every 10 seconds.
- `["requests"]` polls every 5 seconds so managers see employee submissions quickly.
- Mutations optimistically adjust the balance cache, then invalidate balances and requests after the server responds.
- Failed employee submissions roll back to the previous React Query cache snapshot.

Zustand owns UI state:

- Selected location.
- Request form values.
- HCM simulation mode.
- Toast/status messaging.

This split keeps server truth and UI preferences separate. React Query is deliberately not used for form state, and Zustand is deliberately not used as a cache for database rows.

Employee submission is optimistic but limited:

1. The UI immediately places a local pending hold on the selected balance.
2. The request is submitted to ExampleHR/HCM.
3. A successful HCM response still must reconcile with the returned authoritative balance.
4. If HCM rejects, the optimistic hold rolls back and the user sees a rejection.
5. If HCM returns success but the returned balance does not reflect the expected mutation, the request enters `needs_review` rather than `approved`.

Manager approval is pessimistic:

- Approval requires decision-time verification.
- If HCM conflicts, the request becomes or remains `needs_review`.
- Denial releases pending days.

The backend enforces this with atomic SQL CTE updates:

- Employee submission only creates a pending request after the selected balance row has enough available days.
- Approval only succeeds if the authoritative balance row still has enough pending days for the request.
- An employee submission never writes `approved`; only the manager decision endpoint can do that.

Background reconciliation:

- The client periodically refreshes the expensive batch endpoint.
- The UI surfaces a reconciliation message instead of silently replacing context.
- In-flight requests are not promoted to approved by reconciliation. They remain pending or reviewable until the manager decision path verifies them.

## Alternatives Considered

Pure pessimistic employee submission:

- Pro: simplest correctness story.
- Con: makes normal submissions feel slow and gives no immediate feedback. This was rejected because employees need instant feedback, but the product must avoid false approvals.

Full optimistic approval:

- Pro: fastest possible UI.
- Con: violates the requirement that employees should never be told approved and then later denied. This was rejected.

SWR/React Query:

- Pro: production-grade caching, retries, stale markers, request deduplication.
- Decision: React Query is now used because the project needs real-time-ish testing across employee and manager personas. It gives polling, optimistic mutation lifecycle hooks, rollback context, and consistent invalidation without hand-rolled cache code.

Zustand:

- Pro: tiny API and good fit for UI state that should not be refetched from the server.
- Con: it is easy to misuse as a second server cache. This implementation limits Zustand to UI state only.

Drizzle ORM:

- Pro: lightweight, SQL-first, works with Neon serverless, and avoids Prisma-style generated client weight in serverless functions.
- Con: migrations are not automated here. Schema setup is idempotent SQL in `src/lib/db/setup.js`; production teams should graduate to reviewed migrations.

Server Actions instead of route handlers:

- Pro: fewer client fetch helpers.
- Con: route handlers better model a microservice/API boundary and are easier to use from Storybook and integration tests.

## Component Tree

`TimeOffDashboard` owns the live data hook and passes state down.

- `EmployeeView` renders balances, request form, HCM simulation controls, and recent employee requests.
- `BalanceCard` displays per-location freshness, pending days, version, and sync context.
- `ManagerView` renders reviewable requests and their decision-time balance context.
- `StatusPill` centralizes request status labels.

Presentational components are intentionally prop-driven so Storybook can cover edge states without standing up the app.

## Test Strategy

Unit tests:

- `reconciliation.test.js` guards pure optimistic/reconciliation decisions. These tests catch regressions in the most important correctness policy.

Mock HCM integration tests:

- `server-store.test.js` verifies request submission, conflict rejection, silent wrong success, and external bonus mutation. These tests guard the route-handler business logic without requiring a web server.

Storybook interaction tests:

- Stories cover loading, empty, stale, optimistic pending, silent wrong, manager context, and manager conflict states.
- Interaction assertions verify visible controls and decision context.

Recommended next test additions:

- Route-handler tests that call `GET`/`POST` handlers directly with `NextRequest`.
- Browser-level Playwright tests for the full employee-to-manager workflow once dependencies are installed.
- Storybook test runner in CI to execute interaction tests against all state stories.
- Database integration tests against a disposable Neon branch, not the shared demo database.

## Deployment And Database Setup

Required Vercel environment variables:

- `DATABASE_URL`: Neon PostgreSQL connection string.
- `SETUP_TOKEN`: optional but strongly recommended. If set, `POST /api/admin/setup` requires an `x-setup-token` header.

Setup options:

```bash
DATABASE_URL="..." pnpm db:setup
```

or after deploy:

```bash
curl -X POST https://your-app.vercel.app/api/admin/setup \
  -H "x-setup-token: $SETUP_TOKEN"
```

The setup path creates:

- `employees`
- `locations`
- `time_off_balances`
- `time_off_requests`
- `time_off_request_audit`

Seed data includes Avery Johnson, Mina Patel, three balance rows, and one pending manager-review request.

## Concerns And Advice

- Rotate the Neon credential that was shared in chat and store the replacement only in Vercel environment variables.
- Protect `/api/admin/setup` with `SETUP_TOKEN`; leaving it open invites accidental reseeding or schema probing.
- Polling is good enough for this exercise, but a production manager queue may eventually need push updates through WebSockets, Server-Sent Events, or a hosted realtime service.
- Do not treat React Query polling as the approval authority. The approval endpoint must always re-read and update the balance row atomically, which this implementation does.
- Use a separate Neon branch for automated integration tests so optimistic/approval tests do not mutate demo or production data.

## Local Commands

Install dependencies:

```bash
pnpm install
```

Run the app:

```bash
pnpm dev
```

Run Storybook:

```bash
pnpm storybook
```

Run tests:

```bash
pnpm test
```

This workspace did not have `pnpm` available on PATH during implementation, so the project was scaffolded directly instead of through a generator.
