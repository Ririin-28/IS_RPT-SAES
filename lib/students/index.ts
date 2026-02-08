import "server-only";

import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getTableColumns, query, runWithConnection, tableExists } from "@/lib/db";
import {
  type StudentRecordDto,
  type StudentSubject,
  type CreateStudentRecordInput,
  type UpdateStudentRecordInput,
  STUDENT_SUBJECTS,
  type StudentQueryOptions,
  resolveStudentSubject,
} from "./shared";
import { normalizeMaterialSubject } from "@/lib/materials/shared";

export type StudentRecordRow = RowDataPacket & {
  row_num?: number;
  student_id?: string | null;
  student_identifier?: string | null;
  lrn?: string | null;
  grade_id?: number | null;
  section?: string | null;
  parent_id?: string | number | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
  parent_first_name?: string | null;
  parent_middle_name?: string | null;
  parent_last_name?: string | null;
  parent_suffix?: string | null;
  parent_phone_number?: string | null;
  parent_address?: string | null;
  english_phonemic_id?: number | null;
  filipino_phonemic_id?: number | null;
  math_phonemic_id?: number | null;
  english_phonemic?: string | null;
  filipino_phonemic?: string | null;
  math_phonemic?: string | null;
  subject_ids?: string | null;
};

// Coordinator flows should use the canonical student table
const STUDENT_TABLE = "student";

function toIso(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function buildFullName(
  input: CreateStudentRecordInput | UpdateStudentRecordInput,
  fallback?: string | null,
): string {
  const parts = [input.firstName, input.middleName, input.lastName]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);
  const suffix = typeof (input as any).suffix === "string" ? (input as any).suffix.trim() : "";
  if (suffix) {
    parts.push(suffix);
  }
  if (parts.length > 0) {
    return parts.join(" ");
  }
  if (typeof input.fullName === "string" && input.fullName.trim().length > 0) {
    return input.fullName.trim();
  }
  if (fallback && fallback.trim().length > 0) {
    return fallback.trim();
  }
  return "Unnamed Student";
}

function normalizeGradeValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/\d+/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return String(parsed);
}

const normalizeParentIdentifier = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const subjectIdCache = new Map<string, number>();

type PhonemicLevelLookup = Map<number, Map<string, number>>;
type PhonemicLevelCacheEntry = { loadedAt: number; lookup: PhonemicLevelLookup };

const PHONEMIC_CACHE_TTL_MS = 5 * 60 * 1000;
let phonemicLevelCache: PhonemicLevelCacheEntry | null = null;

const normalizePhonemicKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

async function getPhonemicLevelLookup(): Promise<PhonemicLevelLookup> {
  const now = Date.now();
  if (phonemicLevelCache && now - phonemicLevelCache.loadedAt < PHONEMIC_CACHE_TTL_MS) {
    return phonemicLevelCache.lookup;
  }

  const columns = await safeGetColumns("phonemic_level");
  const hasRequiredColumns = columns.has("phonemic_id") && columns.has("subject_id") && columns.has("level_name");
  if (!hasRequiredColumns) {
    const empty = new Map<number, Map<string, number>>();
    phonemicLevelCache = { loadedAt: now, lookup: empty };
    return empty;
  }

  const [rows] = await query<RowDataPacket[]>(
    "SELECT phonemic_id, subject_id, level_name FROM phonemic_level",
  );

  const lookup = new Map<number, Map<string, number>>();
  for (const row of rows) {
    const subjectId = Number(row.subject_id);
    const phonemicId = Number(row.phonemic_id);
    const levelName = typeof row.level_name === "string" ? row.level_name : "";
    if (!Number.isFinite(subjectId) || !Number.isFinite(phonemicId) || !levelName) {
      continue;
    }
    const key = normalizePhonemicKey(levelName);
    if (!lookup.has(subjectId)) {
      lookup.set(subjectId, new Map<string, number>());
    }
    lookup.get(subjectId)!.set(key, phonemicId);
  }

  phonemicLevelCache = { loadedAt: now, lookup };
  return lookup;
}

