import { NextRequest, NextResponse } from "next/server";
import { ensureStudentSchema, fetchStudents, insertStudents } from "@/lib/students";
import type { CreateStudentRecordInput } from "@/lib/students/shared";
import { resolveCoordinatorSubject } from "@/lib/masterTeacher/coordinator";
import { normalizeMaterialSubject } from "@/lib/materials/shared";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;

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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const subjectParam = url.searchParams.get("subject");
  const search = url.searchParams.get("search") ?? null;
  const grade = url.searchParams.get("gradeLevel") ?? url.searchParams.get("grade") ?? null;
  const section = url.searchParams.get("section") ?? null;
  const page = parseNumber(url.searchParams.get("page")) ?? 1;
  const pageSize = parseNumber(url.searchParams.get("pageSize")) ?? DEFAULT_PAGE_SIZE;

  if (!subjectParam) {
    return NextResponse.json({ success: false, error: "subject query parameter is required" }, { status: 400 });
  }

  const subject = normalizeMaterialSubject(subjectParam);
  if (!subject) {
    return NextResponse.json({ success: false, error: "Unsupported subject" }, { status: 400 });
  }

  try {
    await ensureStudentSchema();
    const result = await fetchStudents({
      subject,
      search,
      gradeLevel: grade,
      section,
      page,
      pageSize,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Failed to fetch students", error);
    return NextResponse.json({ success: false, error: "Failed to load students" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const creatorUserId = parseNumber((body as Record<string, unknown>).createdBy);
  const requestedSubject = (body as Record<string, unknown>).subject;
  const subjectCandidate = normalizeMaterialSubject(String(requestedSubject ?? ""));

  if (!creatorUserId) {
    return NextResponse.json({ success: false, error: "Missing createdBy user id" }, { status: 400 });
  }

  const studentsPayload = Array.isArray((body as Record<string, unknown>).students)
    ? ((body as Record<string, unknown>).students as CreateStudentRecordInput[])
    : ((body as Record<string, unknown>).student ? [((body as Record<string, unknown>).student as CreateStudentRecordInput)] : []);

  if (studentsPayload.length === 0) {
    return NextResponse.json({ success: false, error: "No students provided" }, { status: 400 });
  }

  let resolvedSubject = subjectCandidate ?? null;

  try {
    if (!resolvedSubject) {
      resolvedSubject = await resolveCoordinatorSubject(creatorUserId);
    }

    if (!resolvedSubject) {
      return NextResponse.json({ success: false, error: "Unable to determine coordinator subject" }, { status: 400 });
    }

    await ensureStudentSchema();
    const inserted = await insertStudents(creatorUserId, resolvedSubject, studentsPayload);

    return NextResponse.json({ success: true, inserted, subject: resolvedSubject });
  } catch (error) {
    console.error("Failed to insert students", error);
    return NextResponse.json({ success: false, error: "Failed to save students" }, { status: 500 });
  }
}
