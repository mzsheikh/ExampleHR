import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const DEFAULT_DB_PATH = join(process.cwd(), "data", "examplehr.sqlite");
const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");

function nowIso() {
  return new Date().toISOString();
}

function ensureParentDirectory(databasePath) {
  if (databasePath === ":memory:") {
    return;
  }

  mkdirSync(dirname(databasePath), { recursive: true });
}

function toBoolean(value) {
  return Boolean(value);
}

export class SqliteStore {
  constructor(options = {}) {
    this.databasePath = options.databasePath ?? process.env.TIME_OFF_DB_PATH ?? DEFAULT_DB_PATH;
    ensureParentDirectory(this.databasePath);
    this.db = new DatabaseSync(this.databasePath);
    this.db.exec("PRAGMA foreign_keys = ON");
    if (this.databasePath !== ":memory:") {
      this.db.exec("PRAGMA journal_mode = WAL");
    }
    this.migrate();
    if (options.seed !== false) {
      this.seed();
    }
  }

  onModuleDestroy() {
    this.close();
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
  }

  migrate() {
    this.db.exec(`
      create table if not exists employees (
        id text primary key,
        name text not null,
        manager_id text,
        created_at text not null
      );

      create table if not exists locations (
        id text primary key,
        name text not null
      );

      create table if not exists time_off_balances (
        employee_id text not null references employees(id),
        location_id text not null references locations(id),
        available_days integer not null check (available_days >= 0),
        pending_days integer not null default 0 check (pending_days >= 0),
        version integer not null default 1,
        last_synced_at text not null,
        primary key (employee_id, location_id)
      );

      create table if not exists time_off_requests (
        id text primary key,
        employee_id text not null references employees(id),
        employee_name text not null,
        location_id text not null references locations(id),
        location_name text not null,
        days integer not null check (days > 0),
        starts_on text not null,
        ends_on text not null,
        reason text not null,
        status text not null check (status in ('pending', 'approved', 'denied', 'needs_review')),
        balance_held integer not null default 0 check (balance_held in (0, 1)),
        balance_version_at_submit integer not null,
        created_at text not null,
        updated_at text not null
      );

      create table if not exists time_off_request_audit (
        id integer primary key autoincrement,
        request_id text not null references time_off_requests(id),
        actor text not null,
        message text not null,
        created_at text not null
      );

      create index if not exists idx_time_off_requests_status_created
        on time_off_requests (status, created_at desc);
    `);
  }

  reset() {
    this.transaction(() => {
      this.db.exec(`
        delete from time_off_request_audit;
        delete from time_off_requests;
        delete from time_off_balances;
        delete from employees;
        delete from locations;
      `);
      this.seed();
    });
  }