function resolvePhonemicLevelId(
  value: unknown,
  subjectId: number | null,
  lookup: PhonemicLevelLookup,
): number | null {
  if (!subjectId || value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const parsed = Number.parseInt(text, 10);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  const subjectLookup = lookup.get(subjectId);
  if (!subjectLookup) {
    return null;
  }

  const key = normalizePhonemicKey(text);
  return subjectLookup.get(key) ?? null;
}

const safeGetColumns = async (table: string): Promise<Set<string>> => {
  try {
    return await getTableColumns(table);
  } catch {
    return new Set<string>();
  }
};

async function resolveSubjectIdByName(name: string, subjectColumns: Set<string>): Promise<number | null> {
  const key = name.toLowerCase();
  if (subjectIdCache.has(key)) {
    return subjectIdCache.get(key) ?? null;
  }
  if (!subjectColumns.has("subject_id")) {
    return null;
  }
  const nameColumn = subjectColumns.has("subject_name")
    ? "subject_name"
    : subjectColumns.has("subject")
      ? "subject"
      : null;
  if (!nameColumn) {
    return null;
  }
  const [rows] = await query<RowDataPacket[]>(
    `SELECT subject_id FROM subject WHERE LOWER(${nameColumn}) = ? LIMIT 1`,
    [key],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    const id = Number(rows[0].subject_id);
    if (Number.isFinite(id)) {
      subjectIdCache.set(key, id);
      return id;
    }
  }
  return null;
}

function subjectSubjectId(subject: string, subjectColumns: Set<string>): number | null {
  const parsed = Number.parseInt(subject, 10);
  if (Number.isFinite(parsed)) return parsed;
  return null;
}

export async function ensureStudentSchema(): Promise<void> {
  const exists = await tableExists(STUDENT_TABLE).catch(() => false);
  if (!exists) {
    throw new Error("student table is missing; please provision it before using coordinator students.");
  }
}

export function studentRowToDto(row: StudentRecordRow): StudentRecordDto {
  const subject = normalizeMaterialSubject((row as any).subject) ?? "English";
  const fullName = row.full_name
    ?? buildFullName({
      firstName: row.first_name ?? null,
      middleName: row.middle_name ?? null,
      lastName: row.last_name ?? null,
      fullName: null,
    })
    ?? "Unnamed Student";
  const id = typeof row.student_id === "string" && row.student_id.trim().length > 0
    ? row.student_id.trim()
    : row.row_num != null
      ? String(row.row_num)
      : row.student_record_id != null
        ? String(row.student_record_id)
        : "0";
  const studentIdentifier = typeof row.student_identifier === "string" && row.student_identifier.trim().length > 0
    ? row.student_identifier.trim()
    : id;
  return {
    id,
    studentIdentifier,
    lrn: row.lrn ?? null,
    firstName: row.first_name ?? null,
    middleName: row.middle_name ?? null,
    lastName: row.last_name ?? null,
    fullName: fullName.trim(),
    suffix: row.suffix ?? null,
    gradeLevel: row.grade_level ?? (row.grade_id != null ? String(row.grade_id) : null),
    section: row.section ?? null,
    age: row.age ?? null,
    subject,
    guardianName: buildFullName({
      firstName: row.parent_first_name ?? null,
      middleName: row.parent_middle_name ?? null,
      lastName: row.parent_last_name ?? null,
      fullName: null,
      ...(row.parent_suffix ? { suffix: row.parent_suffix } as any : {}),
    }, row.guardian_name ?? null),
    guardianFirstName: row.parent_first_name ?? null,
    guardianMiddleName: row.parent_middle_name ?? null,
    guardianLastName: row.parent_last_name ?? null,
    guardianSuffix: row.parent_suffix ?? null,
    guardianContact: row.parent_phone_number ?? row.guardian_contact ?? null,
    guardianEmail: row.parent_email ?? null,
    relationship: row.relationship ?? null,
    address: row.parent_address ?? row.address ?? null,
    englishPhonemic: row.english_phonemic ?? (row.english_phonemic_id != null ? String(row.english_phonemic_id) : null),
    filipinoPhonemic: row.filipino_phonemic ?? (row.filipino_phonemic_id != null ? String(row.filipino_phonemic_id) : null),
    mathProficiency: row.math_phonemic ?? row.math_proficiency ?? (row.math_phonemic_id != null ? String(row.math_phonemic_id) : null),
    createdBy: row.created_by != null ? Number(row.created_by) : 0,
    updatedBy: row.updated_by !== null && row.updated_by !== undefined ? Number(row.updated_by) : null,
    createdAt: toIso(row.created_at ?? new Date()),
    updatedAt: toIso(row.updated_at ?? row.created_at ?? new Date()),
  } satisfies StudentRecordDto;
}

type StudentIdSequence = {
  prefix: string;
  next: number;
};

const studentIdSequenceCache = new WeakMap<any, StudentIdSequence>();

type ParentIdSequence = {
  prefix: string;
  next: number;
};

const parentIdSequenceCache = new WeakMap<any, ParentIdSequence>();

const deriveYearSuffix = (timestamp: Date) => timestamp.getFullYear().toString().slice(-2);

async function generateStudentId(connection: any, requestTime?: Date): Promise<string> {
  const timestamp = requestTime ?? new Date();
  const yearSuffix = deriveYearSuffix(timestamp);
  const expectedPrefix = `ST-${yearSuffix}`;

  let sequence = studentIdSequenceCache.get(connection);

  if (!sequence || sequence.prefix !== expectedPrefix) {
    const [rows] = (await connection.query(
      `SELECT student_id FROM \`${STUDENT_TABLE}\` WHERE student_id LIKE ? ORDER BY student_id DESC LIMIT 1`,
      [`${expectedPrefix}%`],
    )) as [RowDataPacket[]];

    let nextNum = 1;
    if (rows.length > 0) {
      const lastId = rows[0].student_id;
      const match = typeof lastId === "string" ? lastId.match(/^ST-\d{2}(\d{4,})$/) : null;
      if (match) {
        const parsed = Number.parseInt(match[1], 10);
        if (Number.isFinite(parsed)) {
          nextNum = parsed + 1;
        }
      }
    }

    sequence = { prefix: expectedPrefix, next: nextNum };
  }

  const identifier = `${sequence.prefix}${String(sequence.next).padStart(4, "0")}`;
  sequence.next += 1;
  studentIdSequenceCache.set(connection, sequence);

  return identifier;
}

async function generateParentId(connection: any, requestTime?: Date): Promise<string> {
  const timestamp = requestTime ?? new Date();
  const yearSuffix = deriveYearSuffix(timestamp);
  const expectedPrefix = `PA-${yearSuffix}`;

  let sequence = parentIdSequenceCache.get(connection);

  if (!sequence || sequence.prefix !== expectedPrefix) {
    const [rows] = (await connection.query(
      "SELECT parent_id FROM `parent` WHERE parent_id LIKE ? ORDER BY parent_id DESC LIMIT 1",
      [`${expectedPrefix}%`],
    )) as [RowDataPacket[]];

    let nextNum = 1;
    if (rows.length > 0) {
      const lastId = rows[0].parent_id;
      const match = typeof lastId === "string" ? lastId.match(/^PA-\d{2}(\d{4,})$/) : null;
      if (match) {
        const parsed = Number.parseInt(match[1], 10);
        if (Number.isFinite(parsed)) {
          nextNum = parsed + 1;
        }
      }
    }

    sequence = { prefix: expectedPrefix, next: nextNum };
  }

  const identifier = `${sequence.prefix}${String(sequence.next).padStart(4, "0")}`;
  sequence.next += 1;
  parentIdSequenceCache.set(connection, sequence);

  return identifier;
}



export async function insertStudents(
  userId: number,
  subject: StudentSubject,
  students: CreateStudentRecordInput[],
  options?: { requestTime?: Date },
): Promise<number> {
  if (students.length === 0) {
    return 0;
  }

  await ensureStudentSchema();
  const requestTime = options?.requestTime ?? new Date();
  const studentColumns = await safeGetColumns(STUDENT_TABLE);
  const assessmentColumns = await safeGetColumns("student_subject_assessment");
  const subjectColumns = await safeGetColumns("subject");
  const parentColumns = await safeGetColumns("parent");
  const parentStudentColumns = await safeGetColumns("parent_student");
  const userColumns = await safeGetColumns("users");
  const roleColumns = await safeGetColumns("role");

  const effectiveUserColumns = userColumns.size
    ? userColumns
    : new Set([
        "user_code",
        "email",
        "phone_number",
        "username",
        "first_name",
        "middle_name",
        "last_name",
        "password",
        "role_id",
        "created_at",
        "updated_at",
      ]);

  const availableStudentCols = [
    studentColumns.has("student_id") && "student_id",
    studentColumns.has("lrn") && "lrn",
    studentColumns.has("first_name") && "first_name",
    studentColumns.has("middle_name") && "middle_name",
    studentColumns.has("last_name") && "last_name",
    studentColumns.has("suffix") && "suffix",
    studentColumns.has("grade_id") && "grade_id",
    studentColumns.has("section") && "section",
    studentColumns.has("parent_id") && "parent_id",
    studentColumns.has("created_at") && "created_at",
    studentColumns.has("updated_at") && "updated_at",
  ].filter(Boolean) as string[];

  if (!availableStudentCols.length) {
    throw new Error("student table has no writable columns");
  }

  const resolveSubjectId = async (name: string | null | undefined): Promise<number | null> => {
    if (!name) return null;
    let id = subjectSubjectId(name, subjectColumns);
    if (!id && subjectColumns.size) {
      id = await resolveSubjectIdByName(name, subjectColumns);
    }
    return id;
  };

  const resolvedMainSubjectId = await resolveSubjectId(subject);
  const englishSubjectId = await resolveSubjectId("English");
  const filipinoSubjectId = await resolveSubjectId("Filipino");
  const mathSubjectId = await resolveSubjectId("Math");
  const phonemicLookup = await getPhonemicLevelLookup();

  return runWithConnection(async (connection) => {
    await connection.beginTransaction();
    try {
      const resolveParentRoleId = async (): Promise<number | null> => {
        if (!effectiveUserColumns.has("role_id")) {
          return null;
        }

        if (roleColumns.size && roleColumns.has("role_id") && roleColumns.has("role_name")) {
          try {
            const [roleRows] = await connection.query<RowDataPacket[]>(
              "SELECT role_id FROM role WHERE LOWER(role_name) IN ('parent','guardian') LIMIT 1",
            );
            const candidate = Number(roleRows?.[0]?.role_id);
            if (Number.isFinite(candidate)) {
              return candidate;
            }
          } catch (error) {
            // ignore and fall back to user-derived role ids
            console.warn("Unable to resolve parent role_id from role table", error);
          }
        }

        try {
          const [userRoleRows] = await connection.query<RowDataPacket[]>(
            "SELECT role_id FROM users WHERE role_id IS NOT NULL AND LOWER(role) IN ('parent','guardian') ORDER BY role_id LIMIT 1",
          );
          const candidate = Number(userRoleRows?.[0]?.role_id);
          if (Number.isFinite(candidate)) {
            return candidate;
          }
        } catch {
          // ignore
        }

        return null;
      };

      const parentRoleId = await resolveParentRoleId();
      let inserted = 0;

      const trimValue = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
      const uniqueValues = (values: string[]) => Array.from(new Set(values.filter((value) => value.length > 0)));

      const lrnCandidates: string[] = [];
      const parentEmails: string[] = [];
      const parentPhones: string[] = [];
      const parentUsernames: string[] = [];
      const parentUserCodes: string[] = [];

      for (const student of students) {
        const lrn = trimValue(student.lrn);
        if (lrn) {
          lrnCandidates.push(lrn);
          parentUserCodes.push(lrn);
        }
        const parentEmail = trimValue(student.guardianEmail);
        const parentPhone = trimValue(student.guardianContact);
        if (parentEmail) parentEmails.push(parentEmail);
        if (parentPhone) parentPhones.push(parentPhone);
        const candidateUsername = parentEmail || parentPhone || lrn;
        if (candidateUsername) parentUsernames.push(candidateUsername);
      }

      const existingStudentsByLrn = new Map<string, { studentId: string; parentId: string | null }>();
      const parentIdByStudentId = new Map<string, string>();
      const parentUserByParentId = new Map<string, number>();
      const userByEmail = new Map<string, number>();
      const userByPhone = new Map<string, number>();
      const userByUsername = new Map<string, number>();
      const userByUserCode = new Map<string, number>();
      const parentByEmail = new Map<string, { parentId: string; userId: number | null }>();
      const parentByPhone = new Map<string, { parentId: string; userId: number | null }>();
      const parentByUserId = new Map<number, string>();

      const lrnList = uniqueValues(lrnCandidates);
      if (lrnList.length && studentColumns.has("lrn") && studentColumns.has("student_id")) {
        const selectCols = ["student_id", "lrn"];
        if (studentColumns.has("parent_id")) {
          selectCols.push("parent_id");
        }
        const placeholders = lrnList.map(() => "?").join(", ");
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT ${selectCols.join(", ")} FROM \`${STUDENT_TABLE}\` WHERE lrn IN (${placeholders})`,
          lrnList,
        );

        const missingParentIds: string[] = [];
        for (const row of rows) {
          const rowLrn = trimValue((row as any).lrn);
          const studentId = trimValue((row as any).student_id);
          if (!rowLrn || !studentId) continue;
          const parentId = normalizeParentIdentifier((row as any).parent_id) ?? null;
          existingStudentsByLrn.set(rowLrn, { studentId, parentId });
          if (!parentId) {
            missingParentIds.push(studentId);
          }
        }

        if (missingParentIds.length && parentStudentColumns.has("parent_id") && parentStudentColumns.has("student_id")) {
          const studentPlaceholders = missingParentIds.map(() => "?").join(", ");
          const [linkRows] = await connection.query<RowDataPacket[]>(
            `SELECT student_id, parent_id FROM parent_student WHERE student_id IN (${studentPlaceholders})`,
            missingParentIds,
          );
          for (const row of linkRows) {
            const studentId = trimValue((row as any).student_id);
            const parentId = normalizeParentIdentifier((row as any).parent_id);
            if (studentId && parentId) {
              parentIdByStudentId.set(studentId, parentId);
            }
          }

          for (const [lrn, entry] of existingStudentsByLrn.entries()) {
            if (!entry.parentId) {
              const inferredParentId = parentIdByStudentId.get(entry.studentId) ?? null;
              existingStudentsByLrn.set(lrn, { studentId: entry.studentId, parentId: inferredParentId });
            }
          }
        }
      }

      const parentIdCandidates = uniqueValues(
        Array.from(existingStudentsByLrn.values())
          .map((entry) => normalizeParentIdentifier(entry.parentId ?? null) ?? "")
          .filter((value) => value.length > 0),
      );

      if (parentIdCandidates.length && parentColumns.has("parent_id") && parentColumns.has("user_id")) {
        const parentPlaceholders = parentIdCandidates.map(() => "?").join(", ");
        const [parentRows] = await connection.query<RowDataPacket[]>(
          `SELECT parent_id, user_id FROM parent WHERE parent_id IN (${parentPlaceholders})`,
          parentIdCandidates,
        );
        for (const row of parentRows) {
          const parentId = normalizeParentIdentifier((row as any).parent_id);
          const userId = Number((row as any).user_id);
          if (parentId && Number.isFinite(userId)) {
            parentUserByParentId.set(parentId, userId);
          }
        }
      }

      const emailList = uniqueValues(parentEmails);
      const phoneList = uniqueValues(parentPhones);
      const usernameList = uniqueValues(parentUsernames);
      const userCodeList = uniqueValues(parentUserCodes);

      if (emailList.length && effectiveUserColumns.has("email")) {
        const placeholders = emailList.map(() => "?").join(", ");
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT user_id, email FROM users WHERE email IN (${placeholders})`,
          emailList,
        );
        for (const row of rows) {
          const email = trimValue((row as any).email);
          const userId = Number((row as any).user_id);
          if (email && Number.isFinite(userId)) userByEmail.set(email, userId);
        }
      }

      if (phoneList.length && effectiveUserColumns.has("phone_number")) {
        const placeholders = phoneList.map(() => "?").join(", ");
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT user_id, phone_number FROM users WHERE phone_number IN (${placeholders})`,
          phoneList,
        );
        for (const row of rows) {
          const phone = trimValue((row as any).phone_number);
          const userId = Number((row as any).user_id);
          if (phone && Number.isFinite(userId)) userByPhone.set(phone, userId);
        }
      }

      if (usernameList.length && effectiveUserColumns.has("username")) {
        const placeholders = usernameList.map(() => "?").join(", ");
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT user_id, username FROM users WHERE username IN (${placeholders})`,
          usernameList,
        );
        for (const row of rows) {
          const username = trimValue((row as any).username);
          const userId = Number((row as any).user_id);
          if (username && Number.isFinite(userId)) userByUsername.set(username, userId);
        }
      }

      if (userCodeList.length && effectiveUserColumns.has("user_code")) {
        const placeholders = userCodeList.map(() => "?").join(", ");
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT user_id, user_code FROM users WHERE user_code IN (${placeholders})`,
          userCodeList,
        );
        for (const row of rows) {
          const userCode = trimValue((row as any).user_code);
          const userId = Number((row as any).user_id);
          if (userCode && Number.isFinite(userId)) userByUserCode.set(userCode, userId);
        }
      }

      if (emailList.length && parentColumns.has("email")) {
        const placeholders = emailList.map(() => "?").join(", ");
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT parent_id, user_id, email FROM parent WHERE email IN (${placeholders})`,
          emailList,
        );
        for (const row of rows) {
          const email = trimValue((row as any).email);
          const parentId = normalizeParentIdentifier((row as any).parent_id);
          const userId = Number((row as any).user_id);
          if (email && parentId) {
            parentByEmail.set(email, { parentId, userId: Number.isFinite(userId) ? userId : null });
          }
        }
      }

      if (phoneList.length && parentColumns.has("phone_number")) {
        const placeholders = phoneList.map(() => "?").join(", ");
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT parent_id, user_id, phone_number FROM parent WHERE phone_number IN (${placeholders})`,
          phoneList,
        );
        for (const row of rows) {
          const phone = trimValue((row as any).phone_number);
          const parentId = normalizeParentIdentifier((row as any).parent_id);
          const userId = Number((row as any).user_id);
          if (phone && parentId) {
            parentByPhone.set(phone, { parentId, userId: Number.isFinite(userId) ? userId : null });
          }
        }
      }

      const userIdsForParents = uniqueValues(
        Array.from(new Set([
          ...Array.from(userByEmail.values()),
          ...Array.from(userByPhone.values()),
          ...Array.from(userByUsername.values()),
          ...Array.from(userByUserCode.values()),
        ].map((value) => String(value)))),
      ).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);

      if (userIdsForParents.length && parentColumns.has("user_id") && parentColumns.has("parent_id")) {
        const placeholders = userIdsForParents.map(() => "?").join(", ");
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT parent_id, user_id FROM parent WHERE user_id IN (${placeholders})`,
          userIdsForParents,
        );
        for (const row of rows) {
          const parentId = normalizeParentIdentifier((row as any).parent_id);
          const userId = Number((row as any).user_id);
          if (parentId && Number.isFinite(userId)) {
            parentByUserId.set(userId, parentId);
          }
        }
      }

      const processedStudents: Array<{
        studentId: string;
        parentId: string | null;
        parentRelationship: string | null;
        parentAddress: string | null;
        student: CreateStudentRecordInput;
        gradeId: number | null;
        lrn: string | null;
        isNew: boolean;
      }> = [];
      const studentInsertRows: Array<Array<string | number | null>> = [];

      for (const student of students) {
        const normalizedGrade = normalizeGradeValue(student.gradeLevel);
        const gradeId = normalizedGrade ? Number(normalizedGrade) : null;

        let parentId: string | null = null;
        let parentUserId: number | null = null;
        let studentId: string | null = null;

        const lrn = trimValue(student.lrn) || null;
        const existing = lrn ? existingStudentsByLrn.get(lrn) : null;

        if (existing) {
          studentId = existing.studentId;
          parentId = existing.parentId ?? null;
          if (parentId && parentUserByParentId.has(parentId)) {
            parentUserId = parentUserByParentId.get(parentId) ?? null;
          }
        } else if (lrn) {
          const parentIdSelectable = studentColumns.has("parent_id");
          const selectCols = parentIdSelectable ? "student_id, parent_id" : "student_id";
          const [existingRows] = await connection.query<RowDataPacket[]>(
            `SELECT ${selectCols} FROM \`${STUDENT_TABLE}\` WHERE lrn = ? LIMIT 1`,
            [lrn],
          );

          if (Array.isArray(existingRows) && existingRows.length > 0) {
            const found = existingRows[0];
            const existingId = trimValue((found as any).student_id);
            const existingParentId = parentIdSelectable ? normalizeParentIdentifier((found as any).parent_id) : null;
            studentId = existingId && existingId.length > 0 ? existingId : null;
            parentId = existingParentId;
            if (studentId && !parentId && parentStudentColumns.has("parent_id") && parentStudentColumns.has("student_id")) {
              const cachedParent = parentIdByStudentId.get(studentId) ?? null;
              if (cachedParent) {
                parentId = cachedParent;
              } else {
                const [linkRows] = await connection.query<RowDataPacket[]>(
                  "SELECT parent_id FROM parent_student WHERE student_id = ? LIMIT 1",
                  [studentId],
                );
                if (Array.isArray(linkRows) && linkRows.length > 0) {
                  parentId = normalizeParentIdentifier((linkRows[0] as any).parent_id);
                }
              }
            }
            if (studentId) {
              existingStudentsByLrn.set(lrn, { studentId, parentId });
            }
            if (parentId && parentColumns.has("user_id")) {
              if (parentUserByParentId.has(parentId)) {
                parentUserId = parentUserByParentId.get(parentId) ?? null;
              } else {
                const [parentRows] = await connection.query<RowDataPacket[]>(
                  "SELECT user_id FROM parent WHERE parent_id = ? LIMIT 1",
                  [parentId],
                );
                const existingUser = Number(parentRows?.[0]?.user_id);
                if (Number.isFinite(existingUser)) {
                  parentUserId = existingUser;
                  parentUserByParentId.set(parentId, existingUser);
                }
              }
            }
          }
        }

        const parentName = trimValue(student.guardianName ?? "");
        const parentFirstName = student.guardianFirstName ?? parentName.split(" ")[0] ?? null;
        const parentLastName = student.guardianLastName
          ?? (parentName.split(" ").length > 1 ? parentName.split(" ").slice(-1).join(" ") : null);
        const parentMiddleName = student.guardianMiddleName ?? null;
        const parentSuffix = student.guardianSuffix ?? null;
        const parentEmail = trimValue(student.guardianEmail ?? "") || null;
        const parentPhone = trimValue(student.guardianContact ?? "") || null;
        const parentAddress = student.address ?? null;
        const parentRelationship = (student as any).relationship ?? null;

        const hasParentData = [parentName, parentFirstName, parentLastName, parentEmail, parentPhone, parentAddress]
          .some((v) => typeof v === "string" && v.trim().length > 0);

        if (hasParentData && !parentId) {
          if (!parentUserId && effectiveUserColumns.size) {
            if (parentEmail && effectiveUserColumns.has("email")) {
              const emailMatch = userByEmail.get(parentEmail);
              if (Number.isFinite(emailMatch)) parentUserId = emailMatch ?? null;
            }

            if (!parentUserId && parentPhone && effectiveUserColumns.has("phone_number")) {
              const phoneMatch = userByPhone.get(parentPhone);
              if (Number.isFinite(phoneMatch)) parentUserId = phoneMatch ?? null;
            }

            if (!parentUserId && effectiveUserColumns.has("username")) {
              const candidateUsername = parentEmail?.trim() || parentPhone?.trim() || (student.lrn ?? "").trim() || null;
              if (candidateUsername) {
                const usernameMatch = userByUsername.get(candidateUsername);
                if (Number.isFinite(usernameMatch)) parentUserId = usernameMatch ?? null;
              }
            }

            if (!parentUserId && effectiveUserColumns.has("user_code")) {
              const candidateCode = (student.lrn ?? "").trim() || null;
              if (candidateCode) {
                const userCodeMatch = userByUserCode.get(candidateCode);
                if (Number.isFinite(userCodeMatch)) parentUserId = userCodeMatch ?? null;
              }
            }
          }

          if (!parentId && parentUserId !== null && parentColumns.has("parent_id") && parentColumns.has("user_id")) {
            const existingParentId = parentByUserId.get(parentUserId);
            if (existingParentId) {
              parentId = existingParentId;
            }
          }

          if (!parentId && parentColumns.has("email") && parentEmail) {
            const existingParent = parentByEmail.get(parentEmail);
            if (existingParent) {
              parentId = existingParent.parentId;
              if (Number.isFinite(existingParent.userId)) parentUserId = existingParent.userId;
            }
          }

          if (!parentId && parentColumns.has("phone_number") && parentPhone) {
            const existingParent = parentByPhone.get(parentPhone);
            if (existingParent) {
              parentId = existingParent.parentId;
              if (Number.isFinite(existingParent.userId)) parentUserId = existingParent.userId;
            }
          }
        }

        if (hasParentData && parentColumns.size && !parentId) {
          const parentIdentifier = parentColumns.has("parent_id") ? await generateParentId(connection, requestTime) : null;
          const normalizedParentIdentifier = normalizeParentIdentifier(parentIdentifier);
          const parentUsername = parentEmail?.trim()
            || parentPhone?.trim()
            || normalizedParentIdentifier
            || (student.lrn ?? "").trim()
            || null;
          const parentPassword = (student.lrn ?? "").trim() || null;

          if (parentColumns.has("parent_id")) {
            if (normalizedParentIdentifier) {
              const [existingParent] = await connection.query<RowDataPacket[]>(
                "SELECT parent_id, user_id FROM parent WHERE parent_id = ? LIMIT 1",
                [normalizedParentIdentifier],
              );
              if (existingParent.length > 0) {
                parentId = normalizedParentIdentifier;
                if (Number.isFinite(Number((existingParent[0] as any).user_id))) {
                  parentUserId = Number((existingParent[0] as any).user_id);
                }
              }
            }

            if (!parentId) {
              const parentCols: string[] = [];
              const parentVals: Array<string | number | null> = [];
              const pushParent = (column: string, value: any) => {
                parentCols.push(column);
                parentVals.push(value);
              };

              if (normalizedParentIdentifier) pushParent("parent_id", normalizedParentIdentifier);
              if (parentColumns.has("first_name")) pushParent("first_name", parentFirstName ?? null);
              if (parentColumns.has("middle_name")) pushParent("middle_name", parentMiddleName ?? null);
              if (parentColumns.has("last_name")) pushParent("last_name", parentLastName ?? null);
              if (parentColumns.has("suffix")) pushParent("suffix", parentSuffix ?? null);
              if (parentColumns.has("phone_number")) pushParent("phone_number", parentPhone ?? null);
              if (parentColumns.has("email")) pushParent("email", parentEmail ?? null);
              if (parentColumns.has("address")) pushParent("address", parentAddress ?? null);
              if (parentColumns.has("relationship")) pushParent("relationship", parentRelationship ?? null);
              if (parentColumns.has("created_at")) pushParent("created_at", requestTime as any);
              if (parentColumns.has("updated_at")) pushParent("updated_at", requestTime as any);

              if (parentCols.length) {
                const parentSql = `INSERT INTO parent (${parentCols.map((c) => `\`${c}\``).join(", ")}) VALUES (${parentCols.map(() => "?").join(", ")})`;
                const [parentResult] = await connection.query<ResultSetHeader>(parentSql, parentVals);
                const insertIdCandidate = normalizeParentIdentifier((parentResult as any)?.insertId ?? null);
                parentId = normalizedParentIdentifier ?? insertIdCandidate;
              }
            }
          }

          if (effectiveUserColumns.size) {
            const userInsertColumns: string[] = [];
            const userInsertValues: Array<string | number | null> = [];
            const pushUser = (column: string, value: any) => {
              userInsertColumns.push(column);
              userInsertValues.push(value);
            };

            if (!parentUserId && normalizedParentIdentifier && effectiveUserColumns.has("user_code")) {
              const existingUserId = userByUserCode.get(normalizedParentIdentifier);
              if (Number.isFinite(existingUserId)) {
                parentUserId = existingUserId ?? null;
              }
            }

            if (!parentUserId && parentEmail && effectiveUserColumns.has("email")) {
              const existingUserId = userByEmail.get(parentEmail);
              if (Number.isFinite(existingUserId)) {
                parentUserId = existingUserId ?? null;
              }
            }

            if (!parentUserId && parentPhone && effectiveUserColumns.has("phone_number")) {
              const existingUserId = userByPhone.get(parentPhone);
              if (Number.isFinite(existingUserId)) {
                parentUserId = existingUserId ?? null;
              }
            }

            if (!parentUserId && parentUsername && effectiveUserColumns.has("username")) {
              const existingUserId = userByUsername.get(parentUsername);
              if (Number.isFinite(existingUserId)) {
                parentUserId = existingUserId ?? null;
              }
            }

            if (effectiveUserColumns.has("first_name")) pushUser("first_name", parentFirstName ?? null);
            if (effectiveUserColumns.has("middle_name")) pushUser("middle_name", parentMiddleName ?? null);
            if (effectiveUserColumns.has("last_name")) pushUser("last_name", parentLastName ?? null);
            if (effectiveUserColumns.has("suffix")) pushUser("suffix", parentSuffix ?? null);
            if (effectiveUserColumns.has("name")) pushUser("name", parentName || [parentFirstName, parentMiddleName, parentLastName].filter(Boolean).join(" "));
            if (effectiveUserColumns.has("email")) pushUser("email", parentEmail ?? null);
            if (effectiveUserColumns.has("username")) pushUser("username", parentUsername);
            if (effectiveUserColumns.has("contact_number")) pushUser("contact_number", parentPhone ?? null);
            if (effectiveUserColumns.has("phone_number")) pushUser("phone_number", parentPhone ?? null);
            if (effectiveUserColumns.has("role")) pushUser("role", "parent");
            if (effectiveUserColumns.has("role_id") && parentRoleId !== null) pushUser("role_id", parentRoleId);
            if (effectiveUserColumns.has("user_code") && (parentId || normalizedParentIdentifier)) {
              pushUser("user_code", parentId ?? normalizedParentIdentifier);
            }
            if (effectiveUserColumns.has("password")) pushUser("password", parentPassword);
            if (effectiveUserColumns.has("status")) pushUser("status", "Active");
            if (effectiveUserColumns.has("created_at")) pushUser("created_at", requestTime as any);
            if (effectiveUserColumns.has("updated_at")) pushUser("updated_at", requestTime as any);

            if (parentUserId === null && userInsertColumns.length) {
              const columnsSql = userInsertColumns.map((c) => `\`${c}\``).join(", ");
              const placeholders = userInsertColumns.map(() => "?").join(", ");
              const [userResult] = await connection.query<ResultSetHeader>(
                `INSERT INTO users (${columnsSql}) VALUES (${placeholders})`,
                userInsertValues,
              );
              const newUserId = Number((userResult as any)?.insertId);
              if (!Number.isFinite(newUserId) || newUserId <= 0) {
                throw new Error("Failed to create parent user record");
              }
              parentUserId = newUserId;
              if (parentId && parentColumns.has("user_id")) {
                await connection.query("UPDATE parent SET user_id = ? WHERE parent_id = ? LIMIT 1", [parentUserId, parentId]);
              }
              if (parentEmail) userByEmail.set(parentEmail, parentUserId);
              if (parentPhone) userByPhone.set(parentPhone, parentUserId);
              if (parentUsername) userByUsername.set(parentUsername, parentUserId);
              if (normalizedParentIdentifier) userByUserCode.set(normalizedParentIdentifier, parentUserId);
            }
          }

          if (parentId && parentUserId !== null && parentColumns.has("user_id")) {
            await connection.query("UPDATE parent SET user_id = ? WHERE parent_id = ? LIMIT 1", [parentUserId, parentId]);
          }

          if (!parentId) {
            parentId = normalizedParentIdentifier ?? null;
          }

          if (parentId && parentUserId !== null) {
            parentByUserId.set(parentUserId, parentId);
            parentUserByParentId.set(parentId, parentUserId);
          }
          if (parentEmail && parentId) {
            parentByEmail.set(parentEmail, { parentId, userId: parentUserId });
          }
          if (parentPhone && parentId) {
            parentByPhone.set(parentPhone, { parentId, userId: parentUserId });
          }
        }

        let isNew = false;
        if (!studentId) {
          const studentIdValue = studentColumns.has("student_id")
            ? await generateStudentId(connection, requestTime)
            : null;
          const studentCols = availableStudentCols;
          const studentVals = studentCols.map((col) => {
            switch (col) {
              case "student_id": return studentIdValue;
              case "lrn": return lrn;
              case "first_name": return student.firstName ?? null;
              case "middle_name": return student.middleName ?? null;
              case "last_name": return student.lastName ?? null;
              case "suffix": return (student as any).suffix ?? null;
              case "grade_id": return gradeId;
              case "section": return student.section ?? null;
              case "parent_id": return parentId;
              case "created_at": return requestTime as any;
              case "updated_at": return requestTime as any;
              default: return null;
            }
          });

          studentId = studentIdValue ? String(studentIdValue) : null;
          if (!studentId) {
            throw new Error("Failed to generate student identifier");
          }
          studentInsertRows.push(studentVals);
          isNew = true;
        } else {
          const updateCols: string[] = [];
          const updateVals: Array<string | number | null> = [];
          if (studentColumns.has("first_name") && student.firstName !== undefined) {
            updateCols.push("first_name = ?");
            updateVals.push(student.firstName ?? null);
          }
          if (studentColumns.has("middle_name") && student.middleName !== undefined) {
            updateCols.push("middle_name = ?");
            updateVals.push(student.middleName ?? null);
          }
          if (studentColumns.has("last_name") && student.lastName !== undefined) {
            updateCols.push("last_name = ?");
            updateVals.push(student.lastName ?? null);
          }
          if (studentColumns.has("suffix") && (student as any).suffix !== undefined) {
            updateCols.push("suffix = ?");
            updateVals.push((student as any).suffix ?? null);
          }
          if (studentColumns.has("grade_id") && gradeId !== null) {
            updateCols.push("grade_id = ?");
            updateVals.push(gradeId);
          }
          if (studentColumns.has("section") && student.section !== undefined) {
            updateCols.push("section = ?");
            updateVals.push(student.section ?? null);
          }
          if (studentColumns.has("parent_id") && parentId !== null) {
            updateCols.push("parent_id = ?");
            updateVals.push(parentId);
          }
          if (studentColumns.has("updated_at")) {
            updateCols.push("updated_at = ?");
            updateVals.push(requestTime as any);
          }
          if (updateCols.length > 0) {
            const updateSql = `UPDATE \`${STUDENT_TABLE}\` SET ${updateCols.join(", ")} WHERE student_id = ? LIMIT 1`;
            await connection.query(updateSql, [...updateVals, studentId]);
          }
        }

        processedStudents.push({
          studentId,
          parentId,
          parentRelationship,
          parentAddress,
          student,
          gradeId,
          lrn,
          isNew,
        });

        inserted += 1;
      }

      if (studentInsertRows.length > 0) {
        const insertColumns = availableStudentCols.map((c) => `\`${c}\``).join(", ");
        const chunkSize = 200;
        for (let i = 0; i < studentInsertRows.length; i += chunkSize) {
          const chunk = studentInsertRows.slice(i, i + chunkSize);
          const placeholders = chunk
            .map(() => `(${availableStudentCols.map(() => "?").join(", ")})`)
            .join(", ");
          const values = chunk.flat();
          await connection.query<ResultSetHeader>(
            `INSERT INTO \`${STUDENT_TABLE}\` (${insertColumns}) VALUES ${placeholders}`,
            values,
          );
        }
      }

      const parentLinkCandidates = parentStudentColumns.has("parent_id") && parentStudentColumns.has("student_id")
        ? processedStudents.filter((entry) => normalizeParentIdentifier(entry.parentId) && entry.studentId)
        : [];

      if (parentLinkCandidates.length) {
        const linkStudentIds = parentLinkCandidates.map((entry) => entry.studentId);
        const placeholders = linkStudentIds.map(() => "?").join(", ");
        const [linkRows] = await connection.query<RowDataPacket[]>(
          `SELECT student_id FROM parent_student WHERE student_id IN (${placeholders})`,
          linkStudentIds,
        );
        const existingLinks = new Set(
          Array.isArray(linkRows)
            ? linkRows.map((row) => trimValue((row as any).student_id)).filter((value) => value.length > 0)
            : [],
        );

        const relationCols: string[] = [];
        if (parentStudentColumns.has("parent_id")) relationCols.push("parent_id");
        if (parentStudentColumns.has("student_id")) relationCols.push("student_id");
        if (parentStudentColumns.has("relationship")) relationCols.push("relationship");
        if (parentStudentColumns.has("address")) relationCols.push("address");

        const insertRows: Array<Array<string | null>> = [];

        for (const entry of parentLinkCandidates) {
          const linkedParentId = normalizeParentIdentifier(entry.parentId);
          if (!linkedParentId) continue;
          if (!existingLinks.has(entry.studentId)) {
            const rowValues = relationCols.map((col) => {
              switch (col) {
                case "parent_id": return linkedParentId;
                case "student_id": return entry.studentId;
                case "relationship": return entry.parentRelationship ?? null;
                case "address": return entry.parentAddress ?? null;
                default: return null;
              }
            });
            insertRows.push(rowValues);
          } else {
            const updateCols: string[] = [];
            const updateVals: Array<string | null> = [];
            if (parentStudentColumns.has("parent_id")) {
              updateCols.push("parent_id = ?");
              updateVals.push(linkedParentId);
            }
            if (parentStudentColumns.has("relationship") && entry.parentRelationship) {
              updateCols.push("relationship = ?");
              updateVals.push(entry.parentRelationship);
            }
            if (parentStudentColumns.has("address") && entry.parentAddress) {
              updateCols.push("address = ?");
              updateVals.push(entry.parentAddress);
            }
            if (updateCols.length) {
              await connection.query(
                `UPDATE parent_student SET ${updateCols.join(", ")} WHERE student_id = ? LIMIT 1`,
                [...updateVals, entry.studentId],
              );
            }
          }
        }

        if (insertRows.length && relationCols.length) {
          const chunkSize = 200;
          for (let i = 0; i < insertRows.length; i += chunkSize) {
            const chunk = insertRows.slice(i, i + chunkSize);
            const placeholders = chunk
              .map(() => `(${relationCols.map(() => "?").join(", ")})`)
              .join(", ");
            const values = chunk.flat();
            await connection.query<ResultSetHeader>(
              `INSERT INTO parent_student (${relationCols.map((c) => `\`${c}\``).join(", ")}) VALUES ${placeholders}`,
              values,
            );
          }
        }
      }

      for (const entry of processedStudents) {
        const studentId = entry.studentId;
        if (!studentId) continue;

        if (
          assessmentColumns.has("student_id") &&
          assessmentColumns.has("subject_id") &&
          !assessmentColumns.has("phonemic_id")
        ) {
          if (resolvedMainSubjectId) {
            await connection.query(
              `INSERT INTO student_subject_assessment (student_id, subject_id, phonemic_id, assessed_at)
               VALUES (?, ?, NULL, ?)
               ON DUPLICATE KEY UPDATE assessed_at = VALUES(assessed_at)`,
              [studentId, resolvedMainSubjectId, requestTime],
            );
          }
        }

        if (assessmentColumns.has("student_id") && assessmentColumns.has("subject_id") && assessmentColumns.has("phonemic_id")) {
          const phonemicInserts: Array<[number, number]> = [];
          const englishId = resolvePhonemicLevelId(entry.student.englishPhonemic, englishSubjectId, phonemicLookup);
          if (englishId && englishSubjectId) phonemicInserts.push([englishSubjectId, englishId]);
          const filipinoId = resolvePhonemicLevelId(entry.student.filipinoPhonemic, filipinoSubjectId, phonemicLookup);
          if (filipinoId && filipinoSubjectId) phonemicInserts.push([filipinoSubjectId, filipinoId]);
          const mathId = resolvePhonemicLevelId(entry.student.mathProficiency, mathSubjectId, phonemicLookup);
          if (mathId && mathSubjectId) phonemicInserts.push([mathSubjectId, mathId]);

          for (const [subId, phonId] of phonemicInserts) {
            await connection.query(
              `INSERT INTO student_subject_assessment (student_id, subject_id, phonemic_id, assessed_at)
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE phonemic_id = VALUES(phonemic_id), assessed_at = VALUES(assessed_at)`,
              [studentId, subId, phonId, requestTime],
            );
          }
        }
      }
      await connection.commit();
      return inserted;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}

export async function deleteStudents(userId: number, subject: StudentSubject, ids: string[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  await ensureStudentSchema();
  const studentColumns = await safeGetColumns(STUDENT_TABLE);
  const parentStudentColumns = await safeGetColumns("parent_student");
  const parentColumns = await safeGetColumns("parent");
  const parentSessionColumns = await safeGetColumns("parent_sessions");
  const accountLogColumns = await safeGetColumns("account_logs");
  const trustedDeviceColumns = await safeGetColumns("trusted_devices");
  const userColumns = await safeGetColumns("users");
  const assessmentColumns = await safeGetColumns("student_subject_assessment");
  const subjectColumns = await safeGetColumns("subject");
  const assessmentAttemptColumns = await safeGetColumns("assessment_attempts");
  const assessmentAnswerColumns = await safeGetColumns("assessment_student_answers");
  const performanceColumns = await safeGetColumns("performance_records");
  const remarksColumns = await safeGetColumns("remarks");
  const attendanceRecordColumns = await safeGetColumns("attendance_record");
  const phonemicHistoryColumns = await safeGetColumns("student_phonemic_history");
  const remedialSessionColumns = await safeGetColumns("student_remedial_session");
  const remedialFlashcardColumns = await safeGetColumns("student_remedial_flashcard_performance");
  const parentNotificationColumns = await safeGetColumns("parent_notifications");
  const studentTeacherAssignmentColumns = await safeGetColumns("student_teacher_assignment");
  const studentTeacherAssignmentBackupColumns = await safeGetColumns("student_teacher_assignment_backup");

  // Resolve subject_id for subject-scoped deletions
  const subjectId = assessmentColumns.has("subject_id")
    ? await resolveSubjectIdByName(subject, subjectColumns)
    : null;

  const canScopedDelete = subjectId !== null && assessmentColumns.has("student_id") && assessmentColumns.has("subject_id");

  const fullDeleteIds: string[] = [];
  const scopedDeleteIds: string[] = [];

  if (canScopedDelete) {
    const idPlaceholders = ids.map(() => "?").join(", ");
    const [countRows] = await query<RowDataPacket[]>(
      `SELECT student_id, COUNT(DISTINCT subject_id) AS cnt
       FROM student_subject_assessment
       WHERE student_id IN (${idPlaceholders})
       GROUP BY student_id`,
      ids,
    );
    const countsById = new Map<string, number>(
      (Array.isArray(countRows) ? countRows : []).map((row) => [
        String(row.student_id),
        Number(row.cnt ?? 0),
      ]),
    );

    for (const studentId of ids) {
      const subjectCount = countsById.get(studentId) ?? 0;
      if (subjectCount > 1) {
        scopedDeleteIds.push(studentId);
      } else {
        fullDeleteIds.push(studentId);
      }
    }

    if (scopedDeleteIds.length > 0) {
      const placeholders = scopedDeleteIds.map(() => "?").join(", ");
      await query(
        `DELETE FROM student_subject_assessment WHERE student_id IN (${placeholders}) AND subject_id = ?`,
        [...scopedDeleteIds, subjectId],
      );
    }
  } else {
    fullDeleteIds.push(...ids);
  }

  // If nothing left for full delete, we are done
  if (fullDeleteIds.length === 0) {
    return scopedDeleteIds.length;
  }

  const studentIds = fullDeleteIds;
  const placeholders = studentIds.map(() => "?").join(", ");

  let parentIds: string[] = [];

  if (studentColumns.has("parent_id")) {
    const [parentRows] = await query<RowDataPacket[]>(
      `SELECT parent_id FROM \`${STUDENT_TABLE}\` WHERE student_id IN (${placeholders}) AND parent_id IS NOT NULL`,
      studentIds,
    );
    parentIds = Array.isArray(parentRows)
      ? Array.from(
          new Set(
            parentRows
              .map((row) => normalizeParentIdentifier(row.parent_id))
              .filter((value): value is string => typeof value === "string" && value.length > 0),
          ),
        )
      : [];
  } else if (parentStudentColumns.has("parent_id")) {
    const [parentRows] = await query<RowDataPacket[]>(
      `SELECT parent_id FROM parent_student WHERE student_id IN (${placeholders}) AND parent_id IS NOT NULL`,
      studentIds,
    );
    parentIds = Array.isArray(parentRows)
      ? Array.from(
          new Set(
            parentRows
              .map((row) => normalizeParentIdentifier(row.parent_id))
              .filter((value): value is string => typeof value === "string" && value.length > 0),
          ),
        )
      : [];
  }

  let parentUserIds: number[] = [];
  if (parentIds.length && parentColumns.has("parent_id") && parentColumns.has("user_id")) {
    const parentPlaceholders = parentIds.map(() => "?").join(", ");
    const [parentUserRows] = await query<RowDataPacket[]>(
      `SELECT user_id FROM parent WHERE parent_id IN (${parentPlaceholders}) AND user_id IS NOT NULL`,
      parentIds,
    );
    parentUserIds = Array.isArray(parentUserRows)
      ? Array.from(
          new Set(
            parentUserRows
              .map((row) => Number(row.user_id))
              .filter((value) => Number.isFinite(value) && value > 0),
          ),
        )
      : [];
  }

  await query(`DELETE FROM student_subject_assessment WHERE student_id IN (${placeholders})`, studentIds);
  if (parentStudentColumns.has("student_id")) {
    await query(`DELETE FROM parent_student WHERE student_id IN (${placeholders})`, studentIds);
  }

  if (attendanceRecordColumns.has("student_id")) {
    await query(`DELETE FROM attendance_record WHERE student_id IN (${placeholders})`, studentIds);
  }

  if (phonemicHistoryColumns.has("student_id")) {
    await query(`DELETE FROM student_phonemic_history WHERE student_id IN (${placeholders})`, studentIds);
  }

  if (parentNotificationColumns.has("student_id")) {
    await query(`DELETE FROM parent_notifications WHERE student_id IN (${placeholders})`, studentIds);
  }

  if (studentTeacherAssignmentColumns.has("student_id")) {
    await query(`DELETE FROM student_teacher_assignment WHERE student_id IN (${placeholders})`, studentIds);
  }
  if (studentTeacherAssignmentBackupColumns.has("student_id")) {
    await query(`DELETE FROM student_teacher_assignment_backup WHERE student_id IN (${placeholders})`, studentIds);
  }

  if (performanceColumns.has("student_id")) {
    if (performanceColumns.has("record_id") && remarksColumns.has("performance_record_id")) {
      const [recordRows] = await query<RowDataPacket[]>(
        `SELECT record_id FROM performance_records WHERE student_id IN (${placeholders})`,
        studentIds,
      );
      const recordIds = Array.isArray(recordRows)
        ? recordRows
          .map((row) => Number(row.record_id))
          .filter((value) => Number.isFinite(value) && value > 0)
        : [];
      if (recordIds.length) {
        const recordPlaceholders = recordIds.map(() => "?").join(", ");
        await query(
          `DELETE FROM remarks WHERE performance_record_id IN (${recordPlaceholders})`,
          recordIds,
        );
      }
    }
    await query(`DELETE FROM performance_records WHERE student_id IN (${placeholders})`, studentIds);
  }

  if (assessmentAttemptColumns.has("student_id")) {
    if (assessmentAttemptColumns.has("attempt_id") && assessmentAnswerColumns.has("attempt_id")) {
      const [attemptRows] = await query<RowDataPacket[]>(
        `SELECT attempt_id FROM assessment_attempts WHERE student_id IN (${placeholders})`,
        studentIds,
      );
      const attemptIds = Array.isArray(attemptRows)
        ? attemptRows
          .map((row) => Number(row.attempt_id))
          .filter((value) => Number.isFinite(value) && value > 0)
        : [];
      if (attemptIds.length) {
        const attemptPlaceholders = attemptIds.map(() => "?").join(", ");
        await query(
          `DELETE FROM assessment_student_answers WHERE attempt_id IN (${attemptPlaceholders})`,
          attemptIds,
        );
      }
    }
    await query(`DELETE FROM assessment_attempts WHERE student_id IN (${placeholders})`, studentIds);
  }

  if (remedialSessionColumns.has("student_id")) {
    if (remedialSessionColumns.has("session_id") && remedialFlashcardColumns.has("session_id")) {
      const [sessionRows] = await query<RowDataPacket[]>(
        `SELECT session_id FROM student_remedial_session WHERE student_id IN (${placeholders})`,
        studentIds,
      );
      const sessionIds = Array.isArray(sessionRows)
        ? sessionRows
          .map((row) => Number(row.session_id))
          .filter((value) => Number.isFinite(value) && value > 0)
        : [];
      if (sessionIds.length) {
        const sessionPlaceholders = sessionIds.map(() => "?").join(", ");
        await query(
          `DELETE FROM student_remedial_flashcard_performance WHERE session_id IN (${sessionPlaceholders})`,
          sessionIds,
        );
      }
    }
    await query(`DELETE FROM student_remedial_session WHERE student_id IN (${placeholders})`, studentIds);
  }

  const fullPlaceholders = fullDeleteIds.map(() => "?").join(", ");
  const [deleteResult] = await query<ResultSetHeader>(`DELETE FROM \`${STUDENT_TABLE}\` WHERE student_id IN (${fullPlaceholders})`, fullDeleteIds);
  const deletedCount = deleteResult.affectedRows ?? 0;

  if (parentIds.length && parentColumns.has("parent_id")) {
    const parentPlaceholders = parentIds.map(() => "?").join(", ");
    await query(`DELETE FROM parent WHERE parent_id IN (${parentPlaceholders})`, parentIds);
  }

  if (parentUserIds.length) {
    const userPlaceholders = parentUserIds.map(() => "?").join(", ");
    if (parentSessionColumns.has("user_id")) {
      await query(`DELETE FROM parent_sessions WHERE user_id IN (${userPlaceholders})`, parentUserIds);
    }
    if (accountLogColumns.has("user_id")) {
      await query(`DELETE FROM account_logs WHERE user_id IN (${userPlaceholders})`, parentUserIds);
    }
    if (trustedDeviceColumns.has("user_id")) {
      await query(`DELETE FROM trusted_devices WHERE user_id IN (${userPlaceholders})`, parentUserIds);
    }
    if (userColumns.has("user_id")) {
      await query(`DELETE FROM users WHERE user_id IN (${userPlaceholders})`, parentUserIds);
    }
  }

  return deletedCount;
}

