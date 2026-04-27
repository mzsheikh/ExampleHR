import { seedBalances, seedRequests } from "./sample-data";
import type {
  BalanceCell,
  DecisionInput,
  HcmMode,
  LocationId,
  SubmitTimeOffInput,
  TimeOffRequest
} from "./types";

type Store = {
  balances: BalanceCell[];
  requests: TimeOffRequest[];
  bonusApplied: boolean;
};

const globalForStore = globalThis as typeof globalThis & {
  __exampleHrTimeOffStore?: Store;
};

function nowIso() {
  return new Date().toISOString();
}

function cloneBalance(balance: BalanceCell): BalanceCell {
  return { ...balance };
}

function cloneRequest(request: TimeOffRequest): TimeOffRequest {
  return {
    ...request,
    audit: request.audit.map((entry) => ({ ...entry }))
  };
}

function getStore(): Store {
  if (!globalForStore.__exampleHrTimeOffStore) {
    globalForStore.__exampleHrTimeOffStore = {
      balances: seedBalances.map(cloneBalance),
      requests: seedRequests.map(cloneRequest),
      bonusApplied: false
    };
  }

  return globalForStore.__exampleHrTimeOffStore;
}

function findBalance(employeeId: string, locationId: LocationId) {
  return getStore().balances.find(
    (balance) => balance.employeeId === employeeId && balance.locationId === locationId
  );
}

function delayForMode(mode?: HcmMode) {
  if (mode !== "slow") {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, 900));
}

function makeRequestId() {
  return `req-${Math.random().toString(16).slice(2, 10)}`;
}

export function resetTimeOffStore() {
  globalForStore.__exampleHrTimeOffStore = undefined;
}

export async function getBatchBalances() {
  await delayForMode();
  return getStore().balances.map(cloneBalance);
}

export async function getBalance(employeeId: string, locationId: LocationId, mode?: HcmMode) {
  await delayForMode(mode);

  if (mode === "invalid_dimension") {
    return null;
  }

  const balance = findBalance(employeeId, locationId);
  return balance ? cloneBalance(balance) : null;
}

export async function triggerAnniversaryBonus(employeeId = "emp-1001") {
  const store = getStore();
  store.balances = store.balances.map((balance) => {
    if (balance.employeeId !== employeeId) {
      return balance;
    }

    return {
      ...balance,
      availableDays: balance.availableDays + 1,
      version: balance.version + 1,
      lastSyncedAt: nowIso()
    };
  });
  store.bonusApplied = true;
  return store.balances.filter((balance) => balance.employeeId === employeeId).map(cloneBalance);
}

export async function submitTimeOff(input: SubmitTimeOffInput) {
  await delayForMode(input.mode);
  const balance = findBalance(input.employeeId, input.locationId);

  if (!balance || input.mode === "invalid_dimension") {
    return {
      ok: false,
      status: 422,
      error: "Invalid employee/location balance dimension."
    } as const;
  }

  if (input.mode === "conflict" || balance.availableDays < input.days) {
    return {
      ok: false,
      status: 409,
      error: "Insufficient authoritative HCM balance.",
      balance: cloneBalance(balance)
    } as const;
  }

  const request: TimeOffRequest = {
    id: makeRequestId(),
    employeeId: balance.employeeId,
    employeeName: balance.employeeName,
    locationId: balance.locationId,
    locationName: balance.locationName,
    days: input.days,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    reason: input.reason,
    status: input.mode === "silent_wrong" ? "needs_review" : "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    balanceVersionAtSubmit: balance.version,
    audit: [
      {
        at: nowIso(),
        actor: "employee",
        message: `Submitted against HCM balance version ${balance.version}.`
      }
    ]
  };

  getStore().requests.unshift(request);

  if (input.mode === "silent_wrong") {
    request.audit.push({
      at: nowIso(),
      actor: "system",
      message: "HCM returned success, but verification did not show the expected balance mutation."
    });
    return {
      ok: true,
      status: 202,
      request: cloneRequest(request),
      balance: cloneBalance(balance),
      warning: "HCM success response did not reconcile with a read-after-write check."
    } as const;
  }

  balance.availableDays -= input.days;
  balance.pendingDays += input.days;
  balance.version += 1;
  balance.lastSyncedAt = nowIso();

  return {
    ok: true,
    status: 202,
    request: cloneRequest(request),
    balance: cloneBalance(balance)
  } as const;
}

export async function listRequests(status?: string) {
  const requests = getStore().requests;
  return requests
    .filter((request) => (status ? request.status === status : true))
    .map(cloneRequest);
}

export async function decideRequest(input: DecisionInput) {
  await delayForMode(input.mode);
  const store = getStore();
  const request = store.requests.find((candidate) => candidate.id === input.requestId);

  if (!request) {
    return { ok: false, status: 404, error: "Request not found." } as const;
  }

  const balance = findBalance(request.employeeId, request.locationId);
  if (!balance || input.mode === "invalid_dimension") {
    request.status = "needs_review";
    request.updatedAt = nowIso();
    request.audit.push({
      at: nowIso(),
      actor: "hcm",
      message: "Approval blocked because HCM no longer recognizes this balance dimension."
    });
    return { ok: false, status: 422, error: "Invalid HCM dimension.", request: cloneRequest(request) } as const;
  }

  if (input.decision === "deny") {
    request.status = "denied";
    request.updatedAt = nowIso();
    balance.availableDays += request.days;
    balance.pendingDays = Math.max(0, balance.pendingDays - request.days);
    balance.version += 1;
    balance.lastSyncedAt = nowIso();
    request.audit.push({
      at: nowIso(),
      actor: "manager",
      message: `Denied by ${input.managerId}; pending days released.`
    });
    return { ok: true, status: 200, request: cloneRequest(request), balance: cloneBalance(balance) } as const;
  }

  if (input.mode === "conflict" || balance.pendingDays < request.days) {
    request.status = "needs_review";
    request.updatedAt = nowIso();
    request.audit.push({
      at: nowIso(),
      actor: "hcm",
      message: "Approval blocked by HCM conflict during decision-time balance verification."
    });
    return {
      ok: false,
      status: 409,
      error: "Decision-time HCM balance verification failed.",
      request: cloneRequest(request),
      balance: cloneBalance(balance)
    } as const;
  }

  request.status = "approved";
  request.updatedAt = nowIso();
  balance.pendingDays = Math.max(0, balance.pendingDays - request.days);
  balance.version += 1;
  balance.lastSyncedAt = nowIso();
  request.audit.push({
    at: nowIso(),
    actor: "manager",
    message: `Approved by ${input.managerId} after real-time HCM verification.`
  });

  return { ok: true, status: 200, request: cloneRequest(request), balance: cloneBalance(balance) } as const;
}
