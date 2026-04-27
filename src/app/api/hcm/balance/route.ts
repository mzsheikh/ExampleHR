import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "@/lib/time-off/server-store";
import type { HcmMode, LocationId } from "@/lib/time-off/types";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const employeeId = search.get("employeeId");
  const locationId = search.get("locationId") as LocationId | null;
  const mode = search.get("mode") as HcmMode | null;

  if (!employeeId || !locationId) {
    return NextResponse.json({ error: "employeeId and locationId are required." }, { status: 400 });
  }

  const balance = await getBalance(employeeId, locationId, mode ?? undefined);
  if (!balance) {
    return NextResponse.json({ error: "Balance dimension not found." }, { status: 404 });
  }

  return NextResponse.json({ data: balance });
}
