import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST() { return NextResponse.json({ success: false, error: "Backend connection removed." }, { status: 404 }); }
