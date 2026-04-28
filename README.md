# ExampleHR Time Off

Next.js App Router implementation of the ExampleHR time-off service and UI described in `AGENTS.md`.

This project is implemented with JavaScript and JSX files.

## What is included

- Employee balances per location with optimistic pending holds.
- Manager decision queue with decision-time HCM context.
- Mock HCM route handlers for batch reads, per-cell reads, conflicts, slow responses, invalid dimensions, silent wrong successes, and anniversary bonuses.
- Storybook stories for meaningful lifecycle states.
- Vitest tests for reconciliation and mock HCM behavior.
- TRD at `docs/TRD-Time-Off.md`.

## Commands

```bash
pnpm install
pnpm dev
pnpm storybook
pnpm test
```

## How to use the app

1. Install dependencies with `pnpm install`.
2. Start the Next.js app with `pnpm dev`.
3. Open the local URL printed by Next.js, usually `http://localhost:3000`.
4. Use the employee view to inspect time-off balances by location, choose request dates, enter the number of days, and submit a request.
5. Use the mode controls in the UI to simulate HCM behavior such as normal success, slow responses, conflicts, invalid dimensions, or silent wrong successes.
6. Use the manager view to review pending requests. The manager cards show decision-time balance context so an approval is based on the latest HCM-aware state, not just the employee's original screen.
7. Trigger the anniversary bonus simulation to see how the UI reconciles a mid-session balance change from the HCM source of truth.

The app treats HCM as authoritative. ExampleHR gives fast optimistic feedback, but it keeps requests in pending or needs-review states until read-after-write verification and reconciliation prove the balance is still valid.

## Storybook

Run Storybook with:

```bash
pnpm storybook
```

Open the `Time Off / Reconciliation States` section in the sidebar. These stories are intentionally state-focused: they show the awkward cases a time-off product must handle when the frontend is fast but the balance source of truth lives in HCM.

### Reconciliation States

- `Employee Loading Empty` shows the initial loading state before the batch HCM balance corpus has hydrated the UI. It verifies the app has a calm fallback instead of rendering misleading zero balances.
- `Employee Fresh Balances` shows a normal employee screen with recently synced per-location balances. This is the baseline happy path where the employee can submit a request and get immediate pending feedback.
- `Employee Stale Balance` shows balances whose last sync is old enough to be treated carefully. The UI still renders useful information, but the state communicates that HCM should be checked before anyone relies on the number.
- `Employee Optimistic Pending` shows the instant-feedback path after an employee submits time off. ExampleHR temporarily holds the requested days locally while HCM is still responding, so the user sees that their action registered without being told it is finally approved.
- `Hcm Silently Wrong` shows the defensive path where HCM returns apparent success, but the follow-up authoritative read does not match. The request moves to a review-oriented state instead of pretending the write was trustworthy.
- `Manager Decision Time Context` shows the manager approval surface with current balance context visible at decision time. This protects managers from approving against a balance snapshot that may be minutes old.
- `Manager Conflict Needs Review` shows a request that cannot be confidently approved because the balance context conflicts with the pending request. The manager sees a needs-review status instead of a false approval path.

Use these stories as regression targets when changing the data layer or UI. A future change should not remove the distinction between optimistic feedback, HCM rejection, stale reads, silent contradictions, and manager-time verification.
