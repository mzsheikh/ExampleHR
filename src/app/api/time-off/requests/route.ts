import { NextRequest, NextResponse } from "next/server";
import { listRequests, submitTimeOff } from "@/lib/time-off/server-store";
import type { SubmitTimeOffInput } from "@/lib/time-off/types";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const requests = await listRequests(status);
  return NextResponse.json({ data: requests });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SubmitTimeOffInput;
  const result = await submitTimeOff(body);

  if (!result.ok) {
    return NextResponse.json(result, { status: result.status });
  }

  return NextResponse.json(
    {
      data: {
        request: result.request,
        balance: result.balance
      },
      warnings: "warning" in result && result.warning ? [result.warning] : undefined
    },
    { status: result.status }
  );
}
