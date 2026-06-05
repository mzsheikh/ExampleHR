import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query
} from "@nestjs/common";
import { TimeOffService } from "./time-off.service.js";

class HealthController {
  health() {
    return { status: "ok", service: "examplehr-time-off" };
  }
}

class HcmController {
  listBalances() {
    return this.timeOffService.listBalances();
  }

  readBalance(employeeId, locationId, mode) {
    return this.timeOffService.readBalance({ employeeId, locationId, mode });
  }

  writeBalance(body) {
    return this.timeOffService.writeHcmBalance(body ?? {});
  }

  anniversaryBonus(body) {
    return this.timeOffService.triggerAnniversaryBonus(body?.employeeId);
  }
}

class TimeOffController {
  listRequests(status) {
    return this.timeOffService.listRequests(status);
  }

  submit(body) {
    return this.timeOffService.submitTimeOff(body ?? {});
  }

  decide(requestId, body) {
    return this.timeOffService.decideRequest({ ...(body ?? {}), requestId });
  }
}

class AdminController {
  reset() {
    return this.timeOffService.reset();
  }
}

function decorateMethod(target, methodName, ...decorators) {
  const descriptor = Object.getOwnPropertyDescriptor(target.prototype, methodName);
  for (const decorator of decorators) {
    decorator(target.prototype, methodName, descriptor);
  }
}

Controller("health")(HealthController);
decorateMethod(HealthController, "health", Get());

Inject(TimeOffService)(HcmController.prototype, "timeOffService");
Controller("hcm")(HcmController);
decorateMethod(HcmController, "listBalances", Get("balances"));
decorateMethod(HcmController, "readBalance", Get("balance"));
Query("employeeId")(HcmController.prototype, "readBalance", 0);
Query("locationId")(HcmController.prototype, "readBalance", 1);
Query("mode")(HcmController.prototype, "readBalance", 2);
decorateMethod(HcmController, "writeBalance", Post("balance"), HttpCode(202));
Body()(HcmController.prototype, "writeBalance", 0);
decorateMethod(HcmController, "anniversaryBonus", Post("anniversary-bonus"), HttpCode(202));
Body()(HcmController.prototype, "anniversaryBonus", 0);

Inject(TimeOffService)(TimeOffController.prototype, "timeOffService");
Controller("time-off")(TimeOffController);
decorateMethod(TimeOffController, "listRequests", Get("requests"));
Query("status")(TimeOffController.prototype, "listRequests", 0);
decorateMethod(TimeOffController, "submit", Post("requests"), HttpCode(202));
Body()(TimeOffController.prototype, "submit", 0);
decorateMethod(TimeOffController, "decide", Post("requests/:requestId/decision"), HttpCode(200));
Param("requestId")(TimeOffController.prototype, "decide", 0);
Body()(TimeOffController.prototype, "decide", 1);

Inject(TimeOffService)(AdminController.prototype, "timeOffService");
Controller("admin")(AdminController);
decorateMethod(AdminController, "reset", Post("reset"), HttpCode(200));

export const backendControllers = [
  HealthController,
  HcmController,
  TimeOffController,
  AdminController
];
