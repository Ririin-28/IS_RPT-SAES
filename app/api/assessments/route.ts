import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json({ success: true, assessments: [] });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: "Backend connection removed.",
    assessmentId: 0,
    quizCode: "OFFLINE",
    qrToken: "OFFLINE",
  });
}