export async function fetchStudents({
  subject,
  search,
  gradeLevel,
  section,
  page = 1,
  pageSize = 50,
}: StudentQueryOptions): Promise<{ data: StudentRecordDto[]; total: number; page: number; pageSize: number }> {
  await ensureStudentSchema();
  const studentColumns = await safeGetColumns(STUDENT_TABLE);
  const gradeColumns = await safeGetColumns("grade");
  const parentColumns = await safeGetColumns("parent");
  const parentStudentColumns = await safeGetColumns("parent_student");
  const userColumns = await safeGetColumns("users");
  const assessmentColumns = await safeGetColumns("student_subject_assessment");
  const subjectColumns = await safeGetColumns("subject");
  const phonemicLevelColumns = await safeGetColumns("phonemic_level");

  const hasParentJoin = parentColumns.size > 0 && studentColumns.has("parent_id");
  const canJoinParentStudent = parentStudentColumns.size > 0;
  const canJoinParentUser = hasParentJoin && parentColumns.has("user_id") && userColumns.size > 0;
  const canJoinGuardianUserViaCode = userColumns.has("user_code") && (hasParentJoin || canJoinParentStudent);

  const englishSubjectId = await resolveSubjectIdByName("English", subjectColumns);
  const filipinoSubjectId = await resolveSubjectIdByName("Filipino", subjectColumns);
  const mathSubjectId = await resolveSubjectIdByName("Math", subjectColumns);

  const selectParts: string[] = [
    "s.student_id AS row_num",
    "s.student_id AS student_id",
    studentColumns.has("lrn") ? "s.lrn AS lrn" : "NULL AS lrn",
    studentColumns.has("student_identifier") ? "s.student_identifier AS student_identifier" : "NULL AS student_identifier",
    studentColumns.has("first_name") ? "s.first_name AS first_name" : "NULL AS first_name",
    studentColumns.has("middle_name") ? "s.middle_name AS middle_name" : "NULL AS middle_name",
    studentColumns.has("last_name") ? "s.last_name AS last_name" : "NULL AS last_name",
    studentColumns.has("suffix") ? "s.suffix AS suffix" : "NULL AS suffix",
    studentColumns.has("grade_id") ? "s.grade_id AS grade_id" : "NULL AS grade_id",
    studentColumns.has("section") ? "s.section AS section" : "NULL AS section",
    studentColumns.has("parent_id") ? "s.parent_id AS parent_id" : "NULL AS parent_id",
  ];

  selectParts.push("NULL AS full_name");

  if (gradeColumns.size && gradeColumns.has("grade_level")) {
    selectParts.push("g.grade_level AS grade_level");
  } else {
    selectParts.push("NULL AS grade_level");
  }

  selectParts.push(
    canJoinParentStudent && parentStudentColumns.has("relationship")
      ? "ps.relationship AS relationship"
      : hasParentJoin && parentColumns.has("relationship")
        ? "p.relationship AS relationship"
        : "NULL AS relationship",
    canJoinParentStudent && parentStudentColumns.has("address")
      ? "ps.address AS parent_address"
      : hasParentJoin && parentColumns.has("address")
        ? "p.address AS parent_address"
        : "NULL AS parent_address",
    (() => {
      const sources: string[] = [];
      if (canJoinParentUser && userColumns.has("first_name")) sources.push("pu.first_name");
      if (canJoinGuardianUserViaCode && userColumns.has("first_name")) sources.push("gu.first_name");
      if (hasParentJoin && parentColumns.has("first_name")) sources.push("p.first_name");
      return sources.length ? `COALESCE(${sources.join(", ")}) AS parent_first_name` : "NULL AS parent_first_name";
    })(),
    (() => {
      const sources: string[] = [];
      if (canJoinParentUser && userColumns.has("middle_name")) sources.push("pu.middle_name");
      if (canJoinGuardianUserViaCode && userColumns.has("middle_name")) sources.push("gu.middle_name");
      if (hasParentJoin && parentColumns.has("middle_name")) sources.push("p.middle_name");
      return sources.length ? `COALESCE(${sources.join(", ")}) AS parent_middle_name` : "NULL AS parent_middle_name";
    })(),
    (() => {
      const sources: string[] = [];
      if (canJoinParentUser && userColumns.has("last_name")) sources.push("pu.last_name");
      if (canJoinGuardianUserViaCode && userColumns.has("last_name")) sources.push("gu.last_name");
      if (hasParentJoin && parentColumns.has("last_name")) sources.push("p.last_name");
      return sources.length ? `COALESCE(${sources.join(", ")}) AS parent_last_name` : "NULL AS parent_last_name";
    })(),
    (() => {
      const sources: string[] = [];
      if (canJoinParentUser && userColumns.has("suffix")) sources.push("pu.suffix");
      if (canJoinGuardianUserViaCode && userColumns.has("suffix")) sources.push("gu.suffix");
      if (hasParentJoin && parentColumns.has("suffix")) sources.push("p.suffix");
      return sources.length ? `COALESCE(${sources.join(", ")}) AS parent_suffix` : "NULL AS parent_suffix";
    })(),
    (() => {
      const sources: string[] = [];
      if (canJoinParentUser && userColumns.has("phone_number")) sources.push("pu.phone_number");
      if (canJoinGuardianUserViaCode && userColumns.has("phone_number")) sources.push("gu.phone_number");
      if (hasParentJoin && parentColumns.has("phone_number")) sources.push("p.phone_number");
      return sources.length ? `COALESCE(${sources.join(", ")}) AS parent_phone_number` : "NULL AS parent_phone_number";
    })(),
    (() => {
      const sources: string[] = [];
      if (canJoinParentUser && userColumns.has("email")) sources.push("pu.email");
      if (canJoinGuardianUserViaCode && userColumns.has("email")) sources.push("gu.email");
      if (hasParentJoin && parentColumns.has("email")) sources.push("p.email");
      return sources.length ? `COALESCE(${sources.join(", ")}) AS parent_email` : "NULL AS parent_email";
    })(),
  );

  const canUseAssessments = assessmentColumns.has("student_id")
    && assessmentColumns.has("subject_id")
    && assessmentColumns.has("phonemic_id");
  const canJoinPhonemicLevels = phonemicLevelColumns.has("phonemic_id") && phonemicLevelColumns.has("level_name");

  if (canUseAssessments) {
    if (canJoinPhonemicLevels) {
      selectParts.push(
        englishSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${englishSubjectId} THEN pl.level_name END) AS english_phonemic` : "NULL AS english_phonemic",
        englishSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${englishSubjectId} THEN ssa.phonemic_id END) AS english_phonemic_id` : "NULL AS english_phonemic_id",
        filipinoSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${filipinoSubjectId} THEN pl.level_name END) AS filipino_phonemic` : "NULL AS filipino_phonemic",
        filipinoSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${filipinoSubjectId} THEN ssa.phonemic_id END) AS filipino_phonemic_id` : "NULL AS filipino_phonemic_id",
        mathSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${mathSubjectId} THEN pl.level_name END) AS math_phonemic` : "NULL AS math_phonemic",
        mathSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${mathSubjectId} THEN ssa.phonemic_id END) AS math_phonemic_id` : "NULL AS math_phonemic_id",
      );
    } else {
      selectParts.push(
        englishSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${englishSubjectId} THEN ssa.phonemic_id END) AS english_phonemic_id` : "NULL AS english_phonemic_id",
        "NULL AS english_phonemic",
        filipinoSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${filipinoSubjectId} THEN ssa.phonemic_id END) AS filipino_phonemic_id` : "NULL AS filipino_phonemic_id",
        "NULL AS filipino_phonemic",
        mathSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${mathSubjectId} THEN ssa.phonemic_id END) AS math_phonemic_id` : "NULL AS math_phonemic_id",
        "NULL AS math_phonemic",
      );
    }
  } else {
    selectParts.push(
      "NULL AS english_phonemic",
      "NULL AS english_phonemic_id",
      "NULL AS filipino_phonemic",
      "NULL AS filipino_phonemic_id",
      "NULL AS math_phonemic",
      "NULL AS math_phonemic_id",
    );
  }

  if (assessmentColumns.size) {
    selectParts.push("GROUP_CONCAT(DISTINCT ssa.subject_id) AS subject_ids");
  }

  const joins: string[] = [];
  if (gradeColumns.size && studentColumns.has("grade_id")) {
    joins.push("LEFT JOIN grade g ON g.grade_id = s.grade_id");
  }
  if (hasParentJoin) {
    joins.push("LEFT JOIN parent p ON p.parent_id = s.parent_id");
  }
  if (canJoinParentStudent) {
    joins.push("LEFT JOIN parent_student ps ON ps.student_id = s.student_id");
  }
  if (canJoinGuardianUserViaCode) {
    const guardianMatch = hasParentJoin ? "s.parent_id" : "ps.parent_id";
    joins.push(`LEFT JOIN users gu ON gu.user_code = ${guardianMatch}`);
  }
  if (canJoinParentUser) {
    joins.push("LEFT JOIN users pu ON pu.user_id = p.user_id");
  }
  if (canUseAssessments) {
    joins.push("LEFT JOIN student_subject_assessment ssa ON ssa.student_id = s.student_id");
    if (canJoinPhonemicLevels) {
      joins.push("LEFT JOIN phonemic_level pl ON pl.phonemic_id = ssa.phonemic_id");
    }
  }

  const filters: string[] = [];
  const params: Array<string | number> = [];

  const normalizedGrade = normalizeGradeValue(gradeLevel ?? null);
  if (normalizedGrade && studentColumns.has("grade_id")) {
    filters.push("s.grade_id = ?");
    params.push(Number(normalizedGrade));
  } else if (normalizedGrade && gradeColumns.has("grade_level")) {
    filters.push("g.grade_level = ?");
    params.push(normalizedGrade);
  }

  if (section && section.trim() && studentColumns.has("section")) {
    filters.push("s.section = ?");
    params.push(section.trim());
  }

  if (search && search.trim()) {
    const wildcard = `%${search.trim()}%`;
    const searchFields: string[] = ["s.student_id", "s.lrn", "s.first_name", "s.last_name", "s.middle_name"];

    if (hasParentJoin) {
      if (parentColumns.has("address")) searchFields.push("p.address");
      if (parentColumns.has("first_name")) searchFields.push("p.first_name");
      if (parentColumns.has("last_name")) searchFields.push("p.last_name");
    }

    const likeClauses = searchFields.map((field) => `${field} LIKE ?`).join(" OR ");
    filters.push(`(${likeClauses})`);
    params.push(...searchFields.map(() => wildcard));
  }

  let subjectFilter: string | null = null;
  let subjectId: number | null = subjectSubjectId(subject, subjectColumns);
  if (!subjectId && subjectColumns.size) {
    subjectId = await resolveSubjectIdByName(subject, subjectColumns);
  }
  if (subjectId && assessmentColumns.size) {
    subjectFilter = "EXISTS (SELECT 1 FROM student_subject_assessment ssa2 WHERE ssa2.student_id = s.student_id AND ssa2.subject_id = ?)";
    filters.push(subjectFilter);
    params.push(subjectId);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const groupBy = "GROUP BY s.student_id";
  const havingClause = "";
  const offset = (Math.max(page, 1) - 1) * Math.max(pageSize, 1);

  const sql = `
    SELECT ${selectParts.join(", ")}
    FROM \`${STUDENT_TABLE}\` s
    ${joins.join("\n")}
    ${whereClause}
    ${groupBy}
    ${havingClause}
    ORDER BY s.student_id ASC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await query<StudentRecordRow[]>(sql, [...params, Math.max(pageSize, 1), offset]);

  const [countRows] = await query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT s.student_id) AS total FROM \`${STUDENT_TABLE}\` s ${joins.join("\n")} ${whereClause} ${havingClause}`,
    params,
  );

  const total = countRows.length > 0 ? Number(countRows[0].total) : rows.length;

  return {
    data: rows.map(studentRowToDto),
    total,
    page: Math.max(page, 1),
    pageSize: Math.max(pageSize, 1),
  };
}

