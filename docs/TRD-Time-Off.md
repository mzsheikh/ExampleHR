# ExampleHR Time-Off Technical Requirements Document

## Summary

ExampleHR needs a time-off experience that feels fast while remaining honest that the HCM owns balances. This implementation provides a Next.js App Router application with:

- Employee balance and request workflow per employee/location.
- Manager review queue with decision-time balance context.
- Mock HCM endpoints that simulate batch hydration, real-time cell reads, conflicts, slow responses, invalid dimensions, silent wrong successes, and external anniversary bonuses.
- A React data layer that uses optimistic pending holds, read-after-write verification, periodic reconciliation, and rollback/review states.
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

- `src/app/api/hcm/balances/route.ts`: expensive batch corpus read.
- `src/app/api/hcm/balance/route.ts`: authoritative per-cell balance read.
- `src/app/api/hcm/anniversary-bonus/route.ts`: external balance mutation simulation.
- `src/app/api/time-off/requests/route.ts`: ExampleHR request creation and listing.
- `src/app/api/time-off/requests/[requestId]/decision/route.ts`: manager approve/deny endpoint.
- `src/lib/time-off/server-store.ts`: in-memory HCM/request simulator used by route handlers and tests.
- `src/lib/time-off/reconciliation.ts`: pure reconciliation rules.
- `src/lib/time-off/use-time-off.ts`: client data layer and mutation orchestration.
- `src/components/time-off/*`: presentational UI for employee and manager views.
- `src/components/time-off/time-off.stories.tsx`: state matrix stories.

## State And Data Strategy

Initial load uses the HCM batch endpoint because it gives a complete per-employee/per-location view. After that, the app prefers per-cell reads for important moments: employee submission and manager approval.

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
- Con: adds dependency weight for a focused exercise. The current hook makes the policy explicit. In production, React Query would be a strong fit, with query keys scoped by `employeeId/locationId` and mutations invalidating the affected cell plus the manager queue.

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

- `reconciliation.test.ts` guards pure optimistic/reconciliation decisions. These tests catch regressions in the most important correctness policy.

Mock HCM integration tests:

- `server-store.test.ts` verifies request submission, conflict rejection, silent wrong success, and external bonus mutation. These tests guard the route-handler business logic without requiring a web server.

Storybook interaction tests:

- Stories cover loading, empty, stale, optimistic pending, silent wrong, manager context, and manager conflict states.
- Interaction assertions verify visible controls and decision context.

Recommended next test additions:

- Route-handler tests that call `GET`/`POST` handlers directly with `NextRequest`.
- Browser-level Playwright tests for the full employee-to-manager workflow once dependencies are installed.
- Storybook test runner in CI to execute interaction tests against all state stories.

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
