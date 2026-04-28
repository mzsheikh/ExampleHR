const labels = {
    draft: "Draft",
    pending: "Pending HCM",
    approved: "Approved",
    denied: "Denied",
    hcm_rejected: "HCM rejected",
    rolled_back: "Rolled back",
    needs_review: "Needs review"
};
export function StatusPill({ status }) {
    return <span className={`statusPill status-${status}`}>{labels[status]}</span>;
}
