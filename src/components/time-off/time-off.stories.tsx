import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { EmployeeView } from "./employee-view";
import { ManagerView } from "./manager-view";
import { seedBalances, seedRequests } from "@/lib/time-off/sample-data";
import type { BalanceCell, RequestFormState, TimeOffRequest } from "@/lib/time-off/types";

const form: RequestFormState = {
  locationId: "nyc",
  days: 2,
  startsOn: "2026-05-04",
  endsOn: "2026-05-05",
  reason: "Recharge"
};

const staleBalances: BalanceCell[] = seedBalances.map((balance) => ({
  ...balance,
  lastSyncedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString()
}));

const silentlyWrongRequest: TimeOffRequest = {
  ...seedRequests[0],
  id: "req-silent",
  employeeId: "emp-1001",
  employeeName: "Avery Johnson",
  locationId: "nyc",
  locationName: "New York",
  status: "needs_review",
  audit: [
    ...seedRequests[0].audit,
    {
      at: new Date().toISOString(),
      actor: "system",
      message: "Read-after-write did not match HCM success response."
    }
  ]
};

const meta = {
  title: "Time Off/Reconciliation States",
  parameters: {
    layout: "fullscreen"
  }
} satisfies Meta;

export default meta;

export const EmployeeLoadingEmpty: StoryObj = {
  render: () => (
    <main className="appShell">
      <section className="panel loadingPanel">Loading HCM balances...</section>
    </main>
  )
};

export const EmployeeFreshBalances: StoryObj = {
  render: () => (
    <main className="appShell">
      <EmployeeView
        balances={seedBalances}
        requests={[]}
        selectedLocationId="nyc"
        form={form}
        mode="normal"
        onSelectLocation={fn()}
        onFormChange={fn()}
        onModeChange={fn()}
        onSubmit={fn()}
        onBonus={fn()}
      />
    </main>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("10")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /submit as pending/i }));
  }
};

export const EmployeeStaleBalance: StoryObj = {
  render: () => (
    <main className="appShell">
      <EmployeeView
        balances={staleBalances}
        requests={[]}
        selectedLocationId="london"
        form={{ ...form, locationId: "london" }}
        mode="normal"
        onSelectLocation={fn()}
        onFormChange={fn()}
        onModeChange={fn()}
        onSubmit={fn()}
        onBonus={fn()}
      />
    </main>
  )
};

export const EmployeeOptimisticPending: StoryObj = {
  render: () => (
    <main className="appShell">
      <EmployeeView
        balances={[
          { ...seedBalances[0], availableDays: 8, pendingDays: 2, version: 7 },
          seedBalances[1],
          seedBalances[2]
        ]}
        requests={[
          {
            ...silentlyWrongRequest,
            id: "local-pending",
            status: "pending",
            days: 2
          }
        ]}
        selectedLocationId="nyc"
        form={form}
        mode="slow"
        busy
        onSelectLocation={fn()}
        onFormChange={fn()}
        onModeChange={fn()}
        onSubmit={fn()}
        onBonus={fn()}
      />
    </main>
  )
};

export const HcmSilentlyWrong: StoryObj = {
  render: () => (
    <main className="appShell">
      <EmployeeView
        balances={seedBalances}
        requests={[silentlyWrongRequest]}
        selectedLocationId="nyc"
        form={form}
        mode="silent_wrong"
        onSelectLocation={fn()}
        onFormChange={fn()}
        onModeChange={fn()}
        onSubmit={fn()}
        onBonus={fn()}
      />
    </main>
  )
};

export const ManagerDecisionTimeContext: StoryObj = {
  render: () => (
    <main className="appShell">
      <ManagerView balances={seedBalances} requests={seedRequests} onDecision={fn()} />
    </main>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/decision-time context/i)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /verify and approve/i })).toBeVisible();
  }
};

export const ManagerConflictNeedsReview: StoryObj = {
  render: () => (
    <main className="appShell">
      <ManagerView
        balances={[{ ...seedBalances[2], pendingDays: 0 }]}
        requests={[{ ...seedRequests[0], status: "needs_review" }]}
        onDecision={fn()}
      />
    </main>
  )
};
