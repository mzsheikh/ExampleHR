import { NextRequest, NextResponse } from "next/server";
import { triggerAnniversaryBonus } from "@/lib/time-off/server-store";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { employeeId?: string };
  const balances = await triggerAnniversaryBonus(body.employeeId);

  return NextResponse.json({
    data: balances,
    warnings: ["HCM applied a work-anniversary bonus outside the ExampleHR request lifecycle."]
  });
}
