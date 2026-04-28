import { describe, expect, it } from "vitest";
import { seedBalances } from "./sample-data";
import { isBalanceStale, optimisticBalance, reconcileAfterSubmit } from "./reconciliation";
describe("time-off reconciliation", () => {
    it("creates an optimistic pending hold without mutating the source balance", () => {
        const before = seedBalances[0];
        const optimistic = optimisticBalance(before, 2);
        expect(optimistic.availableDays).toBe(8);
        expect(optimistic.pendingDays).toBe(2);
        expect(before.availableDays).toBe(10);
    });
    it("accepts a write only when read-after-write matches the expected HCM mutation", () => {
        const before = seedBalances[0];
        const optimistic = optimisticBalance(before, 2);
        const authoritative = {
            ...optimistic,
            version: before.version + 1
        };
        expect(reconcileAfterSubmit({
            before,
            optimistic,
            authoritative,
            requestedDays: 2,
            hcmAccepted: true
        })).toEqual({ kind: "accepted", balance: authoritative });
    });
    it("flags success responses that do not reconcile with the authoritative cell", () => {
        const before = seedBalances[0];
        const optimistic = optimisticBalance(before, 2);
        const event = reconcileAfterSubmit({
            before,
            optimistic,
            authoritative: before,
            requestedDays: 2,
            hcmAccepted: true
        });
        expect(event.kind).toBe("silent_mismatch");
    });
    it("marks balances stale after the configured threshold", () => {
        const balance = {
            ...seedBalances[0],
            lastSyncedAt: new Date("2026-04-27T10:00:00.000Z").toISOString()
        };
        expect(isBalanceStale(balance, new Date("2026-04-27T10:02:00.000Z").getTime())).toBe(true);
    });
});