  seed() {
    const timestamp = nowIso();
    const employeeStatement = this.db.prepare(`
      insert into employees (id, name, manager_id, created_at)
      values (?, ?, ?, ?)
      on conflict(id) do update set
        name = excluded.name,
        manager_id = excluded.manager_id
    `);
    employeeStatement.run("emp-1001", "Avery Johnson", "mgr-3001", timestamp);
    employeeStatement.run("emp-2002", "Mina Patel", "mgr-3001", timestamp);

    const locationStatement = this.db.prepare(`
      insert into locations (id, name)
      values (?, ?)
      on conflict(id) do update set name = excluded.name
    `);
    locationStatement.run("nyc", "New York");
    locationStatement.run("london", "London");
    locationStatement.run("remote", "Remote");

    const balanceStatement = this.db.prepare(`
      insert into time_off_balances (
        employee_id,
        location_id,
        available_days,
        pending_days,
        version,
        last_synced_at
      )
      values (?, ?, ?, ?, ?, ?)
      on conflict(employee_id, location_id) do nothing
    `);
    balanceStatement.run("emp-1001", "nyc", 10, 0, 7, timestamp);
    balanceStatement.run("emp-1001", "london", 4, 0, 3, timestamp);
    balanceStatement.run("emp-2002", "remote", 14, 2, 11, timestamp);

    const existing = this.db
      .prepare("select id from time_off_requests where id = ?")
      .get("11111111-1111-4111-8111-111111111111");

    if (!existing) {
      this.insertRequest({
        id: "11111111-1111-4111-8111-111111111111",
        employeeId: "emp-2002",
        employeeName: "Mina Patel",
        locationId: "remote",
        locationName: "Remote",
        days: 2,
        startsOn: "2026-05-18",
        endsOn: "2026-05-19",
        reason: "Family visit",
        status: "pending",
        balanceHeld: true,
        balanceVersionAtSubmit: 11,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      this.insertAudit(
        "11111111-1111-4111-8111-111111111111",
        "employee",
        "Submitted against HCM balance version 11.",
        timestamp
      );
    }
  }

  transaction(work) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  listBalances() {
    return this.db
      .prepare(`
        select
          b.employee_id,
          e.name as employee_name,
          b.location_id,
          l.name as location_name,
          b.available_days,
          b.pending_days,
          b.version,
          b.last_synced_at
        from time_off_balances b
        join employees e on e.id = b.employee_id
        join locations l on l.id = b.location_id
        order by e.name asc, l.name asc
      `)
      .all()
      .map(mapBalance);
  }

  getBalance(employeeId, locationId) {
    const row = this.db
      .prepare(`
        select
          b.employee_id,
          e.name as employee_name,
          b.location_id,
          l.name as location_name,
          b.available_days,
          b.pending_days,
          b.version,
          b.last_synced_at
        from time_off_balances b
        join employees e on e.id = b.employee_id
        join locations l on l.id = b.location_id
        where b.employee_id = ?
          and b.location_id = ?
        limit 1
      `)
      .get(employeeId, locationId);

    return row ? mapBalance(row) : undefined;
  }

  adjustBalance(employeeId, locationId, { availableDelta = 0, pendingDelta = 0 }) {
    const timestamp = nowIso();
    const result = this.db
      .prepare(`
        update time_off_balances
        set
          available_days = available_days + ?,
          pending_days = pending_days + ?,
          version = version + 1,
          last_synced_at = ?
        where employee_id = ?
          and location_id = ?
          and available_days + ? >= 0
          and pending_days + ? >= 0
      `)
      .run(
        availableDelta,
        pendingDelta,
        timestamp,
        employeeId,
        locationId,
        availableDelta,
        pendingDelta
      );

    if (result.changes === 0) {
      return undefined;
    }

    return this.getBalance(employeeId, locationId);
  }

  triggerAnniversaryBonus(employeeId) {
    const timestamp = nowIso();
    this.db
      .prepare(`
        update time_off_balances
        set
          available_days = available_days + 1,
          version = version + 1,
          last_synced_at = ?
        where employee_id = ?
      `)
      .run(timestamp, employeeId);

    return this.listBalances().filter((balance) => balance.employeeId === employeeId);
  }

  insertRequest(input) {
    const id = input.id ?? randomUUID();
    const createdAt = input.createdAt ?? nowIso();
    const updatedAt = input.updatedAt ?? createdAt;
    this.db
      .prepare(`
        insert into time_off_requests (
          id,
          employee_id,
          employee_name,
          location_id,
          location_name,
          days,
          starts_on,
          ends_on,
          reason,
          status,
          balance_held,
          balance_version_at_submit,
          created_at,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.employeeId,
        input.employeeName,
        input.locationId,
        input.locationName,
        input.days,
        input.startsOn,
        input.endsOn,
        input.reason,
        input.status,
        input.balanceHeld ? 1 : 0,
        input.balanceVersionAtSubmit,
        createdAt,
        updatedAt
      );

    return this.getRequest(id);
  }

  getRequest(requestId) {
    const row = this.db.prepare("select * from time_off_requests where id = ?").get(requestId);
    return row ? mapRequest(row, this.listAudit(requestId)) : undefined;
  }

  listRequests(status) {
    const rows = status
      ? this.db
          .prepare("select * from time_off_requests where status = ? order by created_at desc")
          .all(status)
      : this.db.prepare("select * from time_off_requests order by created_at desc").all();

    return rows.map((row) => mapRequest(row, this.listAudit(row.id)));
  }

  updateRequest(requestId, patch) {
    const current = this.getRequest(requestId);
    if (!current) {
      return undefined;
    }

    const next = {
      status: patch.status ?? current.status,
      balanceHeld: patch.balanceHeld ?? current.balanceHeld,
      updatedAt: nowIso()
    };

    this.db
      .prepare(`
        update time_off_requests
        set status = ?, balance_held = ?, updated_at = ?
        where id = ?
      `)
      .run(next.status, next.balanceHeld ? 1 : 0, next.updatedAt, requestId);

    return this.getRequest(requestId);
  }

  insertAudit(requestId, actor, message, timestamp = nowIso()) {
    this.db
      .prepare(`
        insert into time_off_request_audit (request_id, actor, message, created_at)
        values (?, ?, ?, ?)
      `)
      .run(requestId, actor, message, timestamp);
  }

  listAudit(requestId) {
    return this.db
      .prepare(`
        select actor, message, created_at
        from time_off_request_audit
        where request_id = ?
        order by created_at asc, id asc
      `)
      .all(requestId)
      .map((row) => ({
        at: row.created_at,
        actor: row.actor,
        message: row.message
      }));
  }
}

function mapBalance(row) {
  return {
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    locationId: row.location_id,
    locationName: row.location_name,
    availableDays: row.available_days,
    pendingDays: row.pending_days,
    version: row.version,
    lastSyncedAt: row.last_synced_at
  };
}

function mapRequest(row, audit = []) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    locationId: row.location_id,
    locationName: row.location_name,
    days: row.days,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    reason: row.reason,
    status: row.status,
    balanceHeld: toBoolean(row.balance_held),
    balanceVersionAtSubmit: row.balance_version_at_submit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    audit
  };
}
