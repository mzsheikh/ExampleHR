import { getSql } from "./client.js";

export async function setupDatabase() {
  const sql = getSql();

  await sql`
    create table if not exists employees (
      id text primary key,
      name text not null,
      manager_id text,
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists locations (
      id text primary key,
      name text not null
    )
  `;

  await sql`
    create table if not exists time_off_balances (
      employee_id text not null references employees(id),
      location_id text not null references locations(id),
      available_days integer not null,
      pending_days integer not null default 0,
      version integer not null default 1,
      last_synced_at timestamptz not null default now(),
      primary key (employee_id, location_id)
    )
  `;

  await sql`
    create table if not exists time_off_requests (
      id uuid primary key default gen_random_uuid(),
      employee_id text not null references employees(id),
      employee_name text not null,
      location_id text not null references locations(id),
      location_name text not null,
      days integer not null check (days > 0),
      starts_on date not null,
      ends_on date not null,
      reason text not null,
      status text not null,
      balance_version_at_submit integer not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists time_off_request_audit (
      id serial primary key,
      request_id uuid not null references time_off_requests(id),
      actor text not null,
      message text not null,
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    create index if not exists idx_time_off_requests_status_created
      on time_off_requests (status, created_at desc)
  `;
}

export async function seedDatabase() {
  const sql = getSql();

  await sql`
    insert into employees (id, name, manager_id)
    values
      ('emp-1001', 'Avery Johnson', 'mgr-3001'),
      ('emp-2002', 'Mina Patel', 'mgr-3001')
    on conflict (id) do update set
      name = excluded.name,
      manager_id = excluded.manager_id
  `;

  await sql`
    insert into locations (id, name)
    values
      ('nyc', 'New York'),
      ('london', 'London'),
      ('remote', 'Remote')
    on conflict (id) do update set
      name = excluded.name
  `;

  await sql`
    insert into time_off_balances (
      employee_id,
      location_id,
      available_days,
      pending_days,
      version,
      last_synced_at
    )
    values
      ('emp-1001', 'nyc', 10, 0, 7, now()),
      ('emp-1001', 'london', 4, 0, 3, now()),
      ('emp-2002', 'remote', 14, 2, 11, now())
    on conflict (employee_id, location_id) do nothing
  `;

  const existing = await sql`
    select id from time_off_requests where id = '11111111-1111-4111-8111-111111111111'
  `;

  if (existing.length === 0) {
    await sql`
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
        balance_version_at_submit
      )
      values (
        '11111111-1111-4111-8111-111111111111',
        'emp-2002',
        'Mina Patel',
        'remote',
        'Remote',
        2,
        '2026-05-18',
        '2026-05-19',
        'Family visit',
        'pending',
        11
      )
    `;

    await sql`
      insert into time_off_request_audit (request_id, actor, message)
      values (
        '11111111-1111-4111-8111-111111111111',
        'employee',
        'Submitted against HCM balance version 11.'
      )
    `;
  }
}
