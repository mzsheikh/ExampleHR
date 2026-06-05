// @vitest-environment node
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBackendApp } from "./app.module.js";

describe("Time-Off NestJS HTTP API", () => {
  let app;
  let server;

  beforeEach(async () => {
    app = await createBackendApp({ databasePath: ":memory:", logger: false });
    await app.init();
    server = app.getHttpServer();
  });

  afterEach(async () => {
    await app.close();
  });

  it("exposes health, batch balances, and per-cell HCM reads", async () => {
    await request(server).get("/health").expect(200).expect(({ body }) => {
      expect(body.status).toBe("ok");
    });

    await request(server).get("/hcm/balances").expect(200).expect(({ body }) => {
      expect(body.data).toHaveLength(3);
      expect(body.warnings[0]).toMatch(/Batch hydration is expensive/i);
    });

    await request(server)
      .get("/hcm/balance")
      .query({ employeeId: "emp-1001", locationId: "nyc" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.availableDays).toBe(10);
      });
  });

  it("runs the employee submit and manager approve lifecycle through REST", async () => {
    const submitResponse = await request(server)
      .post("/time-off/requests")
      .send({
        employeeId: "emp-1001",
        locationId: "nyc",
        days: 2,
        startsOn: "2026-05-04",
        endsOn: "2026-05-05",
        reason: "Recharge"
      })
      .expect(202);

    expect(submitResponse.body.data.request.status).toBe("pending");
    expect(submitResponse.body.data.balance.availableDays).toBe(8);

    await request(server)
      .post(`/time-off/requests/${submitResponse.body.data.request.id}/decision`)
      .send({ managerId: "mgr-3001", decision: "approve" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.request.status).toBe("approved");
        expect(body.data.balance.pendingDays).toBe(0);
      });
  });

  it("simulates HCM silent wrong success and conflict responses", async () => {
    await request(server)
      .post("/hcm/balance")
      .send({
        employeeId: "emp-1001",
        locationId: "nyc",
        availableDelta: -1,
        mode: "silent_wrong"
      })
      .expect(202)
      .expect(({ body }) => {
        expect(body.data.availableDays).toBe(10);
        expect(body.warnings[0]).toMatch(/read-after-write/i);
      });

    await request(server)
      .post("/time-off/requests")
      .send({
        employeeId: "emp-1001",
        locationId: "nyc",
        days: 1,
        startsOn: "2026-06-01",
        endsOn: "2026-06-01",
        reason: "Errand",
        mode: "conflict"
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toMatch(/Insufficient authoritative HCM balance/i);
      });
  });

  it("applies anniversary bonuses and resets seeded data", async () => {
    await request(server)
      .post("/hcm/anniversary-bonus")
      .send({ employeeId: "emp-1001" })
      .expect(202)
      .expect(({ body }) => {
        expect(body.data.find((balance) => balance.locationId === "nyc").availableDays).toBe(11);
      });

    await request(server)
      .post("/admin/reset")
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.balances.find((balance) => balance.locationId === "nyc").availableDays).toBe(10);
      });
  });
});
