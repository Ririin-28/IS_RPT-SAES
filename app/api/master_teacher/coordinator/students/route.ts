import { NextRequest, NextResponse } from "next/server";
import {
  fetchStudents as fetchStudentRecords,
  insertStudents,
} from "@/lib/students";
import type { CreateStudentRecordInput } from "@/lib/students/shared";
import { resolveStudentSubject, type StudentSubject } from "@/lib/students/shared";

const SUBJECT_FALLBACK: StudentSubject = "English";
const DEFAULT_PAGE_SIZE = 100;

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

const parsePositiveInteger = (value: string | null, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const mapCreateStudentInput = (raw: unknown): CreateStudentRecordInput => {
  const record = (raw ?? {}) as Record<string, unknown>;
  return {
    studentIdentifier: normalizeOptionalString(record.studentIdentifier ?? record.studentId),
    firstName: normalizeOptionalString(record.firstName),
    middleName: normalizeOptionalString(record.middleName),
    lastName: normalizeOptionalString(record.lastName),
    fullName: normalizeOptionalString(record.fullName ?? record.name),
    gradeLevel: normalizeOptionalString(record.gradeLevel ?? record.grade),
    section: normalizeOptionalString(record.section),
    age: normalizeOptionalString(record.age),
    guardianName: normalizeOptionalString(record.guardianName ?? record.guardian),
    guardianContact: normalizeOptionalString(record.guardianContact),
    relationship: normalizeOptionalString(record.relationship),
    address: normalizeOptionalString(record.address),
    englishPhonemic: normalizeOptionalString(record.englishPhonemic),
    filipinoPhonemic: normalizeOptionalString(record.filipinoPhonemic),
    mathProficiency: normalizeOptionalString(record.mathProficiency),
  } satisfies CreateStudentRecordInput;
};

const respondWithError = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: message }, { status });

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const subjectParam = url.searchParams.get("subject");

  if (!subjectParam) {
    return respondWithError("Subject query parameter is required.");
  }

  const subject = resolveStudentSubject(subjectParam, SUBJECT_FALLBACK);
  const search = url.searchParams.get("search");
  const gradeLevel = url.searchParams.get("gradeLevel");
  const section = url.searchParams.get("section");
  const page = parsePositiveInteger(url.searchParams.get("page"), 1);
  const pageSize = parsePositiveInteger(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);

  try {
    const result = await fetchStudentRecords({
      subject,
      search,
      gradeLevel,
      section,
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
    });
  } catch (error) {
    console.error("Failed to fetch student records", error);
    return NextResponse.json(
      { success: false, error: "Unable to load student records." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    console.error("Invalid students payload", error);
    return respondWithError("Invalid JSON payload.");
  }

  const createdBy = Number(payload?.createdBy);
  if (!Number.isFinite(createdBy) || createdBy <= 0) {
    return respondWithError("createdBy must be a valid user identifier.");
  }

  const subject = resolveStudentSubject(payload?.subject, SUBJECT_FALLBACK);
  const rawStudents = Array.isArray(payload?.students) ? payload?.students : [];
  if (rawStudents.length === 0) {
    return respondWithError("students array is required.");
  }

  const studentsPayload = rawStudents.map(mapCreateStudentInput);

  try {
    await insertStudents(createdBy, subject, studentsPayload);
    const result = await fetchStudentRecords({ subject, page: 1, pageSize: DEFAULT_PAGE_SIZE });
    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
    });
  } catch (error) {
    console.error("Failed to insert student records", error);
    return NextResponse.json(
      { success: false, error: "Unable to save student records." },
      { status: 500 },
    );
  }
}
