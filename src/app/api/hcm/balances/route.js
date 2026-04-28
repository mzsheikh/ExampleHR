import { NextResponse } from "next/server";
import { getBatchBalances } from "@/lib/time-off/repository";

export const runtime = "nodejs";
export async function GET() {
    const balances = await getBatchBalances();
    return NextResponse.json({
        data: balances,
        warnings: ["Batch hydration is expensive; clients should use this for boot and reconciliation only."]
    });
}
