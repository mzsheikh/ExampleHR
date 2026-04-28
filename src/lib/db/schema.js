import {
  date,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

export const employees = pgTable("employees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  managerId: text("manager_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const locations = pgTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull()
});

export const balances = pgTable(
  "time_off_balances",
  {
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id),
    availableDays: integer("available_days").notNull(),
    pendingDays: integer("pending_days").notNull().default(0),
    version: integer("version").notNull().default(1),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.employeeId, table.locationId] })
  })
);

export const timeOffRequests = pgTable("time_off_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  employeeName: text("employee_name").notNull(),
  locationId: text("location_id")
    .notNull()
    .references(() => locations.id),
  locationName: text("location_name").notNull(),
  days: integer("days").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull(),
  balanceVersionAtSubmit: integer("balance_version_at_submit").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const requestAudit = pgTable("time_off_request_audit", {
  id: serial("id").primaryKey(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => timeOffRequests.id),
  actor: text("actor").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
