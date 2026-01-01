import { NextRequest, NextResponse } from "next/server";
import { deleteStudents, fetchStudentById, updateStudent } from "@/lib/students";
import type { UpdateStudentRecordInput } from "@/lib/students/shared";

const normalizeOptionalString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const normalizeLrn = (value: unknown): string | null | undefined => {
  const raw = normalizeOptionalString(value);
  if (!raw) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 12) return raw;
  const formatted = `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return formatted;
};

const mapUpdateStudentInput = (raw: Record<string, unknown>): UpdateStudentRecordInput => ({
  studentIdentifier: normalizeOptionalString(raw.studentIdentifier ?? raw.studentId),
  lrn: normalizeLrn(raw.lrn),
  firstName: normalizeOptionalString(raw.firstName),
  middleName: normalizeOptionalString(raw.middleName),
  lastName: normalizeOptionalString(raw.lastName),
  suffix: normalizeOptionalString(raw.suffix),
  fullName: normalizeOptionalString(raw.fullName ?? raw.name),
  gradeLevel: normalizeOptionalString(raw.gradeLevel ?? raw.grade),
  section: normalizeOptionalString(raw.section),
  age: normalizeOptionalString(raw.age),
  guardianName: normalizeOptionalString(raw.guardianName ?? raw.guardian),
  guardianFirstName: normalizeOptionalString(raw.guardianFirstName),
  guardianMiddleName: normalizeOptionalString(raw.guardianMiddleName),
  guardianLastName: normalizeOptionalString(raw.guardianLastName),
  guardianSuffix: normalizeOptionalString(raw.guardianSuffix),
  guardianContact: normalizeOptionalString(raw.guardianContact),
  relationship: normalizeOptionalString(raw.relationship),
  address: normalizeOptionalString(raw.address),
  englishPhonemic: normalizeOptionalString(raw.englishPhonemic),
  filipinoPhonemic: normalizeOptionalString(raw.filipinoPhonemic),
  mathProficiency: normalizeOptionalString(raw.mathProficiency),
});

const respondWithError = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: message }, { status });

const parseId = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) {
    return respondWithError("Invalid student identifier.");
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    console.error("Invalid student update payload", error);
    return respondWithError("Invalid JSON payload.");
  }

  const userId = Number(payload?.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return respondWithError("userId must be provided for updates.");
  }

  try {
    const existing = await fetchStudentById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Student not found." }, { status: 404 });
    }

    const updatePayload = mapUpdateStudentInput(payload ?? {});
    const updated = await updateStudent(id, userId, existing.subject, updatePayload);

    return NextResponse.json({ success: true, data: updated ?? existing });
  } catch (error) {
    console.error("Failed to update student record", error);
    return NextResponse.json(
      { success: false, error: "Unable to update student." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) {
    return respondWithError("Invalid student identifier.");
  }

  const url = new URL(request.url);
  const userIdParam = url.searchParams.get("userId");
  const userId = Number(userIdParam);
  if (!Number.isFinite(userId) || userId <= 0) {
    return respondWithError("userId query parameter is required for deletions.");
  }

  try {
    const existing = await fetchStudentById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Student not found." }, { status: 404 });
    }

    await deleteStudents(userId, existing.subject, [id]);
    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("Failed to delete student record", error);
    return NextResponse.json(
      { success: false, error: "Unable to delete student." },
      { status: 500 },
    );
  }
}
