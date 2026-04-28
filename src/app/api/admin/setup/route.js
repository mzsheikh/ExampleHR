import { NextResponse } from "next/server";
import { seedDatabase, setupDatabase } from "@/lib/db/setup";

export const runtime = "nodejs";

export async function POST(request) {
  const setupToken = process.env.SETUP_TOKEN;

  if (setupToken && request.headers.get("x-setup-token") !== setupToken) {
    return NextResponse.json({ error: "Invalid setup token." }, { status: 401 });
  }

  await setupDatabase();
  await seedDatabase();

  return NextResponse.json({
    data: {
      ok: true,
      message: "Database schema is ready and seed data has been applied."
    }
  });
}
