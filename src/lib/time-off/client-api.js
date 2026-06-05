"use client";
const API_BASE_URL = process.env.NEXT_PUBLIC_TIME_OFF_API_BASE_URL ?? "http://localhost:3001";

function apiUrl(path) {
    if (!API_BASE_URL) {
        return path;
    }
    return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
}

async function readJson(response) {
    const payload = (await response.json());
    if (!response.ok) {
        throw new Error(JSON.stringify(payload));
    }
    return payload;
}
export async function fetchBatchBalances() {
    return readJson(await fetch(apiUrl("/hcm/balances"), { cache: "no-store" }));
}
export async function fetchBalance(employeeId, locationId, mode) {
    const params = new URLSearchParams({ employeeId, locationId });
    if (mode) {
        params.set("mode", mode);
    }
    return readJson(await fetch(apiUrl(`/hcm/balance?${params}`), { cache: "no-store" }));
}
export async function fetchRequests(status) {
    const params = new URLSearchParams();
    if (status) {
        params.set("status", status);
    }
    const suffix = params.size ? `?${params}` : "";
    return readJson(await fetch(apiUrl(`/time-off/requests${suffix}`), { cache: "no-store" }));
}
export async function postTimeOffRequest(input) {
    return readJson(await fetch(apiUrl("/time-off/requests"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
    }));
}
export async function postDecision(input) {
    return readJson(await fetch(apiUrl(`/time-off/requests/${input.requestId}/decision`), {
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
    return readJson(await fetch(apiUrl("/hcm/anniversary-bonus"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employeeId })
    }));
}
