import { ConflictException, HttpException, Injectable, NotFoundException } from "@nestjs/common";

const SLOW_MODE_DELAY_MS = 900;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDays(days) {
  const parsed = Number(days);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpException({ error: "days must be a positive integer." }, 422);
  }
  return parsed;
}

function normalizeDelta(value, fieldName) {
  if (value === undefined || value === null) {
    return 0;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new HttpException({ error: `${fieldName} must be an integer.` }, 422);
  }
  return parsed;
}

function assertRequestDates(startsOn, endsOn) {
  if (!startsOn || !endsOn) {
    throw new HttpException({ error: "startsOn and endsOn are required." }, 422);
  }
  if (startsOn > endsOn) {
    throw new HttpException({ error: "startsOn must be before or equal to endsOn." }, 422);
  }
}

export class TimeOffService {
  constructor(store) {
    this.store = store;
  }

  async delayForMode(mode) {
    if (mode === "slow") {
      await sleep(SLOW_MODE_DELAY_MS);
    }
  }

  listBalances() {
    return {
      data: this.store.listBalances(),
      warnings: ["Batch hydration is expensive; use it for bootstrapping and reconciliation."]
    };
  }

  async readBalance(input) {
    await this.delayForMode(input.mode);
    if (input.mode === "invalid_dimension") {
      throw new NotFoundException({ error: "Balance dimension not found." });
    }

    const balance = this.store.getBalance(input.employeeId, input.locationId);
    if (!balance) {
      throw new NotFoundException({ error: "Balance dimension not found." });
    }

    return { data: balance };
  }

  async writeHcmBalance(input) {
    await this.delayForMode(input.mode);
    const before = this.store.getBalance(input.employeeId, input.locationId);
    if (!before || input.mode === "invalid_dimension") {
      throw new HttpException({ error: "Invalid employee/location balance dimension." }, 422);
    }
    if (input.mode === "conflict") {
      throw new ConflictException({
        error: "HCM rejected the cell write because the authoritative balance conflicted.",
        balance: before
      });
    }
    if (input.mode === "silent_wrong") {
      return {
        data: before,
        warnings: ["HCM returned success, but read-after-write verification showed no mutation."]
      };
    }

    const availableDelta = normalizeDelta(input.availableDelta, "availableDelta");
    const pendingDelta = normalizeDelta(input.pendingDelta, "pendingDelta");
    const updated = this.store.transaction(() =>
      this.store.adjustBalance(input.employeeId, input.locationId, {
        availableDelta,
        pendingDelta
      })
    );

    if (!updated) {
      throw new ConflictException({
        error: "HCM rejected the cell write because it would create a negative balance.",
        balance: before
      });
    }

    return { data: updated };
  }

  triggerAnniversaryBonus(employeeId = "emp-1001") {
    return {
      data: this.store.transaction(() => this.store.triggerAnniversaryBonus(employeeId)),
      warnings: ["HCM applied a work-anniversary bonus outside the ExampleHR request lifecycle."]
    };
  }

  listRequests(status) {
    return { data: this.store.listRequests(status) };
  }

  async submitTimeOff(input) {
    await this.delayForMode(input.mode);
    const days = normalizeDays(input.days);
    assertRequestDates(input.startsOn, input.endsOn);

    const before = this.store.getBalance(input.employeeId, input.locationId);
    if (!before || input.mode === "invalid_dimension") {
      throw new HttpException({ error: "Invalid employee/location balance dimension." }, 422);
    }
    if (input.mode === "conflict" || before.availableDays < days) {
      throw new ConflictException({
        error: "Insufficient authoritative HCM balance.",
        balance: before
      });
    }

    if (input.mode === "silent_wrong") {
      return this.store.transaction(() => {
        const request = this.store.insertRequest({
          employeeId: before.employeeId,
          employeeName: before.employeeName,
          locationId: before.locationId,
          locationName: before.locationName,
          days,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
          reason: input.reason ?? "Time off",
          status: "needs_review",
          balanceHeld: false,
          balanceVersionAtSubmit: before.version
        });
        this.store.insertAudit(request.id, "employee", `Submitted against HCM balance version ${before.version}.`);
        this.store.insertAudit(
          request.id,
          "system",
          "HCM returned success, but verification did not show the expected balance mutation."
        );
        return {
          data: {
            request: this.store.getRequest(request.id),
            balance: before
          },
          warnings: ["HCM success response did not reconcile with a read-after-write check."]
        };
      });
    }

    return this.store.transaction(() => {
      const latest = this.store.getBalance(input.employeeId, input.locationId);
      if (!latest || latest.availableDays < days) {
        throw new ConflictException({
          error: "Insufficient authoritative HCM balance.",
          balance: latest
        });
      }

      const balance = this.store.adjustBalance(input.employeeId, input.locationId, {
        availableDelta: -days,
        pendingDelta: days
      });
      const request = this.store.insertRequest({
        employeeId: latest.employeeId,
        employeeName: latest.employeeName,
        locationId: latest.locationId,
        locationName: latest.locationName,
        days,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        reason: input.reason ?? "Time off",
        status: "pending",
        balanceHeld: true,
        balanceVersionAtSubmit: latest.version
      });
      this.store.insertAudit(request.id, "employee", `Submitted against HCM balance version ${latest.version}.`);

      return {
        data: {
          request: this.store.getRequest(request.id),
          balance
        }
      };
    });
  }