export async function fetchStudentByLrnAcrossSubjects(lrn: string): Promise<StudentRecordDto | null> {
  const trimmed = lrn.trim();
  if (!trimmed) return null;

  for (const subject of STUDENT_SUBJECTS) {
    const result = await fetchStudents({
      subject,
      search: trimmed,
      page: 1,
      pageSize: 5,
    });

    const match = result.data.find((student) => (student.lrn ?? "").trim() === trimmed);
    if (match) {
      return match;
    }
  }

  return null;
}

export async function fetchStudentById(id: string): Promise<StudentRecordDto | null> {
  await ensureStudentSchema();
  const studentColumns = await safeGetColumns(STUDENT_TABLE);
  const gradeColumns = await safeGetColumns("grade");
  const parentColumns = await safeGetColumns("parent");
  const assessmentColumns = await safeGetColumns("student_subject_assessment");
  const phonemicLevelColumns = await safeGetColumns("phonemic_level");
  const subjectColumns = await safeGetColumns("subject");

  const englishSubjectId = await resolveSubjectIdByName("English", subjectColumns);
  const filipinoSubjectId = await resolveSubjectIdByName("Filipino", subjectColumns);
  const mathSubjectId = await resolveSubjectIdByName("Math", subjectColumns);

  const selectParts: string[] = [
    "1 AS row_num",
    "s.student_id AS student_id",
    studentColumns.has("lrn") ? "s.lrn AS lrn" : "NULL AS lrn",
    studentColumns.has("student_identifier") ? "s.student_identifier AS student_identifier" : "NULL AS student_identifier",
    studentColumns.has("first_name") ? "s.first_name AS first_name" : "NULL AS first_name",
    studentColumns.has("middle_name") ? "s.middle_name AS middle_name" : "NULL AS middle_name",
    studentColumns.has("last_name") ? "s.last_name AS last_name" : "NULL AS last_name",
    studentColumns.has("suffix") ? "s.suffix AS suffix" : "NULL AS suffix",
    studentColumns.has("grade_id") ? "s.grade_id AS grade_id" : "NULL AS grade_id",
    studentColumns.has("section") ? "s.section AS section" : "NULL AS section",
    studentColumns.has("parent_id") ? "s.parent_id AS parent_id" : "NULL AS parent_id",
  ];

  const joins: string[] = [];
  selectParts.push("NULL AS full_name");

  if (gradeColumns.size && studentColumns.has("grade_id")) {
    selectParts.push("g.grade_level AS grade_level");
    joins.push("LEFT JOIN grade g ON g.grade_id = s.grade_id");
  } else {
    selectParts.push("NULL AS grade_level");
  }

  if (parentColumns.size && studentColumns.has("parent_id")) {
    selectParts.push(
      parentColumns.has("relationship") ? "p.relationship AS relationship" : "NULL AS relationship",
      parentColumns.has("address") ? "p.address AS parent_address" : "NULL AS parent_address",
      parentColumns.has("first_name") ? "p.first_name AS parent_first_name" : "NULL AS parent_first_name",
      parentColumns.has("middle_name") ? "p.middle_name AS parent_middle_name" : "NULL AS parent_middle_name",
      parentColumns.has("last_name") ? "p.last_name AS parent_last_name" : "NULL AS parent_last_name",
      parentColumns.has("suffix") ? "p.suffix AS parent_suffix" : "NULL AS parent_suffix",
      parentColumns.has("phone_number") ? "p.phone_number AS parent_phone_number" : "NULL AS parent_phone_number",
      parentColumns.has("email") ? "p.email AS parent_email" : "NULL AS parent_email",
    );
    joins.push("LEFT JOIN parent p ON p.parent_id = s.parent_id");
  } else {
    selectParts.push(
      "NULL AS relationship",
      "NULL AS parent_address",
      "NULL AS parent_first_name",
      "NULL AS parent_middle_name",
      "NULL AS parent_last_name",
      "NULL AS parent_suffix",
      "NULL AS parent_phone_number",
      "NULL AS parent_email",
    );
  }

  const canUseAssessments = assessmentColumns.has("student_id")
    && assessmentColumns.has("subject_id")
    && assessmentColumns.has("phonemic_id");
  const canJoinPhonemicLevels = phonemicLevelColumns.has("phonemic_id") && phonemicLevelColumns.has("level_name");

  if (canUseAssessments) {
    joins.push("LEFT JOIN student_subject_assessment ssa ON ssa.student_id = s.student_id");
    if (canJoinPhonemicLevels) {
      joins.push("LEFT JOIN phonemic_level pl ON pl.phonemic_id = ssa.phonemic_id");
      selectParts.push(
        englishSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${englishSubjectId} THEN pl.level_name END) AS english_phonemic` : "NULL AS english_phonemic",
        englishSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${englishSubjectId} THEN ssa.phonemic_id END) AS english_phonemic_id` : "NULL AS english_phonemic_id",
        filipinoSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${filipinoSubjectId} THEN pl.level_name END) AS filipino_phonemic` : "NULL AS filipino_phonemic",
        filipinoSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${filipinoSubjectId} THEN ssa.phonemic_id END) AS filipino_phonemic_id` : "NULL AS filipino_phonemic_id",
        mathSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${mathSubjectId} THEN pl.level_name END) AS math_phonemic` : "NULL AS math_phonemic",
        mathSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${mathSubjectId} THEN ssa.phonemic_id END) AS math_phonemic_id` : "NULL AS math_phonemic_id",
      );
    } else {
      selectParts.push(
        englishSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${englishSubjectId} THEN ssa.phonemic_id END) AS english_phonemic_id` : "NULL AS english_phonemic_id",
        "NULL AS english_phonemic",
        filipinoSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${filipinoSubjectId} THEN ssa.phonemic_id END) AS filipino_phonemic_id` : "NULL AS filipino_phonemic_id",
        "NULL AS filipino_phonemic",
        mathSubjectId ? `MAX(CASE WHEN ssa.subject_id = ${mathSubjectId} THEN ssa.phonemic_id END) AS math_phonemic_id` : "NULL AS math_phonemic_id",
        "NULL AS math_phonemic",
      );
    }
  } else {
    selectParts.push(
      "NULL AS english_phonemic",
      "NULL AS english_phonemic_id",
      "NULL AS filipino_phonemic",
      "NULL AS filipino_phonemic_id",
      "NULL AS math_phonemic",
      "NULL AS math_phonemic_id",
    );
  }

  if (assessmentColumns.size) {
    selectParts.push("GROUP_CONCAT(DISTINCT ssa.subject_id) AS subject_ids");
    joins.push("LEFT JOIN student_subject_assessment ssa2 ON ssa2.student_id = s.student_id");
  }

  const sql = `
    SELECT ${selectParts.join(", ")}
    FROM \`${STUDENT_TABLE}\` s
    ${joins.join("\n")}
    WHERE s.student_id = ?
    GROUP BY s.student_id
    LIMIT 1
  `;

  const [rows] = await query<StudentRecordRow[]>(sql, [id]);
  if (rows.length === 0) {
    return null;
  }
  return studentRowToDto(rows[0]);
}

