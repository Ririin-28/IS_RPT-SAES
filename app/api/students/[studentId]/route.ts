import { NextRequest, NextResponse } from "next/server";
import { deleteStudents, fetchStudentById, updateStudent } from "@/lib/students";
import { resolveCoordinatorSubject } from "@/lib/masterTeacher/coordinator";
import type { UpdateStudentRecordInput } from "@/lib/students/shared";
import { normalizeMaterialSubject } from "@/lib/materials/shared";

export const dynamic = "force-dynamic";

function parseStudentId(param: string | string[] | null): number | null {
  if (!param) {
    return null;
  }
  const value = Array.isArray(param) ? param[0] : param;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export async function GET(_: NextRequest, { params }: { params: { studentId?: string } }) {
  const studentId = parseStudentId(params.studentId ?? null);
  if (!studentId) {
    return NextResponse.json({ success: false, error: "Invalid student id" }, { status: 400 });
  }

  try {
    const student = await fetchStudentById(studentId);
    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, student });
  } catch (error) {
    console.error("Failed to fetch student", error);
    return NextResponse.json({ success: false, error: "Failed to load student" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { studentId?: string } }) {
  const studentId = parseStudentId(params.studentId ?? null);
  if (!studentId) {
    return NextResponse.json({ success: false, error: "Invalid student id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const updaterUserId = parseNumber((body as Record<string, unknown>).updatedBy ?? (body as Record<string, unknown>).userId);
  if (!updaterUserId) {
    return NextResponse.json({ success: false, error: "Missing updatedBy user id" }, { status: 400 });
  }

  const subjectCandidate = normalizeMaterialSubject((body as Record<string, unknown>).subject as string | undefined ?? "");

  try {
    const resolvedSubject = subjectCandidate ?? (await resolveCoordinatorSubject(updaterUserId));
    if (!resolvedSubject) {
      return NextResponse.json({ success: false, error: "Unable to resolve subject" }, { status: 400 });
    }

    const updated = await updateStudent(
      studentId,
      updaterUserId,
      resolvedSubject,
      body as UpdateStudentRecordInput,
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, student: updated });
  } catch (error) {
    console.error("Failed to update student", error);
    return NextResponse.json({ success: false, error: "Failed to update student" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { studentId?: string } }) {
  const studentId = parseStudentId(params.studentId ?? null);
  if (!studentId) {
    return NextResponse.json({ success: false, error: "Invalid student id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const userParam = url.searchParams.get("userId") ?? url.searchParams.get("updatedBy") ?? null;
  const userId = parseNumber(userParam);
  if (!userId) {
    return NextResponse.json({ success: false, error: "Missing userId parameter" }, { status: 400 });
  }

  try {
    const subject = await resolveCoordinatorSubject(userId);
    if (!subject) {
      return NextResponse.json({ success: false, error: "Unable to resolve subject" }, { status: 400 });
    }

    const deleted = await deleteStudents(userId, subject, [studentId]);
    if (deleted === 0) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("Failed to delete student", error);
    return NextResponse.json({ success: false, error: "Failed to delete student" }, { status: 500 });
  }
}
