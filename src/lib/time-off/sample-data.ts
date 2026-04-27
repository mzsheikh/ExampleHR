import type { BalanceCell, TimeOffRequest } from "./types";

export const CURRENT_EMPLOYEE_ID = "emp-1001";

export const seedBalances: BalanceCell[] = [
  {
    employeeId: "emp-1001",
    employeeName: "Avery Johnson",
    locationId: "nyc",
    locationName: "New York",
    availableDays: 10,
    pendingDays: 0,
    version: 7,
    lastSyncedAt: new Date(Date.now() - 1000 * 30).toISOString()
  },
  {
    employeeId: "emp-1001",
    employeeName: "Avery Johnson",
    locationId: "london",
    locationName: "London",
    availableDays: 4,
    pendingDays: 0,
    version: 3,
    lastSyncedAt: new Date(Date.now() - 1000 * 45).toISOString()
  },
  {
    employeeId: "emp-2002",
    employeeName: "Mina Patel",
    locationId: "remote",
    locationName: "Remote",
    availableDays: 14,
    pendingDays: 2,
    version: 11,
    lastSyncedAt: new Date(Date.now() - 1000 * 55).toISOString()
  }
];

export const seedRequests: TimeOffRequest[] = [
  {
    id: "req-9001",
    employeeId: "emp-2002",
    employeeName: "Mina Patel",
    locationId: "remote",
    locationName: "Remote",
    days: 2,
    startsOn: "2026-05-18",
    endsOn: "2026-05-19",
    reason: "Family visit",
    status: "pending",
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    balanceVersionAtSubmit: 11,
    audit: [
      {
        at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        actor: "employee",
        message: "Submitted against HCM balance version 11."
      }
    ]
  }
];
