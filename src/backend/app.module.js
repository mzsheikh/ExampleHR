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

export async function createBackendApp(options = {}) {
  const app = await NestFactory.create(BackendModule.register(options), {
    logger: options.logger ?? ["error", "warn", "log"]
  });
  app.enableShutdownHooks();
  return app;
}
