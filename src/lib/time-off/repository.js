import { desc, eq } from "drizzle-orm";
import { getDb, getSql } from "@/lib/db/client";
import { requestAudit, timeOffRequests } from "@/lib/db/schema";

const sql = (...args) => getSql()(...args);
const db = new Proxy(
  {},
  {
    get(_target, property) {
      const database = getDb();
      const value = database[property];
      return typeof value === "function" ? value.bind(database) : value;
    }
  }
);

function delayForMode(mode) {
  if (mode !== "slow") {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, 900));
}

function toIso(value) {
  return new Date(value).toISOString();
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
    lastSyncedAt: toIso(row.last_synced_at)
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
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    balanceVersionAtSubmit: row.balance_version_at_submit,
    audit
  };
}

async function auditForRequests(requestIds) {
  if (requestIds.length === 0) {
    return new Map();
  }

  const rows = await sql`
    select request_id, actor, message, created_at
    from time_off_request_audit
    where request_id = any(${requestIds})
    order by created_at asc, id asc
  `;

  const byRequest = new Map();
  for (const row of rows) {
    const items = byRequest.get(row.request_id) ?? [];
    items.push({
      at: toIso(row.created_at),
      actor: row.actor,
      message: row.message
    });
    byRequest.set(row.request_id, items);
  }

  return byRequest;
}

export async function getBatchBalances() {
  const rows = await sql`
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
  `;

  return rows.map(mapBalance);
}

export async function getBalance(employeeId, locationId, mode) {
  await delayForMode(mode);

  if (mode === "invalid_dimension") {
    return null;
  }

  const rows = await sql`
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
    where b.employee_id = ${employeeId}
      and b.location_id = ${locationId}
    limit 1
  `;

  return rows[0] ? mapBalance(rows[0]) : null;
}

export async function triggerAnniversaryBonus(employeeId = "emp-1001") {
  const rows = await sql`
    update time_off_balances b
    set
      available_days = available_days + 1,
      version = version + 1,
      last_synced_at = now()
    from employees e, locations l
    where b.employee_id = ${employeeId}
      and e.id = b.employee_id
      and l.id = b.location_id
    returning
      b.employee_id,
      e.name as employee_name,
      b.location_id,
      l.name as location_name,
      b.available_days,
      b.pending_days,
      b.version,
      b.last_synced_at
  `;

  return rows.map(mapBalance);
}

