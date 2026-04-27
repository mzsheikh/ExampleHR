import type { BalanceCell, ReconciliationEvent } from "./types";

export function optimisticBalance(balance: BalanceCell, requestedDays: number): BalanceCell {
  return {
    ...balance,
    availableDays: Math.max(0, balance.availableDays - requestedDays),
    pendingDays: balance.pendingDays + requestedDays,
    lastSyncedAt: new Date().toISOString()
  };
}

export function reconcileAfterSubmit(args: {
  before: BalanceCell;
  optimistic: BalanceCell;
  authoritative: BalanceCell;
  requestedDays: number;
  hcmAccepted: boolean;
}): ReconciliationEvent {
  if (!args.hcmAccepted) {
    return {
      kind: "rejected",
      reason: "HCM rejected the request.",
      authoritativeBalance: args.authoritative
    };
  }

  const expectedAvailableDays = args.before.availableDays - args.requestedDays;
  const acceptedExactly =
    args.authoritative.availableDays === expectedAvailableDays &&
    args.authoritative.version > args.before.version;

  if (acceptedExactly) {
    return {
      kind: "accepted",
      balance: args.authoritative
    };
  }

  return {
    kind: "silent_mismatch",
    expectedAvailableDays,
    authoritativeBalance: args.authoritative
  };
}

export function isBalanceStale(balance: BalanceCell, now = Date.now(), staleAfterMs = 60_000): boolean {
  return now - new Date(balance.lastSyncedAt).getTime() > staleAfterMs;
}

export function summarizeBalanceContext(balance: BalanceCell): string {
  const stale = isBalanceStale(balance) ? "stale" : "fresh";
  return `${balance.availableDays} available, ${balance.pendingDays} pending, HCM v${balance.version}, ${stale}`;
}
