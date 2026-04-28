export function optimisticBalance(balance, requestedDays) {
    return {
        ...balance,
        availableDays: Math.max(0, balance.availableDays - requestedDays),
        pendingDays: balance.pendingDays + requestedDays,
        lastSyncedAt: new Date().toISOString()
    };
}
export function reconcileAfterSubmit(args) {
    if (!args.hcmAccepted) {
        return {
            kind: "rejected",
            reason: "HCM rejected the request.",
            authoritativeBalance: args.authoritative
        };
    }
    const expectedAvailableDays = args.before.availableDays - args.requestedDays;
    const acceptedExactly = args.authoritative.availableDays === expectedAvailableDays &&
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
export function isBalanceStale(balance, now = Date.now(), staleAfterMs = 60_000) {
    return now - new Date(balance.lastSyncedAt).getTime() > staleAfterMs;
}
export function summarizeBalanceContext(balance) {
    const stale = isBalanceStale(balance) ? "stale" : "fresh";
    return `${balance.availableDays} available, ${balance.pendingDays} pending, HCM v${balance.version}, ${stale}`;
}
