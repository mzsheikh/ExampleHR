import { NextRequest, NextResponse } from "next/server";
import { decideRequest } from "@/lib/time-off/server-store";
import type { DecisionInput } from "@/lib/time-off/types";

type Params = {
  params: Promise<{
    requestId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { requestId } = await params;
  const body = (await request.json()) as Omit<DecisionInput, "requestId">;
  const result = await decideRequest({ ...body, requestId });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.status });
  }

  return NextResponse.json({
    data: {
      request: result.request,
      balance: result.balance
    }
  });
}
