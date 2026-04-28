import { NextResponse } from "next/server";
import { triggerAnniversaryBonus } from "@/lib/time-off/repository";

export const runtime = "nodejs";
export async function POST(request) {
    const body = (await request.json().catch(() => ({})));
    const balances = await triggerAnniversaryBonus(body.employeeId);
    return NextResponse.json({
        data: balances,
        warnings: ["HCM applied a work-anniversary bonus outside the ExampleHR request lifecycle."]
    });
}
