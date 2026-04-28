import { NextResponse } from "next/server";
import { getBalance } from "@/lib/time-off/repository";

export const runtime = "nodejs";
export async function GET(request) {
    const search = request.nextUrl.searchParams;
    const employeeId = search.get("employeeId");
    const locationId = search.get("locationId");
    const mode = search.get("mode");
    if (!employeeId || !locationId) {
        return NextResponse.json({ error: "employeeId and locationId are required." }, { status: 400 });
    }
    const balance = await getBalance(employeeId, locationId, mode ?? undefined);
    if (!balance) {
        return NextResponse.json({ error: "Balance dimension not found." }, { status: 404 });
    }
    return NextResponse.json({ data: balance });
}
