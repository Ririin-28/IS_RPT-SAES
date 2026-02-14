import { NextResponse } from "next/server";
import { promoteStudentPhonemic, type SubjectName } from "@/lib/students/promote-phonemic";

const SUBJECT_MAP: Record<string, SubjectName> = {
  english: "English",
  filipino: "Filipino",
  math: "Math",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const studentId = body?.studentId ?? body?.student_id;
    const subjectInput = body?.subject;

    if (!studentId || !subjectInput) {
      return NextResponse.json(
        { success: false, error: "Student ID and subject are required." },
        { status: 400 },
      );
    }

    const subjectKey = String(subjectInput).trim().toLowerCase();
    const subject = SUBJECT_MAP[subjectKey];

    if (!subject) {
      return NextResponse.json(
        { success: false, error: "Unsupported subject." },
        { status: 400 },
      );
    }

    const result = await promoteStudentPhonemic(String(studentId), subject);

    return NextResponse.json({
      success: true,
      studentId: String(studentId),
      subject,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to promote student.";
    const normalized = message.toLowerCase();
    const status = normalized.includes("highest")
      ? 409
      : normalized.includes("not found") || normalized.includes("missing")
        ? 404
        : 400;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
