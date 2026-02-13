import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ success: false, error: "Backend connection removed." }, { status: 404 }); }
export async function POST() { return NextResponse.json({ success: false, error: "Backend connection removed." }, { status: 404 }); }
