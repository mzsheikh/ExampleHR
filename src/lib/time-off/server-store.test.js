import { beforeEach, describe, expect, it } from "vitest";
import { getBalance, resetTimeOffStore, submitTimeOff, triggerAnniversaryBonus } from "./server-store";
describe("mock HCM store", () => {
    beforeEach(() => {
        resetTimeOffStore();
    });
    it("submits a pending request and mutates the authoritative balance cell", async () => {
        const result = await submitTimeOff({
            employeeId: "emp-1001",
            locationId: "nyc",
            days: 2,
            startsOn: "2026-05-04",
            endsOn: "2026-05-05",
            reason: "Recharge",
            mode: "normal"
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.balance.availableDays).toBe(8);
            expect(result.balance.pendingDays).toBe(2);
            expect(result.request.status).toBe("pending");
        }
    });
    it("rejects insufficient balance as an HCM conflict", async () => {
        const result = await submitTimeOff({
            employeeId: "emp-1001",
            locationId: "london",
            days: 20,
            startsOn: "2026-05-04",
            endsOn: "2026-05-24",
            reason: "Long break"
        });
        expect(result.ok).toBe(false);
        expect(result.status).toBe(409);
    });
    it("can simulate a silent wrong HCM success", async () => {
        const before = await getBalance("emp-1001", "nyc");
        const result = await submitTimeOff({
            employeeId: "emp-1001",
            locationId: "nyc",
            days: 2,
            startsOn: "2026-05-04",
            endsOn: "2026-05-05",
            reason: "Recharge",
            mode: "silent_wrong"
        });
        const after = await getBalance("emp-1001", "nyc");
        expect(result.ok).toBe(true);
        expect(after?.availableDays).toBe(before?.availableDays);
        if (result.ok) {
            expect("warning" in result ? result.warning : "").toContain("did not reconcile");
            expect(result.request.status).toBe("needs_review");
        }
    });
    it("applies an external anniversary bonus across an employee's balances", async () => {
        const before = await getBalance("emp-1001", "nyc");
        await triggerAnniversaryBonus("emp-1001");
        const after = await getBalance("emp-1001", "nyc");
        expect(after?.availableDays).toBe((before?.availableDays ?? 0) + 1);
        expect(after?.version).toBe((before?.version ?? 0) + 1);
    });
});
