import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

let cachedSql;
let cachedDb;

function getConnectionString() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Add your Neon PostgreSQL connection string in Vercel env vars.");
  }

  return process.env.DATABASE_URL;
}

export function getSql() {
  if (!cachedSql) {
    cachedSql = neon(getConnectionString());
  }

  return cachedSql;
}

export function getDb() {
  if (!cachedDb) {
    cachedDb = drizzle(getSql(), { schema });
  }

  return cachedDb;
}