export async function submitTimeOff(input) {
  await delayForMode(input.mode);

  const before = await getBalance(input.employeeId, input.locationId, input.mode);

  if (!before) {
    return {
      ok: false,
      status: 422,
      error: "Invalid employee/location balance dimension."
    };
  }

  if (input.mode === "conflict" || before.availableDays < input.days) {
    return {
      ok: false,
      status: 409,
      error: "Insufficient authoritative HCM balance.",
      balance: before
    };
  }

  if (input.mode === "silent_wrong") {
    const rows = await sql`
      with inserted as (
        insert into time_off_requests (
          employee_id,
          employee_name,
          location_id,
          location_name,
          days,
          starts_on,
          ends_on,
          reason,
          status,
          balance_version_at_submit
        )
        values (
          ${before.employeeId},
          ${before.employeeName},
          ${before.locationId},
          ${before.locationName},
          ${input.days},
          ${input.startsOn},
          ${input.endsOn},
          ${input.reason},
          'needs_review',
          ${before.version}
        )
        returning *
      ),
      audit_submit as (
        insert into time_off_request_audit (request_id, actor, message)
        select id, 'employee', ${`Submitted against HCM balance version ${before.version}.`}
        from inserted
      ),
      audit_warning as (
        insert into time_off_request_audit (request_id, actor, message)
        select id, 'system', 'HCM returned success, but verification did not show the expected balance mutation.'
        from inserted
      )
      select * from inserted
    `;

    const audit = await auditForRequests([rows[0].id]);
    return {
      ok: true,
      status: 202,
      request: mapRequest(rows[0], audit.get(rows[0].id) ?? []),
      balance: before,
      warning: "HCM success response did not reconcile with a read-after-write check."
    };
  }

  const rows = await sql`
    with updated_balance as (
      update time_off_balances b
      set
        available_days = available_days - ${input.days},
        pending_days = pending_days + ${input.days},
        version = version + 1,
        last_synced_at = now()
      from employees e, locations l
      where b.employee_id = ${input.employeeId}
        and b.location_id = ${input.locationId}
        and b.available_days >= ${input.days}
        and e.id = b.employee_id
        and l.id = b.location_id
      returning
        b.employee_id,
        e.name as employee_name,
        b.location_id,
        l.name as location_name,
        b.available_days,
        b.pending_days,
        b.version,
        b.last_synced_at
    ),
    inserted as (
      insert into time_off_requests (
        employee_id,
        employee_name,
        location_id,
        location_name,
        days,
        starts_on,
        ends_on,
        reason,
        status,
        balance_version_at_submit
      )
      select
        employee_id,
        employee_name,
        location_id,
        location_name,
        ${input.days},
        ${input.startsOn},
        ${input.endsOn},
        ${input.reason},
        'pending',
        ${before.version}
      from updated_balance
      returning *
    ),
    audit_insert as (
      insert into time_off_request_audit (request_id, actor, message)
      select id, 'employee', ${`Submitted against HCM balance version ${before.version}.`}
      from inserted
    )
    select
      inserted.*,
      updated_balance.available_days,
      updated_balance.pending_days,
      updated_balance.version,
      updated_balance.last_synced_at
    from inserted
    join updated_balance on true
  `;

  if (rows.length === 0) {
    const latest = await getBalance(input.employeeId, input.locationId);
    return {
      ok: false,
      status: 409,
      error: "Insufficient authoritative HCM balance.",
      balance: latest
    };
  }

  const audit = await auditForRequests([rows[0].id]);
  return {
    ok: true,
    status: 202,
    request: mapRequest(rows[0], audit.get(rows[0].id) ?? []),
    balance: {
      employeeId: rows[0].employee_id,
      employeeName: rows[0].employee_name,
      locationId: rows[0].location_id,
      locationName: rows[0].location_name,
      availableDays: rows[0].available_days,
      pendingDays: rows[0].pending_days,
      version: rows[0].version,
      lastSyncedAt: toIso(rows[0].last_synced_at)
    }
  };
}

export async function listRequests(status) {
  const query = status
    ? db.select().from(timeOffRequests).where(eq(timeOffRequests.status, status)).orderBy(desc(timeOffRequests.createdAt))
    : db.select().from(timeOffRequests).orderBy(desc(timeOffRequests.createdAt));

  const rows = await query;
  const audit = await auditForRequests(rows.map((request) => request.id));
  return rows.map((request) => mapRequest(request, audit.get(request.id) ?? []));
}

