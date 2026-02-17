import { NextRequest, NextResponse } from "next/server";
import {
  deleteAssessmentRecord,
  updateAssessmentRecord,
  type AssessmentPayload,
} from "@/lib/assessments/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ success: false, error: "Method not implemented." }, { status: 405 });
}

export async function PUT(request: NextRequest, props: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await props.params;
    const parsedId = Number(assessmentId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid assessment id." }, { status: 400 });
    }

    const payload = (await request.json()) as AssessmentPayload;
    if (!payload?.title?.trim()) {
      return NextResponse.json({ success: false, error: "Assessment title is required." }, { status: 400 });
    }

    if (!payload.startTime || !payload.endTime) {
      return NextResponse.json({ success: false, error: "Assessment schedule is required." }, { status: 400 });
    }

    if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
      return NextResponse.json({ success: false, error: "At least one question is required." }, { status: 400 });
    }

    const updated = await updateAssessmentRecord(parsedId, payload);
    return NextResponse.json({
      success: true,
      message: "Assessment updated successfully.",
      assessmentId: updated.assessmentId,
      quizCode: updated.quizCode,
      qrToken: updated.qrToken,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update assessment.";
    const status = message === "Assessment not found." ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await props.params;
    const parsedId = Number(assessmentId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid assessment id." }, { status: 400 });
    }

    await deleteAssessmentRecord(parsedId);
    return NextResponse.json({ success: true, message: "Assessment deleted successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete assessment.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