export async function updateStudent(
  id: string,
  userId: number,
  subject: StudentSubject,
  input: UpdateStudentRecordInput,
): Promise<StudentRecordDto | null> {
  await ensureStudentSchema();
  const studentColumns = await safeGetColumns(STUDENT_TABLE);
  const assessmentColumns = await safeGetColumns("student_subject_assessment");
  const phonemicLevelColumns = await safeGetColumns("phonemic_level");
  const subjectColumns = await safeGetColumns("subject");
  const parentColumns = await safeGetColumns("parent");
  const parentStudentColumns = await safeGetColumns("parent_student");
  const userColumns = await safeGetColumns("users");

  const englishSubjectId = await resolveSubjectIdByName("English", subjectColumns);
  const filipinoSubjectId = await resolveSubjectIdByName("Filipino", subjectColumns);
  const mathSubjectId = await resolveSubjectIdByName("Math", subjectColumns);
  const phonemicLookup = await getPhonemicLevelLookup();

  const updates: string[] = [];
  const params: Array<string | number | null> = [];

  const map: Record<string, keyof UpdateStudentRecordInput> = {
    lrn: "lrn",
    first_name: "firstName",
    middle_name: "middleName",
    last_name: "lastName",
    suffix: "suffix" as any,
    grade_id: "gradeLevel",
    section: "section",
  };

  const applyField = (col: string, value: any) => {
    if (studentColumns.has(col) && Object.prototype.hasOwnProperty.call(input, map[col])) {
      updates.push(`${col} = ?`);
      params.push(value);
    }
  };

  applyField("first_name", input.firstName ?? null);
  applyField("middle_name", input.middleName ?? null);
  applyField("last_name", input.lastName ?? null);
  applyField("suffix", (input as any).suffix ?? null);
  applyField("lrn", input.lrn ?? null);

  if (studentColumns.has("grade_id") && Object.prototype.hasOwnProperty.call(input, "gradeLevel")) {
    const normalizedGrade = normalizeGradeValue(input.gradeLevel ?? null);
    updates.push("grade_id = ?");
    params.push(normalizedGrade ? Number(normalizedGrade) : null);
  }

  if (studentColumns.has("section") && Object.prototype.hasOwnProperty.call(input, "section")) {
    updates.push("section = ?");
    params.push(input.section ?? null);
  }

  if (updates.length > 0) {
    const sql = `UPDATE \`${STUDENT_TABLE}\` SET ${updates.join(", ")} WHERE student_id = ? LIMIT 1`;
    await query(sql, [...params, id]);
  }

  if (parentColumns.size && studentColumns.has("parent_id")) {
    const [existing] = await query<RowDataPacket[]>(`SELECT parent_id FROM \`${STUDENT_TABLE}\` WHERE student_id = ? LIMIT 1`, [id]);
    const parentId = existing.length > 0 ? normalizeParentIdentifier(existing[0].parent_id) : null;
    const hasParentData = [input.guardianName, input.guardianContact, input.guardianEmail, input.address, (input as any).guardianFirstName, (input as any).guardianLastName]
      .some((v) => typeof v === "string" && v.trim().length > 0);

    if (hasParentData) {
      const parentCols: string[] = [];
      const parentVals: Array<string | number | null> = [];
      const parentName = (input.guardianName ?? "").trim();
      const firstName = (input as any).guardianFirstName ?? parentName.split(" ")[0] ?? null;
      const lastName = (input as any).guardianLastName ?? (parentName.split(" ").length > 1 ? parentName.split(" ").slice(-1).join(" ") : null);
      const middleName = (input as any).guardianMiddleName ?? null;
      const suffix = (input as any).guardianSuffix ?? null;

      const pushVal = (col: string, value: any) => { parentCols.push(col); parentVals.push(value); };
      if (parentColumns.has("first_name")) pushVal("first_name", firstName ?? null);
      if (parentColumns.has("middle_name")) pushVal("middle_name", middleName ?? null);
      if (parentColumns.has("last_name")) pushVal("last_name", lastName ?? null);
      if (parentColumns.has("suffix")) pushVal("suffix", suffix ?? null);
      if (parentColumns.has("phone_number")) pushVal("phone_number", input.guardianContact ?? null);
      if (parentColumns.has("email")) pushVal("email", (input as any).guardianEmail ?? null);
      if (parentColumns.has("address")) pushVal("address", input.address ?? null);

        if (parentCols.length) {
          if (parentId) {
            const setClause = parentCols.map((c) => `${c} = ?`).join(", ");
            await query(`UPDATE parent SET ${setClause} WHERE parent_id = ? LIMIT 1`, [...parentVals, parentId]);
          } else {
            const parentIdentifier = parentColumns.has("parent_id")
              ? await runWithConnection((conn) => generateParentId(conn, new Date()))
              : null;
            if (parentColumns.has("parent_id") && parentIdentifier) { parentCols.push("parent_id"); parentVals.push(parentIdentifier); }
            if (parentColumns.has("created_at")) { parentCols.push("created_at"); parentVals.push(new Date() as any); }
            if (parentColumns.has("updated_at")) { parentCols.push("updated_at"); parentVals.push(new Date() as any); }
            const insertSql = `INSERT INTO parent (${parentCols.map((c) => `\`${c}\``).join(", ")}) VALUES (${parentCols.map(() => "?").join(", ")})`;
            const [result] = await query<ResultSetHeader>(insertSql, parentVals);
            const newParentId = normalizeParentIdentifier(parentIdentifier ?? (result as any)?.insertId);
            if (newParentId) {
              await query(`UPDATE \`${STUDENT_TABLE}\` SET parent_id = ? WHERE student_id = ? LIMIT 1`, [newParentId, id]);
            }
          }
        }
    }
  } else if (parentStudentColumns.size && parentStudentColumns.has("student_id")) {
    const hasParentData = [
      input.guardianName,
      input.guardianContact,
      input.guardianEmail,
      input.address,
      (input as any).guardianFirstName,
      (input as any).guardianLastName,
      input.relationship,
    ].some((v) => typeof v === "string" && v.trim().length > 0);

    if (hasParentData && parentStudentColumns.has("parent_id")) {
      const [linkRows] = await query<RowDataPacket[]>(
        "SELECT parent_id FROM parent_student WHERE student_id = ? LIMIT 1",
        [id],
      );
      const linkedParentId = linkRows.length > 0 ? normalizeParentIdentifier(linkRows[0].parent_id) : null;

      if (linkedParentId) {
        const relationCols: string[] = [];
        const relationVals: Array<string | number | null> = [];
        if (parentStudentColumns.has("relationship") && Object.prototype.hasOwnProperty.call(input, "relationship")) {
          relationCols.push("relationship = ?");
          relationVals.push(input.relationship ?? null);
        }
        if (parentStudentColumns.has("address") && Object.prototype.hasOwnProperty.call(input, "address")) {
          relationCols.push("address = ?");
          relationVals.push(input.address ?? null);
        }
        if (relationCols.length) {
          await query(
            `UPDATE parent_student SET ${relationCols.join(", ")} WHERE parent_id = ? AND student_id = ? LIMIT 1`,
            [...relationVals, linkedParentId, id],
          );
        }

        if (parentColumns.has("user_id") && userColumns.size) {
          const [[parentRow]] = await query<RowDataPacket[]>(
            "SELECT user_id FROM parent WHERE parent_id = ? LIMIT 1",
            [linkedParentId],
          );
          const parentUserId = Number(parentRow?.user_id);
          if (Number.isFinite(parentUserId)) {
            const parentName = (input.guardianName ?? "").trim();
            const firstName = (input as any).guardianFirstName ?? parentName.split(" ")[0] ?? null;
            const lastName = (input as any).guardianLastName ?? (parentName.split(" ").length > 1 ? parentName.split(" ").slice(-1).join(" ") : null);
            const middleName = (input as any).guardianMiddleName ?? null;

            const userCols: string[] = [];
            const userVals: Array<string | number | null> = [];
            const pushUser = (col: string, value: any) => { userCols.push(`${col} = ?`); userVals.push(value); };
            if (userColumns.has("first_name") && Object.prototype.hasOwnProperty.call(input, "guardianFirstName")) {
              pushUser("first_name", firstName ?? null);
            }
            if (userColumns.has("middle_name") && Object.prototype.hasOwnProperty.call(input, "guardianMiddleName")) {
              pushUser("middle_name", middleName ?? null);
            }
            if (userColumns.has("last_name") && Object.prototype.hasOwnProperty.call(input, "guardianLastName")) {
              pushUser("last_name", lastName ?? null);
            }
            if (userColumns.has("phone_number") && Object.prototype.hasOwnProperty.call(input, "guardianContact")) {
              pushUser("phone_number", input.guardianContact ?? null);
            }
            if (userColumns.has("email") && Object.prototype.hasOwnProperty.call(input, "guardianEmail")) {
              pushUser("email", input.guardianEmail ?? null);
            }

            if (userCols.length) {
              await query(`UPDATE users SET ${userCols.join(", ")} WHERE user_id = ? LIMIT 1`, [
                ...userVals,
                parentUserId,
              ]);
            }
          }
        }
      }
    }
  }

  if (assessmentColumns.has("student_id") && assessmentColumns.has("subject_id") && assessmentColumns.has("phonemic_id")) {
    const phonemicInserts: Array<[number, number]> = [];
    const englishId = resolvePhonemicLevelId(input.englishPhonemic, englishSubjectId, phonemicLookup);
    if (englishId && englishSubjectId) phonemicInserts.push([englishSubjectId, englishId]);
    const filipinoId = resolvePhonemicLevelId(input.filipinoPhonemic, filipinoSubjectId, phonemicLookup);
    if (filipinoId && filipinoSubjectId) phonemicInserts.push([filipinoSubjectId, filipinoId]);
    const mathId = resolvePhonemicLevelId(input.mathProficiency, mathSubjectId, phonemicLookup);
    if (mathId && mathSubjectId) phonemicInserts.push([mathSubjectId, mathId]);

    for (const [subId, phonId] of phonemicInserts) {
      await query(
        `INSERT INTO student_subject_assessment (student_id, subject_id, phonemic_id, assessed_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE phonemic_id = VALUES(phonemic_id), assessed_at = VALUES(assessed_at)`,
        [id, subId, phonId, new Date()],
      );
    }
  }

  if (assessmentColumns.has("student_id") && assessmentColumns.has("subject_id")) {
    let subjectId = subjectSubjectId(subject, subjectColumns);
    if (!subjectId && subjectColumns.size) {
      subjectId = await resolveSubjectIdByName(subject, subjectColumns);
    }
    if (subjectId) {
      const subjectPhonemic = subject === "English"
        ? input.englishPhonemic
        : subject === "Filipino"
          ? input.filipinoPhonemic
          : subject === "Math"
            ? input.mathProficiency
            : null;

      const resolvedPhonemicId = resolvePhonemicLevelId(subjectPhonemic, subjectId, phonemicLookup);
      if (resolvedPhonemicId) {
        await query(
          `INSERT INTO student_subject_assessment (student_id, subject_id, phonemic_id, assessed_at)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE phonemic_id = VALUES(phonemic_id), assessed_at = VALUES(assessed_at)`,
          [id, subjectId, resolvedPhonemicId, new Date()]
        );
      }
    }
  }

  return fetchStudentById(id);
}

export async function normalizeCoordinatorSubject(value: unknown, fallback: StudentSubject): Promise<StudentSubject> {
  return resolveStudentSubject(value, fallback);
}
