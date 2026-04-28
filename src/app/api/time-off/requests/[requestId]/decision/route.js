import { NextResponse } from "next/server";
import { decideRequest } from "@/lib/time-off/server-store";
export async function POST(request, { params }) {
    const { requestId } = await params;
    const body = (await request.json());
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
