import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import {
  deleteStudents,
  fetchStudents as fetchStudentRecords,
  fetchStudentByLrnAcrossSubjects,
  insertStudents,
} from "@/lib/students";
import type { CreateStudentRecordInput } from "@/lib/students/shared";
import { resolveStudentSubject, type StudentSubject } from "@/lib/students/shared";
import { getTableColumns, query } from "@/lib/db";

const SUBJECT_FALLBACK: StudentSubject = "English";
const DEFAULT_PAGE_SIZE = 100;

const ASSIGNMENT_TABLE = "student_teacher_assignment";
const MASTER_TEACHER_TABLE = "master_teacher";
const COORDINATOR_HANDLED_TABLE = "mt_coordinator_handled";
const SUBJECT_TABLE = "subject";

const safeGetColumns = async (table: string): Promise<Set<string>> => {
  try {
    return await getTableColumns(table);
  } catch {
    return new Set<string>();
  }
};

const resolveMasterTeacherIdByUserId = async (userId: number): Promise<string | null> => {
  const columns = await safeGetColumns(MASTER_TEACHER_TABLE);
  if (!columns.has("master_teacher_id") || !columns.has("user_id")) {
    return null;
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT master_teacher_id FROM ${MASTER_TEACHER_TABLE} WHERE user_id = ? LIMIT 1`,
    [userId],
  );

  const value = rows?.[0]?.master_teacher_id;
  return value === null || value === undefined ? null : String(value).trim() || null;
};

const resolveSubjectId = async (subject: StudentSubject): Promise<number | null> => {
  const columns = await safeGetColumns(SUBJECT_TABLE);
  if (!columns.has("subject_id")) {
    return null;
  }
  const nameColumn = columns.has("subject_name") ? "subject_name" : columns.has("name") ? "name" : null;
  if (!nameColumn) {
    return null;
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT subject_id FROM ${SUBJECT_TABLE} WHERE LOWER(TRIM(${nameColumn})) = ? LIMIT 1`,
    [String(subject).toLowerCase()],
  );

  const parsed = Number(rows?.[0]?.subject_id);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseGradeNumber = (value: string | null): number | null => {
  if (!value) {
    return null;
  }
  const match = value.match(/\d+/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const isCoordinatorHandledForGradeAndSubject = async (
  masterTeacherId: string,
  gradeNumber: number | null,
  subjectId: number,
): Promise<boolean> => {
  const columns = await safeGetColumns(COORDINATOR_HANDLED_TABLE);
  if (!columns.has("master_teacher_id") || !columns.has("subject_id")) {
    return false;
  }

  const whereClauses = ["master_teacher_id = ?", "subject_id = ?"];
  const params: Array<string | number> = [masterTeacherId, subjectId];

  if (gradeNumber !== null && columns.has("grade_id")) {
    whereClauses.push("grade_id = ?");
    params.push(gradeNumber);
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT 1 AS matched FROM ${COORDINATOR_HANDLED_TABLE} WHERE ${whereClauses.join(" AND ")} LIMIT 1`,
    params,
  );

  return Boolean(rows?.length);
};

const fetchAssignedStudentIdsForCoordinator = async (
  masterTeacherId: string,
  subjectId: number,
  gradeNumber: number | null,
): Promise<Set<string>> => {
  const columns = await safeGetColumns(ASSIGNMENT_TABLE);
  if (!columns.has("student_id") || !columns.has("assigned_by_mt_id") || !columns.has("subject_id")) {
    return new Set<string>();
  }

  const whereClauses = ["assigned_by_mt_id = ?", "subject_id = ?"];
  const params: Array<string | number> = [masterTeacherId, subjectId];

  if (columns.has("is_active")) {
    whereClauses.push("is_active = 1");
  }

  if (gradeNumber !== null && columns.has("grade_id")) {
    whereClauses.push("grade_id = ?");
    params.push(gradeNumber);
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT DISTINCT student_id FROM ${ASSIGNMENT_TABLE} WHERE ${whereClauses.join(" AND ")}`,
    params,
  );

  return new Set(
    (rows ?? [])
      .map((row) => (row.student_id === null || row.student_id === undefined ? "" : String(row.student_id).trim()))
      .filter((value) => value.length > 0),
  );
};

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
    lrn: normalizeLrn(record.lrn),
    firstName: normalizeOptionalString(record.firstName),
    middleName: normalizeOptionalString(record.middleName),
    lastName: normalizeOptionalString(record.lastName),
    suffix: normalizeOptionalString(record.suffix),
    fullName: normalizeOptionalString(record.fullName ?? record.name),
    gradeLevel: normalizeOptionalString(record.gradeLevel ?? record.grade),
    section: normalizeOptionalString(record.section),
    age: normalizeOptionalString(record.age),
    guardianName: normalizeOptionalString(record.guardianName ?? record.guardian),
    guardianFirstName: normalizeOptionalString(record.guardianFirstName),
    guardianMiddleName: normalizeOptionalString(record.guardianMiddleName),
    guardianLastName: normalizeOptionalString(record.guardianLastName),
    guardianSuffix: normalizeOptionalString(record.guardianSuffix),
    guardianContact: normalizeOptionalString(record.guardianContact),
    guardianEmail: normalizeOptionalString(record.guardianEmail),
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
  const lrnParam = url.searchParams.get("lrn");

  if (lrnParam) {
    const normalizedLrn = normalizeLrn(lrnParam);
    if (!normalizedLrn) {
      return respondWithError("LRN query parameter is required.");
    }

    try {
      const student = await fetchStudentByLrnAcrossSubjects(normalizedLrn);
      return NextResponse.json({ success: true, data: student });
    } catch (error) {
      console.error("Failed to lookup student by LRN", error);
      return NextResponse.json(
        { success: false, error: "Unable to lookup student record." },
        { status: 500 },
      );
    }
  }

  if (!subjectParam) {
    return respondWithError("Subject query parameter is required.");
  }

  const subject = resolveStudentSubject(subjectParam, SUBJECT_FALLBACK);
  const search = url.searchParams.get("search");
  const gradeLevel = url.searchParams.get("gradeLevel");
  const section = url.searchParams.get("section");
  const userIdParam = url.searchParams.get("userId");
  const page = parsePositiveInteger(url.searchParams.get("page"), 1);
  const pageSize = parsePositiveInteger(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);

  try {
    const result = await fetchStudentRecords({
      subject,
      search,
      gradeLevel,
      section,
      page: 1,
      pageSize: 5000,
    });

    if (userIdParam) {
      const parsedUserId = Number.parseInt(userIdParam, 10);
      if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
        return respondWithError("userId must be a valid number when provided.");
      }

      const masterTeacherId = await resolveMasterTeacherIdByUserId(parsedUserId);
      if (!masterTeacherId) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { total: 0, page, pageSize },
        });
      }

      const subjectId = await resolveSubjectId(subject);
      if (subjectId === null) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { total: 0, page, pageSize },
        });
      }

      const gradeNumber = parseGradeNumber(gradeLevel);
      const isHandled = await isCoordinatorHandledForGradeAndSubject(masterTeacherId, gradeNumber, subjectId);
      if (!isHandled) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { total: 0, page, pageSize },
        });
      }

      const allowedIds = await fetchAssignedStudentIdsForCoordinator(masterTeacherId, subjectId, gradeNumber);
      const scoped = result.data.filter((student) => allowedIds.has(String(student.id)));
      const total = scoped.length;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paged = scoped.slice(start, end);

      return NextResponse.json({
        success: true,
        data: paged,
        pagination: {
          total,
          page,
          pageSize,
        },
      });
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paged = result.data.slice(start, end);

    return NextResponse.json({
      success: true,
      data: paged,
      pagination: {
        total: result.total,
        page,
        pageSize,
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
  const requestTime = new Date();

  try {
    await insertStudents(createdBy, subject, studentsPayload, { requestTime });
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
    const message = error instanceof Error ? error.message : "Unable to save student records.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    console.error("Invalid bulk delete payload", error);
    return respondWithError("Invalid JSON payload.");
  }

  const userId = Number(payload?.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return respondWithError("userId must be provided for deletions.");
  }

  const subject = resolveStudentSubject(payload?.subject, SUBJECT_FALLBACK);
  const rawIds = Array.isArray(payload?.ids) ? payload?.ids : [];
  const ids = rawIds
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);

  if (ids.length === 0) {
    return respondWithError("ids array is required.");
  }

  try {
    const deleted = await deleteStudents(userId, subject, ids);
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("Failed to bulk delete students", error);
    return NextResponse.json(
      { success: false, error: "Unable to delete students." },
      { status: 500 },
    );
  }
}