  async decideRequest(input) {
    await this.delayForMode(input.mode);
    if (!["approve", "deny"].includes(input.decision)) {
      throw new HttpException({ error: "decision must be approve or deny." }, 422);
    }

    const current = this.store.getRequest(input.requestId);
    if (!current) {
      throw new NotFoundException({ error: "Request not found." });
    }
    if (["approved", "denied"].includes(current.status)) {
      throw new ConflictException({ error: "Request is already finalized." });
    }

    const balance = this.store.getBalance(current.employeeId, current.locationId);
    if (!balance || input.mode === "invalid_dimension") {
      this.store.transaction(() => {
        this.store.updateRequest(input.requestId, { status: "needs_review" });
        this.store.insertAudit(
          input.requestId,
          "hcm",
          "Approval blocked because HCM no longer recognizes this balance dimension."
        );
      });
      throw new HttpException({ error: "Invalid HCM dimension." }, 422);
    }

    if (input.decision === "deny") {
      return this.denyRequest(input, current);
    }

    return this.approveRequest(input, current, balance);
  }

  denyRequest(input, current) {
    return this.store.transaction(() => {
      let balance = this.store.getBalance(current.employeeId, current.locationId);
      if (current.balanceHeld) {
        balance = this.store.adjustBalance(current.employeeId, current.locationId, {
          availableDelta: current.days,
          pendingDelta: -current.days
        });
      }
      const request = this.store.updateRequest(input.requestId, {
        status: "denied",
        balanceHeld: false
      });
      this.store.insertAudit(
        input.requestId,
        "manager",
        `Denied by ${input.managerId ?? "manager"}; pending days released when a hold existed.`
      );

      return {
        data: {
          request: this.store.getRequest(request.id),
          balance
        }
      };
    });
  }

  approveRequest(input, current, balanceBeforeDecision) {
    const result = this.store.transaction(() => {
      const latest = this.store.getRequest(input.requestId);
      const balance = this.store.getBalance(latest.employeeId, latest.locationId);
      if (
        input.mode === "conflict" ||
        latest.status !== "pending" ||
        !latest.balanceHeld ||
        !balance ||
        balance.pendingDays < latest.days
      ) {
        this.store.updateRequest(input.requestId, { status: "needs_review" });
        this.store.insertAudit(
          input.requestId,
          "hcm",
          "Approval blocked by HCM conflict during decision-time balance verification."
        );
        return {
          conflict: {
            status: 409,
            body: {
              error: "Decision-time HCM balance verification failed.",
              balance: balance ?? balanceBeforeDecision
            }
          }
        };
      }

      const updatedBalance = this.store.adjustBalance(latest.employeeId, latest.locationId, {
        pendingDelta: -latest.days
      });
      const request = this.store.updateRequest(input.requestId, {
        status: "approved",
        balanceHeld: false
      });
      this.store.insertAudit(
        input.requestId,
        "manager",
        `Approved by ${input.managerId ?? "manager"} after real-time HCM verification.`
      );

      return {
        data: {
          request: this.store.getRequest(request.id),
          balance: updatedBalance
        }
      };
    });

    if (result.conflict) {
      throw new ConflictException(result.conflict.body);
    }

    return result;
  }

  reset() {
    this.store.reset();
    return {
      data: {
        balances: this.store.listBalances(),
        requests: this.store.listRequests()
      }
    };
  }
}

Injectable()(TimeOffService);
