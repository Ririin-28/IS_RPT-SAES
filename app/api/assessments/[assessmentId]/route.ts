import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, props: { params: Promise<{ assessmentId: string }> }) {
  return NextResponse.json({ success: false, error: "Backend connection removed." }, { status: 404 });
}

export async function PUT(request: NextRequest, props: { params: Promise<{ assessmentId: string }> }) {
  return NextResponse.json({ success: true, message: "Backend connection removed." });
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ assessmentId: string }> }) {
  return NextResponse.json({ success: true, message: "Backend connection removed." });
}
