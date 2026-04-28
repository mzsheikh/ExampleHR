"use client";
async function readJson(response) {
    const payload = (await response.json());
    if (!response.ok) {
        throw new Error(JSON.stringify(payload));
    }
    return payload;
}
export async function fetchBatchBalances() {
    return readJson(await fetch("/api/hcm/balances", { cache: "no-store" }));
}
export async function fetchBalance(employeeId, locationId, mode) {
    const params = new URLSearchParams({ employeeId, locationId });
    if (mode) {
        params.set("mode", mode);
    }
    return readJson(await fetch(`/api/hcm/balance?${params}`, { cache: "no-store" }));
}
export async function fetchRequests(status) {
    const params = new URLSearchParams();
    if (status) {
        params.set("status", status);
    }
    const suffix = params.size ? `?${params}` : "";
    return readJson(await fetch(`/api/time-off/requests${suffix}`, { cache: "no-store" }));
}
export async function postTimeOffRequest(input) {
    return readJson(await fetch("/api/time-off/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
    }));
}
export async function postDecision(input) {
    return readJson(await fetch(`/api/time-off/requests/${input.requestId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            managerId: input.managerId,
            decision: input.decision,
            mode: input.mode
        })
    }));
}
export async function triggerBonus(employeeId) {
    return readJson(await fetch("/api/hcm/anniversary-bonus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employeeId })
    }));
}
