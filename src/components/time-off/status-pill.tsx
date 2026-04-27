import type { RequestStatus } from "@/lib/time-off/types";

const labels: Record<RequestStatus, string> = {
  draft: "Draft",
  pending: "Pending HCM",
  approved: "Approved",
  denied: "Denied",
  hcm_rejected: "HCM rejected",
  rolled_back: "Rolled back",
  needs_review: "Needs review"
};

export function StatusPill({ status }: { status: RequestStatus }) {
  return <span className={`statusPill status-${status}`}>{labels[status]}</span>;
}
