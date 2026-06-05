import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { backendControllers } from "./controllers.js";
import { SqliteStore } from "./sqlite-store.js";
import { TimeOffService } from "./time-off.service.js";

export const BACKEND_OPTIONS = Symbol("BACKEND_OPTIONS");

export class BackendModule {
  static register(options = {}) {
    return {
      module: BackendModule,
      controllers: backendControllers,
      providers: [
        {
          provide: BACKEND_OPTIONS,
          useValue: options
        },
        {
          provide: SqliteStore,
          useFactory: (backendOptions) => new SqliteStore(backendOptions),
          inject: [BACKEND_OPTIONS]
        },
        {
          provide: TimeOffService,
          useFactory: (store) => new TimeOffService(store),
          inject: [SqliteStore]
        }
      ]
    };
  }
}

Module({})(BackendModule);

function resolveCorsOrigin(options) {
  if (options.corsOrigin !== undefined) {
    return options.corsOrigin;
  }

  const origin = process.env.CORS_ORIGIN;
  if (!origin || origin === "true" || origin === "*") {
    return true;
  }

  return origin.split(",").map((item) => item.trim()).filter(Boolean);
}

export async function createBackendApp(options = {}) {
  const app = await NestFactory.create(BackendModule.register(options), {
    logger: options.logger ?? ["error", "warn", "log"]
  });
  app.enableCors({
    origin: resolveCorsOrigin(options),
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type"]
  });
  app.enableShutdownHooks();
  return app;
}
