export type LocationId = "nyc" | "london" | "remote";

export type BalanceCell = {
  employeeId: string;
  employeeName: string;
  locationId: LocationId;
  locationName: string;
  availableDays: number;
  pendingDays: number;
  version: number;
  lastSyncedAt: string;
};

export type RequestStatus =
  | "draft"
  | "pending"
  | "approved"
  | "denied"
  | "hcm_rejected"
  | "rolled_back"
  | "needs_review";

export type TimeOffRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  locationId: LocationId;
  locationName: string;
  days: number;
  startsOn: string;
  endsOn: string;
  reason: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  balanceVersionAtSubmit: number;
  audit: RequestAuditEntry[];
};

export type RequestAuditEntry = {
  at: string;
  actor: "employee" | "manager" | "system" | "hcm";
  message: string;
};

export type HcmMode = "normal" | "conflict" | "silent_wrong" | "slow" | "invalid_dimension";

export type SubmitTimeOffInput = {
  employeeId: string;
  locationId: LocationId;
  days: number;
  startsOn: string;
  endsOn: string;
  reason: string;
  mode?: HcmMode;
};

export type DecisionInput = {
  requestId: string;
  managerId: string;
  decision: "approve" | "deny";
  mode?: HcmMode;
};

export type ApiEnvelope<T> = {
  data: T;
  warnings?: string[];
};

export type RequestFormState = {
  locationId: LocationId;
  days: number;
  startsOn: string;
  endsOn: string;
  reason: string;
};

export type ReconciliationEvent =
  | {
      kind: "accepted";
      balance: BalanceCell;
    }
  | {
      kind: "rejected";
      reason: string;
      authoritativeBalance?: BalanceCell;
    }
  | {
      kind: "silent_mismatch";
      expectedAvailableDays: number;
      authoritativeBalance: BalanceCell;
    };
