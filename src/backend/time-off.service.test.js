// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteStore } from "./sqlite-store.js";
import { TimeOffService } from "./time-off.service.js";

const baseRequest = {
  employeeId: "emp-1001",
  locationId: "nyc",
  days: 2,
  startsOn: "2026-05-04",
  endsOn: "2026-05-05",
  reason: "Recharge"
};

describe("TimeOffService", () => {
  let store;
  let service;

  beforeEach(() => {
    store = new SqliteStore({ databasePath: ":memory:" });
    service = new TimeOffService(store);
  });

  afterEach(() => {
    store.close();
  });

  it("submits a valid request as pending and holds the exact balance cell", async () => {
    const result = await service.submitTimeOff(baseRequest);

    expect(result.data.request.status).toBe("pending");
    expect(result.data.request.balanceHeld).toBe(true);
    expect(result.data.balance.availableDays).toBe(8);
    expect(result.data.balance.pendingDays).toBe(2);
  });

  it("rejects insufficient balance without mutating the authoritative balance", async () => {
    await expect(service.submitTimeOff({ ...baseRequest, days: 20 })).rejects.toMatchObject({
      status: 409
    });

    const balance = store.getBalance("emp-1001", "nyc");
    expect(balance.availableDays).toBe(10);
    expect(balance.pendingDays).toBe(0);
  });

  it("rejects invalid employee/location dimensions", async () => {
    await expect(
      service.submitTimeOff({ ...baseRequest, locationId: "not-a-location" })
    ).rejects.toMatchObject({ status: 422 });
  });

  it("records silent HCM success as needs_review without holding balance", async () => {
    const result = await service.submitTimeOff({ ...baseRequest, mode: "silent_wrong" });

    expect(result.data.request.status).toBe("needs_review");
    expect(result.data.request.balanceHeld).toBe(false);
    expect(result.data.balance.availableDays).toBe(10);
    expect(result.warnings[0]).toMatch(/did not reconcile/i);
  });

  it("applies an external anniversary bonus without changing request status", () => {
    const result = service.triggerAnniversaryBonus("emp-1001");

    expect(result.data.map((balance) => [balance.locationId, balance.availableDays])).toEqual([
      ["london", 5],
      ["nyc", 11]
    ]);
    expect(store.listRequests("pending")).toHaveLength(1);
  });

  it("approves only after decision-time balance verification", async () => {
    const submitted = await service.submitTimeOff(baseRequest);
    const decided = await service.decideRequest({
      requestId: submitted.data.request.id,
      managerId: "mgr-3001",
      decision: "approve"
    });

    expect(decided.data.request.status).toBe("approved");
    expect(decided.data.request.balanceHeld).toBe(false);
    expect(decided.data.balance.availableDays).toBe(8);
    expect(decided.data.balance.pendingDays).toBe(0);
  });

  it("denies a pending request and releases the held balance", async () => {
    const submitted = await service.submitTimeOff({ ...baseRequest, days: 1 });
    const denied = await service.decideRequest({
      requestId: submitted.data.request.id,
      managerId: "mgr-3001",
      decision: "deny"
    });

    expect(denied.data.request.status).toBe("denied");
    expect(denied.data.balance.availableDays).toBe(10);
    expect(denied.data.balance.pendingDays).toBe(0);
  });

  it("does not allow finalized requests to be decided again", async () => {
    const submitted = await service.submitTimeOff({ ...baseRequest, days: 1 });
    await service.decideRequest({
      requestId: submitted.data.request.id,
      managerId: "mgr-3001",
      decision: "approve"
    });

    await expect(
      service.decideRequest({
        requestId: submitted.data.request.id,
        managerId: "mgr-3001",
        decision: "deny"
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it("moves manager approval conflicts to needs_review and keeps the hold recoverable", async () => {
    const submitted = await service.submitTimeOff(baseRequest);

    await expect(
      service.decideRequest({
        requestId: submitted.data.request.id,
        managerId: "mgr-3001",
        decision: "approve",
        mode: "conflict"
      })
    ).rejects.toMatchObject({ status: 409 });

    const conflicted = store.getRequest(submitted.data.request.id);
    expect(conflicted.status).toBe("needs_review");
    expect(conflicted.balanceHeld).toBe(true);

    const denied = await service.decideRequest({
      requestId: submitted.data.request.id,
      managerId: "mgr-3001",
      decision: "deny"
    });
    expect(denied.data.balance.availableDays).toBe(10);
    expect(denied.data.balance.pendingDays).toBe(0);
  });

  it("serializes competing submissions against the same SQLite balance row", async () => {
    const attempts = await Promise.allSettled([
      service.submitTimeOff({ ...baseRequest, days: 6 }),
      service.submitTimeOff({ ...baseRequest, days: 6 })
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);

    const balance = store.getBalance("emp-1001", "nyc");
    expect(balance.availableDays).toBe(4);
    expect(balance.pendingDays).toBe(6);
  });

  it("validates HCM cell write deltas before mutating the row", async () => {
    await expect(
      service.writeHcmBalance({
        employeeId: "emp-1001",
        locationId: "nyc",
        availableDelta: "not-a-number"
      })
    ).rejects.toMatchObject({ status: 422 });

    const balance = store.getBalance("emp-1001", "nyc");
    expect(balance.availableDays).toBe(10);
  });
});