export async function decideRequest(input) {
  await delayForMode(input.mode);

  const requestRows = await db.select().from(timeOffRequests).where(eq(timeOffRequests.id, input.requestId)).limit(1);
  const request = requestRows[0];

  if (!request) {
    return { ok: false, status: 404, error: "Request not found." };
  }

  const balance = await getBalance(request.employeeId, request.locationId, input.mode);

  if (!balance) {
    await db
      .update(timeOffRequests)
      .set({ status: "needs_review", updatedAt: new Date() })
      .where(eq(timeOffRequests.id, input.requestId));
    await db.insert(requestAudit).values({
      requestId: input.requestId,
      actor: "hcm",
      message: "Approval blocked because HCM no longer recognizes this balance dimension."
    });

    return { ok: false, status: 422, error: "Invalid HCM dimension." };
  }

  if (input.decision === "deny") {
    const rows = await sql`
      with updated_balance as (
        update time_off_balances b
        set
          available_days = available_days + ${request.days},
          pending_days = greatest(0, pending_days - ${request.days}),
          version = version + 1,
          last_synced_at = now()
        from employees e, locations l
        where b.employee_id = ${request.employeeId}
          and b.location_id = ${request.locationId}
          and e.id = b.employee_id
          and l.id = b.location_id
        returning
          b.employee_id,
          e.name as employee_name,
          b.location_id,
          l.name as location_name,
          b.available_days,
          b.pending_days,
          b.version,
          b.last_synced_at
      ),
      updated_request as (
        update time_off_requests
        set status = 'denied', updated_at = now()
        where id = ${input.requestId}
        returning *
      ),
      audit_insert as (
        insert into time_off_request_audit (request_id, actor, message)
        select id, 'manager', ${`Denied by ${input.managerId}; pending days released.`}
        from updated_request
      )
      select
        updated_request.*,
        updated_balance.available_days,
        updated_balance.pending_days,
        updated_balance.version,
        updated_balance.last_synced_at
      from updated_request
      join updated_balance on true
    `;

    const audit = await auditForRequests([input.requestId]);
    return {
      ok: true,
      status: 200,
      request: mapRequest(rows[0], audit.get(input.requestId) ?? []),
      balance: {
        employeeId: rows[0].employee_id,
        employeeName: rows[0].employee_name,
        locationId: rows[0].location_id,
        locationName: rows[0].location_name,
        availableDays: rows[0].available_days,
        pendingDays: rows[0].pending_days,
        version: rows[0].version,
        lastSyncedAt: toIso(rows[0].last_synced_at)
      }
    };
  }

  if (input.mode === "conflict" || balance.pendingDays < request.days) {
    await db
      .update(timeOffRequests)
      .set({ status: "needs_review", updatedAt: new Date() })
      .where(eq(timeOffRequests.id, input.requestId));
    await db.insert(requestAudit).values({
      requestId: input.requestId,
      actor: "hcm",
      message: "Approval blocked by HCM conflict during decision-time balance verification."
    });

    return {
      ok: false,
      status: 409,
      error: "Decision-time HCM balance verification failed.",
      balance
    };
  }

  const rows = await sql`
    with updated_balance as (
      update time_off_balances b
      set
        pending_days = greatest(0, pending_days - ${request.days}),
        version = version + 1,
        last_synced_at = now()
      from employees e, locations l
      where b.employee_id = ${request.employeeId}
        and b.location_id = ${request.locationId}
        and b.pending_days >= ${request.days}
        and e.id = b.employee_id
        and l.id = b.location_id
      returning
        b.employee_id,
        e.name as employee_name,
        b.location_id,
        l.name as location_name,
        b.available_days,
        b.pending_days,
        b.version,
        b.last_synced_at
    ),
    updated_request as (
      update time_off_requests
      set status = 'approved', updated_at = now()
      where id = ${input.requestId}
        and exists (select 1 from updated_balance)
      returning *
    ),
    audit_insert as (
      insert into time_off_request_audit (request_id, actor, message)
      select id, 'manager', ${`Approved by ${input.managerId} after real-time HCM verification.`}
      from updated_request
    )
    select
      updated_request.*,
      updated_balance.available_days,
      updated_balance.pending_days,
      updated_balance.version,
      updated_balance.last_synced_at
    from updated_request
    join updated_balance on true
  `;

  if (rows.length === 0) {
    return {
      ok: false,
      status: 409,
      error: "Decision-time HCM balance verification failed.",
      balance: await getBalance(request.employeeId, request.locationId)
    };
  }

  const audit = await auditForRequests([input.requestId]);
  return {
    ok: true,
    status: 200,
    request: mapRequest(rows[0], audit.get(input.requestId) ?? []),
    balance: {
      employeeId: rows[0].employee_id,
      employeeName: rows[0].employee_name,
      locationId: rows[0].location_id,
      locationName: rows[0].location_name,
      availableDays: rows[0].available_days,
      pendingDays: rows[0].pending_days,
      version: rows[0].version,
      lastSyncedAt: toIso(rows[0].last_synced_at)
    }
  };
}
