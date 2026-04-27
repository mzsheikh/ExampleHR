"use client";

import type {
  ApiEnvelope,
  BalanceCell,
  DecisionInput,
  HcmMode,
  LocationId,
  SubmitTimeOffInput,
  TimeOffRequest
} from "./types";

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T;

  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  return payload;
}

export async function fetchBatchBalances() {
  return readJson<ApiEnvelope<BalanceCell[]>>(await fetch("/api/hcm/balances", { cache: "no-store" }));
}

export async function fetchBalance(employeeId: string, locationId: LocationId, mode?: HcmMode) {
  const params = new URLSearchParams({ employeeId, locationId });
  if (mode) {
    params.set("mode", mode);
  }

  return readJson<ApiEnvelope<BalanceCell>>(await fetch(`/api/hcm/balance?${params}`, { cache: "no-store" }));
}

export async function fetchRequests(status?: string) {
  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }

  const suffix = params.size ? `?${params}` : "";
  return readJson<ApiEnvelope<TimeOffRequest[]>>(await fetch(`/api/time-off/requests${suffix}`, { cache: "no-store" }));
}

export async function postTimeOffRequest(input: SubmitTimeOffInput) {
  return readJson<ApiEnvelope<{ request: TimeOffRequest; balance: BalanceCell }>>(
    await fetch("/api/time-off/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function postDecision(input: DecisionInput) {
  return readJson<ApiEnvelope<{ request: TimeOffRequest; balance: BalanceCell }>>(
    await fetch(`/api/time-off/requests/${input.requestId}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        managerId: input.managerId,
        decision: input.decision,
        mode: input.mode
      })
    })
  );
}

export async function triggerBonus(employeeId: string) {
  return readJson<ApiEnvelope<BalanceCell[]>>(
    await fetch("/api/hcm/anniversary-bonus", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ employeeId })
    })
  );
}
