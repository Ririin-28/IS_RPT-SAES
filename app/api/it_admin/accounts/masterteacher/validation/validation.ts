import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COORDINATOR_SUBJECT_OPTIONS = ["English", "Filipino", "Math"] as const;
const MASTER_TEACHER_ROLE_NAMES = ["master teacher", "master_teacher", "masterteacher"];
const SUBJECT_NAME_TO_ID: Record<string, number> = {
  English: 1,
  Filipino: 2,
  Math: 3,
};

export function sanitizeNamePart(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    throw new HttpError(400, `${field} must be at least 2 characters.`);
  }
  return trimmed;
}

export function sanitizeOptionalNamePart(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function sanitizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Email is required.");
  }
  const normalized = value.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    throw new HttpError(400, "Invalid email format.");
  }
  return normalized;
}

export function sanitizePhoneNumber(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Phone number is required.");
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) {
    throw new HttpError(400, "Phone number must contain 10 to 11 digits.");
  }
  return digits;
}

export function sanitizeGrade(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const numeric = Math.trunc(value);
    if (numeric <= 0) {
      throw new HttpError(400, "Grade must be a positive number.");
    }
    return String(numeric);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new HttpError(400, "Grade is required.");
    }
    const match = trimmed.match(/\d+/);
    if (match) {
      return match[0];
    }
    return trimmed;
  }

  throw new HttpError(400, "Grade is required.");
}

export function sanitizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function sanitizeCoordinatorSubject(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Coordinator subject is required.");
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new HttpError(400, "Coordinator subject is required.");
  }
  const match = COORDINATOR_SUBJECT_OPTIONS.find(
    (option) => option.toLowerCase() === normalized.toLowerCase(),
  );
  if (!match) {
    throw new HttpError(400, `Coordinator subject must be one of: ${COORDINATOR_SUBJECT_OPTIONS.join(", ")}.`);
  }
  return match;
}

function buildFullName(
  firstName: string,
  middleName: string | null,
  lastName: string,
  suffix: string | null,
): string {
  const parts = [firstName, middleName, lastName]
    .filter((part) => part && part.trim().length > 0)
    .map((part) => (part ? part.trim() : part));
  if (suffix && suffix.trim().length > 0) {
    parts.push(suffix.trim());
  }
  return parts.join(" ");
}

async function getColumnsForTable(connection: PoolConnection, tableName: string): Promise<Set<string>> {
  const [rows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => String(row.Field)));
}

function generateTemporaryPassword(): string {
  const random = Math.random().toString(36).slice(-8);
  return random.padEnd(8, "0");
}

const MASTER_TEACHER_ID_PATTERN = /^MT-(\d{2})(\d{4,})$/;

export function formatMasterTeacherIdentifier(
  raw: string | null | undefined,
  fallbackSequence?: number | null,
  yearOverride?: number | null,
): string {
  const normalized = typeof raw === "string" ? raw.trim() : "";
  if (normalized && MASTER_TEACHER_ID_PATTERN.test(normalized)) {
    return normalized;
  }

  const yearSource = typeof yearOverride === "number" && Number.isFinite(yearOverride)
    ? yearOverride
    : new Date().getFullYear();
  const year = String(yearSource).slice(-2);

  const sequenceValue = typeof fallbackSequence === "number" && Number.isFinite(fallbackSequence)
    ? Math.max(1, Math.trunc(fallbackSequence))
    : 1;

  return `MT-${year}${String(sequenceValue).padStart(4, "0")}`;
}

async function generateMasterTeacherId(
  connection: PoolConnection,
  sources: Array<{ table: string; column: string }>,
  yearOverride?: number | null,
): Promise<string> {
  const yearSource = typeof yearOverride === "number" && Number.isFinite(yearOverride)
    ? yearOverride
    : new Date().getFullYear();
  const year = String(yearSource).slice(-2);

  let maxSequence = 0;

  for (const source of sources) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT \`${source.column}\` AS master_teacher_id FROM \`${source.table}\` WHERE \`${source.column}\` LIKE ? ORDER BY \`${source.column}\` DESC LIMIT 1`,
      [`MT-${year}%`],
    );

    if (rows.length === 0) {
      continue;
    }

    const lastId = rows[0]?.master_teacher_id;
    const match = typeof lastId === "string" ? lastId.match(/MT-\d{2}(\d{4,})$/) : null;
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed)) {
        maxSequence = Math.max(maxSequence, parsed);
      }
    }
  }

  const nextNum = maxSequence + 1;
  return `MT-${year}${String(nextNum).padStart(4, "0")}`;
}

export interface CreateMasterTeacherInput {
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phoneNumber: string;
  suffix: string | null;
  grade: string;
  section?: string | null;
  subjects?: string | null;
  coordinatorSubject: string;
  teacherId?: string | null;
}

export interface CreateMasterTeacherResult {
  userId: number;
  record: {
    userId: number;
    masterTeacherId: string;
    teacherId: string | null;
    firstName: string;
    middleName: string | null;
    lastName: string;
    name: string;
    email: string;
    contactNumber: string;
    grade: string;
    section: string | null;
    subjects: string | null;
    coordinatorSubject: string;
    status: string;
    lastLogin: null;
    suffix: string | null;
  };
  temporaryPassword: string;
}

export interface BulkCreateMasterTeacherItem extends CreateMasterTeacherInput {
  index: number;
}

export interface BulkCreateMasterTeacherResult {
  inserted: Array<{
    index: number;
    userId: number;
    record: CreateMasterTeacherResult["record"];
    temporaryPassword: string;
  }>;
  failures: Array<{
    index: number;
    email: string | null;
    error: string;
  }>;
}

const MASTER_TEACHER_TABLE_CANDIDATES = [
  "master_teacher",
  "master_teachers",
  "masterteacher",
  "master_teacher_info",
  "master_teacher_tbl",
] as const;

const REMEDIAL_TEACHER_TABLE_CANDIDATES = [
  "remedial_teacher",
  "remedial_teachers",
  "remedialteacher",
  "remedial_teacher_info",
  "remedial_teacher_tbl",
] as const;

const MT_COORDINATOR_TABLE_CANDIDATES = [
  "mt_coordinator",
  "mt_coordinators",
  "mtcoordinator",
  "mt_coordinator_info",
  "mt_coordinator_tbl",
] as const;

const BULK_INSERT_CHUNK_SIZE = 100;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildPlaceholders(count: number): string {
  return new Array(count).fill("?").join(", ");
}

function parseMasterTeacherIdSequence(masterTeacherId: string): number | null {
  const match = masterTeacherId.match(MASTER_TEACHER_ID_PATTERN);
  if (!match) {
    return null;
  }
  const seq = Number.parseInt(match[2], 10);
  return Number.isFinite(seq) ? seq : null;
}

async function resolveMasterTeacherTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of MASTER_TEACHER_TABLE_CANDIDATES) {
    try {
      const columns = await getColumnsForTable(connection, candidate);
      if (columns.size > 0) {
        return { table: candidate, columns };
      }
    } catch {
      // continue to next candidate
    }
  }
  return { table: null, columns: new Set<string>() };
}

async function resolveRemedialTeacherTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of REMEDIAL_TEACHER_TABLE_CANDIDATES) {
    try {
      const columns = await getColumnsForTable(connection, candidate);
      if (columns.size > 0) {
        return { table: candidate, columns };
      }
    } catch {
      // continue to next candidate
    }
  }
  return { table: null, columns: new Set<string>() };
}

async function resolveMtCoordinatorTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of MT_COORDINATOR_TABLE_CANDIDATES) {
    try {
      const columns = await getColumnsForTable(connection, candidate);
      if (columns.size > 0) {
        return { table: candidate, columns };
      }
    } catch {
      // continue to next candidate
    }
  }
  return { table: null, columns: new Set<string>() };
}

async function getColumnsSafe(connection: PoolConnection, table: string): Promise<Set<string>> {
  try {
    return await getColumnsForTable(connection, table);
  } catch {
    return new Set<string>();
  }
}

async function resolveGradeId(connection: PoolConnection, gradeValue: string): Promise<number | null> {
  if (!gradeValue) {
    return null;
  }

  const trimmed = gradeValue.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let numeric = Number.parseInt(trimmed, 10);

  if (!Number.isInteger(numeric)) {
    const match = trimmed.match(/(\d+)/);
    if (match && match[1]) {
      numeric = Number.parseInt(match[1], 10);
    }
  }

  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 6) {
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT grade_id FROM grade WHERE grade_level = ? LIMIT 1",
        [numeric],
      );
      if (rows.length > 0 && rows[0].grade_id != null) {
        return Number(rows[0].grade_id);
      }
    } catch {
      // fall through if lookup fails so callers can still use numeric fallback
    }
    return numeric; // fallback mapping 1..6 even without grade table metadata
  }

  return null;
}

function subjectNameToIds(subjectsRaw: string | null | undefined): number[] {
  if (!subjectsRaw) return [];
  return subjectsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => SUBJECT_NAME_TO_ID[name as keyof typeof SUBJECT_NAME_TO_ID])
    .filter((id): id is number => typeof id === "number");
}

/*
function subjectNameToIds(subjectsRaw: string | null | undefined): number[] {
  if (!subjectsRaw) return [];
  return subjectsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => SUBJECT_NAME_TO_ID[name as keyof typeof SUBJECT_NAME_TO_ID])
    .filter((id): id is number => typeof id === "number");
}
*/

async function resolveRoleId(connection: PoolConnection, roleNames: string[], fallbackId?: number): Promise<number | null> {
  if (!roleNames.length) {
    return fallbackId ?? null;
  }
  try {
    const placeholders = roleNames.map(() => "?").join(", ");
    const lowered = roleNames.map((name) => name.toLowerCase());
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT role_id FROM role WHERE LOWER(role_name) IN (${placeholders}) ORDER BY role_id ASC LIMIT 1`,
      lowered,
    );
    if (rows.length > 0 && rows[0].role_id != null) {
      return Number(rows[0].role_id);
    }
  } catch {
    // ignore lookup errors
  }
  return fallbackId ?? null;
}

export async function createMasterTeacher(input: CreateMasterTeacherInput): Promise<CreateMasterTeacherResult> {
  const {
    firstName,
    middleName,
    lastName,
    suffix,
    email,
    phoneNumber,
    grade,
    section,
    subjects,
    coordinatorSubject,
    teacherId,
  } = input;
  const fullName = buildFullName(firstName, middleName, lastName, suffix);
  const temporaryPassword = generateTemporaryPassword();
  const requestTime = new Date();
  const currentYear = requestTime.getFullYear();

  const result = await runWithConnection(async (connection) => {
  const userColumns = await getColumnsForTable(connection, "users");
  const masterTeacherInfo = await resolveMasterTeacherTable(connection);
  const remedialTeacherInfo = await resolveRemedialTeacherTable(connection);
  const mtCoordinatorInfo = await resolveMtCoordinatorTable(connection);
  const coordHandledColumns = await getColumnsSafe(connection, "mt_coordinator_handled");
  const remedialHandledColumns = await getColumnsSafe(connection, "mt_remedialteacher_handled");
  const masterTeacherRoleId = userColumns.has("role_id")
    ? await resolveRoleId(connection, MASTER_TEACHER_ROLE_NAMES, 3)
    : null;

  const masterTeacherIdSources: Array<{ table: string; column: string }> = [];
  if (userColumns.has("master_teacher_id")) {
    masterTeacherIdSources.push({ table: "users", column: "master_teacher_id" });
  }
  if (masterTeacherInfo.table) {
    if (masterTeacherInfo.columns.has("master_teacher_id")) {
      masterTeacherIdSources.push({ table: masterTeacherInfo.table, column: "master_teacher_id" });
    }
    if (masterTeacherInfo.columns.has("masterteacher_id")) {
      masterTeacherIdSources.push({ table: masterTeacherInfo.table, column: "masterteacher_id" });
    }
  }
  if (remedialTeacherInfo.table && remedialTeacherInfo.columns.has("master_teacher_id")) {
    masterTeacherIdSources.push({ table: remedialTeacherInfo.table, column: "master_teacher_id" });
  }
  if (mtCoordinatorInfo.table && mtCoordinatorInfo.columns.has("master_teacher_id")) {
    masterTeacherIdSources.push({ table: mtCoordinatorInfo.table, column: "master_teacher_id" });
  }
  try {
    const archivedColumns = await getColumnsForTable(connection, "archived_users");
    if (archivedColumns.has("master_teacher_id")) {
      masterTeacherIdSources.push({ table: "archived_users", column: "master_teacher_id" });
    } else if (archivedColumns.has("user_code")) {
      masterTeacherIdSources.push({ table: "archived_users", column: "user_code" });
    }
  } catch {
    // ignore archived_users absence
  }

    await connection.beginTransaction();
    try {
      const [duplicateEmail] = await connection.query<RowDataPacket[]>(
        "SELECT user_id FROM users WHERE email = ? LIMIT 1",
        [email],
      );
      if (duplicateEmail.length > 0) {
        throw new HttpError(409, "Email already exists.");
      }

      const userInsertColumns: string[] = [];
      const userInsertValues: any[] = [];

      if (userColumns.has("first_name")) {
        userInsertColumns.push("first_name");
        userInsertValues.push(firstName);
      }
      if (userColumns.has("middle_name")) {
        userInsertColumns.push("middle_name");
        userInsertValues.push(middleName);
      }
      if (userColumns.has("last_name")) {
        userInsertColumns.push("last_name");
        userInsertValues.push(lastName);
      }
      if (userColumns.has("suffix")) {
        userInsertColumns.push("suffix");
        userInsertValues.push(suffix);
      }
      if (userColumns.has("name")) {
        userInsertColumns.push("name");
        userInsertValues.push(fullName);
      }
      if (userColumns.has("email")) {
        userInsertColumns.push("email");
        userInsertValues.push(email);
      }
      if (userColumns.has("username")) {
        userInsertColumns.push("username");
        userInsertValues.push(email);
      }
      if (userColumns.has("contact_number")) {
        userInsertColumns.push("contact_number");
        userInsertValues.push(phoneNumber);
      }
      if (userColumns.has("phone_number")) {
        userInsertColumns.push("phone_number");
        userInsertValues.push(phoneNumber);
      }
      if (userColumns.has("role")) {
        userInsertColumns.push("role");
        userInsertValues.push("master_teacher");
      }
      if (userColumns.has("role_id") && masterTeacherRoleId !== null) {
        userInsertColumns.push("role_id");
        userInsertValues.push(masterTeacherRoleId);
      }
      if (userColumns.has("status")) {
        userInsertColumns.push("status");
        userInsertValues.push("Active");
      }
      if (userColumns.has("password")) {
        userInsertColumns.push("password");
        userInsertValues.push(temporaryPassword);
      }
      const now = requestTime;
      if (userColumns.has("created_at")) {
        userInsertColumns.push("created_at");
        userInsertValues.push(now);
      }
      if (userColumns.has("updated_at")) {
        userInsertColumns.push("updated_at");
        userInsertValues.push(now);
      }

      if (userInsertColumns.length === 0) {
        throw new HttpError(500, "Unable to determine columns for users table.");
      }

      const userColumnsSql = userInsertColumns.map((column) => `\`${column}\``).join(", ");
      const placeholders = userInsertColumns.map(() => "?").join(", ");

      const [userResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO users (${userColumnsSql}) VALUES (${placeholders})`,
        userInsertValues,
      );

      const userId = userResult.insertId;
      if (!userId) {
        throw new HttpError(500, "Failed to create user record.");
      }

      let generatedMasterTeacherId: string | null = null;
      if (masterTeacherIdSources.length > 0) {
        generatedMasterTeacherId = await generateMasterTeacherId(connection, masterTeacherIdSources, currentYear);
      }

      const masterTeacherId = formatMasterTeacherIdentifier(generatedMasterTeacherId, userId, currentYear);
      const teacherIdentifier = teacherId ?? masterTeacherId;

          if (userColumns.has("master_teacher_id") || userColumns.has("user_code")) {
            const updateSets: string[] = [];
            const updateValues: any[] = [];
            if (userColumns.has("master_teacher_id")) {
              updateSets.push("master_teacher_id = ?");
              updateValues.push(masterTeacherId);
            }
            if (userColumns.has("user_code")) {
              updateSets.push("user_code = ?");
              updateValues.push(masterTeacherId);
            }
            if (updateSets.length) {
              updateValues.push(userId);
              await connection.query<ResultSetHeader>(
                `UPDATE \`users\` SET ${updateSets.join(", ")} WHERE \`user_id\` = ? LIMIT 1`,
                updateValues,
              );
            }
          }

      const insertIntoFlexibleTable = async (
        tableInfo: { table: string | null; columns: Set<string> },
        configure: (columns: string[], values: any[]) => void,
      ) => {
        if (!tableInfo.table || tableInfo.columns.size === 0) {
          return;
        }
        const insertColumns: string[] = [];
        const insertValues: any[] = [];
        configure(insertColumns, insertValues);
        if (insertColumns.length === 0) {
          return;
        }
        const columnsSql = insertColumns.map((column) => `\`${column}\``).join(", ");
        const placeholdersSql = insertColumns.map(() => "?").join(", ");
        await connection.query<ResultSetHeader>(
          `INSERT INTO \`${tableInfo.table}\` (${columnsSql}) VALUES (${placeholdersSql})`,
          insertValues,
        );
      };

      await insertIntoFlexibleTable(masterTeacherInfo, (insertColumns, insertValues) => {
        const identifierPairs: Array<[string, any]> = [];
        if (masterTeacherInfo.columns.has("user_id")) {
          identifierPairs.push(["user_id", userId]);
        }
        if (masterTeacherInfo.columns.has("master_teacher_id")) {
          identifierPairs.push(["master_teacher_id", masterTeacherId]);
        }
        if (masterTeacherInfo.columns.has("masterteacher_id")) {
          identifierPairs.push(["masterteacher_id", masterTeacherId]);
        }
        for (const column of ["teacher_id", "employee_id"]) {
          if (masterTeacherInfo.columns.has(column)) {
            identifierPairs.push([column, teacherIdentifier]);
          }
        }

        if (identifierPairs.length === 0) {
          return;
        }

        for (const [column, value] of identifierPairs) {
          insertColumns.push(column);
          insertValues.push(value);
        }

        if (masterTeacherInfo.columns.has("first_name")) {
          insertColumns.push("first_name");
          insertValues.push(firstName);
        }
        if (masterTeacherInfo.columns.has("middle_name")) {
          insertColumns.push("middle_name");
          insertValues.push(middleName);
        }
        if (masterTeacherInfo.columns.has("last_name")) {
          insertColumns.push("last_name");
          insertValues.push(lastName);
        }
        if (masterTeacherInfo.columns.has("suffix")) {
          insertColumns.push("suffix");
          insertValues.push(suffix);
        }
        if (masterTeacherInfo.columns.has("name")) {
          insertColumns.push("name");
          insertValues.push(fullName);
        }
        if (masterTeacherInfo.columns.has("email")) {
          insertColumns.push("email");
          insertValues.push(email);
        }
        if (masterTeacherInfo.columns.has("contact_number")) {
          insertColumns.push("contact_number");
          insertValues.push(phoneNumber);
        }
        if (masterTeacherInfo.columns.has("phone_number")) {
          insertColumns.push("phone_number");
          insertValues.push(phoneNumber);
        }
        if (masterTeacherInfo.columns.has("remedial_teacher_grade")) {
          insertColumns.push("remedial_teacher_grade");
          insertValues.push(grade);
        }
        if (masterTeacherInfo.columns.has("grade")) {
          insertColumns.push("grade");
          insertValues.push(grade);
        }
        if (masterTeacherInfo.columns.has("handled_grade")) {
          insertColumns.push("handled_grade");
          insertValues.push(grade);
        }
        if (masterTeacherInfo.columns.has("grade_level")) {
          insertColumns.push("grade_level");
          insertValues.push(grade);
        }
        if (section) {
          for (const column of ["section", "section_name", "class_section"]) {
            if (masterTeacherInfo.columns.has(column)) {
              insertColumns.push(column);
              insertValues.push(section);
            }
          }
        }
        if (subjects) {
          for (const column of ["subjects", "handled_subjects", "subject"]) {
            if (masterTeacherInfo.columns.has(column)) {
              insertColumns.push(column);
              insertValues.push(subjects);
            }
          }
        }
        if (masterTeacherInfo.columns.has("subject_handled")) {
          insertColumns.push("subject_handled");
          insertValues.push(coordinatorSubject);
        }
        for (const column of ["mt_coordinator", "coordinator_subject", "coordinator", "coordinatorSubject"]) {
          if (masterTeacherInfo.columns.has(column)) {
            insertColumns.push(column);
            insertValues.push(coordinatorSubject);
          }
        }
        if (masterTeacherInfo.columns.has("status")) {
          insertColumns.push("status");
          insertValues.push("Active");
        }
        if (masterTeacherInfo.columns.has("role")) {
          insertColumns.push("role");
          insertValues.push("master_teacher");
        }
        if (masterTeacherInfo.columns.has("created_at")) {
          insertColumns.push("created_at");
          insertValues.push(now);
        }
        if (masterTeacherInfo.columns.has("updated_at")) {
          insertColumns.push("updated_at");
          insertValues.push(now);
        }
      });

      await insertIntoFlexibleTable(remedialTeacherInfo, (insertColumns, insertValues) => {
        if (remedialTeacherInfo.columns.has("user_id")) {
          insertColumns.push("user_id");
          insertValues.push(userId);
        } else if (remedialTeacherInfo.columns.has("master_teacher_id")) {
          insertColumns.push("master_teacher_id");
          insertValues.push(masterTeacherId);
        } else if (remedialTeacherInfo.columns.has("teacher_id")) {
          insertColumns.push("teacher_id");
          insertValues.push(teacherIdentifier);
        }

        if (!insertColumns.length) {
          return;
        }

        if (remedialTeacherInfo.columns.has("first_name")) {
          insertColumns.push("first_name");
          insertValues.push(firstName);
        }
        if (remedialTeacherInfo.columns.has("middle_name")) {
          insertColumns.push("middle_name");
          insertValues.push(middleName);
        }
        if (remedialTeacherInfo.columns.has("last_name")) {
          insertColumns.push("last_name");
          insertValues.push(lastName);
        }
        if (remedialTeacherInfo.columns.has("suffix")) {
          insertColumns.push("suffix");
          insertValues.push(suffix);
        }
        if (remedialTeacherInfo.columns.has("name")) {
          insertColumns.push("name");
          insertValues.push(fullName);
        }
        if (remedialTeacherInfo.columns.has("email")) {
          insertColumns.push("email");
          insertValues.push(email);
        }
        if (remedialTeacherInfo.columns.has("contact_number")) {
          insertColumns.push("contact_number");
          insertValues.push(phoneNumber);
        }
        if (remedialTeacherInfo.columns.has("phone_number")) {
          insertColumns.push("phone_number");
          insertValues.push(phoneNumber);
        }
        for (const column of [
          "grade",
          "handled_grade",
          "grade_level",
          "gradeLevel",
          "remedial_grade",
          "remedial_teacher_grade",
        ]) {
          if (remedialTeacherInfo.columns.has(column)) {
            insertColumns.push(column);
            insertValues.push(grade);
          }
        }
        if (subjects) {
          for (const column of ["subjects", "handled_subjects", "subject"]) {
            if (remedialTeacherInfo.columns.has(column)) {
              insertColumns.push(column);
              insertValues.push(subjects);
            }
          }
        }
        if (remedialTeacherInfo.columns.has("status")) {
          insertColumns.push("status");
          insertValues.push("Active");
        }
        if (remedialTeacherInfo.columns.has("created_at")) {
          insertColumns.push("created_at");
          insertValues.push(now);
        }
        if (remedialTeacherInfo.columns.has("updated_at")) {
          insertColumns.push("updated_at");
          insertValues.push(now);
        }
      });

      await insertIntoFlexibleTable(mtCoordinatorInfo, (insertColumns, insertValues) => {
        if (!mtCoordinatorInfo.columns.has("subject_handled") &&
          !mtCoordinatorInfo.columns.has("subjects_handled") &&
          !mtCoordinatorInfo.columns.has("handled_subject") &&
          !mtCoordinatorInfo.columns.has("coordinator_subject")) {
          return;
        }

        if (mtCoordinatorInfo.columns.has("user_id")) {
          insertColumns.push("user_id");
          insertValues.push(userId);
        } else if (mtCoordinatorInfo.columns.has("master_teacher_id")) {
          insertColumns.push("master_teacher_id");
          insertValues.push(masterTeacherId);
        } else if (mtCoordinatorInfo.columns.has("teacher_id")) {
          insertColumns.push("teacher_id");
          insertValues.push(teacherIdentifier);
        }

        if (!insertColumns.length) {
          return;
        }

        if (mtCoordinatorInfo.columns.has("first_name")) {
          insertColumns.push("first_name");
          insertValues.push(firstName);
        }
        if (mtCoordinatorInfo.columns.has("middle_name")) {
          insertColumns.push("middle_name");
          insertValues.push(middleName);
        }
        if (mtCoordinatorInfo.columns.has("last_name")) {
          insertColumns.push("last_name");
          insertValues.push(lastName);
        }
        if (mtCoordinatorInfo.columns.has("suffix")) {
          insertColumns.push("suffix");
          insertValues.push(suffix);
        }
        if (mtCoordinatorInfo.columns.has("name")) {
          insertColumns.push("name");
          insertValues.push(fullName);
        }
        if (mtCoordinatorInfo.columns.has("email")) {
          insertColumns.push("email");
          insertValues.push(email);
        }
        if (mtCoordinatorInfo.columns.has("contact_number")) {
          insertColumns.push("contact_number");
          insertValues.push(phoneNumber);
        }
        if (mtCoordinatorInfo.columns.has("phone_number")) {
          insertColumns.push("phone_number");
          insertValues.push(phoneNumber);
        }

        for (const column of ["subject_handled", "subjects_handled", "handled_subject", "coordinator_subject"]) {
          if (mtCoordinatorInfo.columns.has(column)) {
            insertColumns.push(column);
            insertValues.push(coordinatorSubject);
          }
        }

        if (mtCoordinatorInfo.columns.has("status")) {
          insertColumns.push("status");
          insertValues.push("Active");
        }
        if (mtCoordinatorInfo.columns.has("created_at")) {
          insertColumns.push("created_at");
          insertValues.push(now);
        }
        if (mtCoordinatorInfo.columns.has("updated_at")) {
          insertColumns.push("updated_at");
          insertValues.push(now);
        }
      });

      // Write handled grade/subject to bridge tables when available
      const gradeId = await resolveGradeId(connection, grade);
      const coordinatorSubjectId = SUBJECT_NAME_TO_ID[coordinatorSubject as keyof typeof SUBJECT_NAME_TO_ID];

      if (
        coordHandledColumns.size > 0 &&
        coordHandledColumns.has("master_teacher_id") &&
        coordHandledColumns.has("grade_id") &&
        coordHandledColumns.has("subject_id") &&
        gradeId !== null &&
        coordinatorSubjectId
      ) {
        try {
          await connection.query<ResultSetHeader>(
            "INSERT IGNORE INTO `mt_coordinator_handled` (master_teacher_id, grade_id, subject_id) VALUES (?, ?, ?)",
            [masterTeacherId, gradeId, coordinatorSubjectId],
          );
        } catch {
          // ignore insert issues to avoid failing primary flow
        }
      }

      if (
        remedialHandledColumns.size > 0 &&
        remedialHandledColumns.has("master_teacher_id") &&
        remedialHandledColumns.has("grade_id") &&
        gradeId !== null
      ) {
        try {
          await connection.query<ResultSetHeader>(
            "INSERT IGNORE INTO `mt_remedialteacher_handled` (master_teacher_id, grade_id) VALUES (?, ?)",
            [masterTeacherId, gradeId],
          );
        } catch {
          // ignore insert failure
        }
      }

      await connection.commit();

      const record = {
        userId,
        masterTeacherId,
        teacherId: teacherIdentifier,
        firstName,
        middleName,
        lastName,
        name: fullName,
        email,
        contactNumber: phoneNumber,
        grade,
        section: section ?? null,
        subjects: subjects ?? null,
        coordinatorSubject,
        status: "Active",
        lastLogin: null,
        suffix,
      };

      return { userId, record };
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });

  return {
    userId: result.userId,
    record: result.record,
    temporaryPassword,
  };
}

export async function createMasterTeachersBulk(
  items: BulkCreateMasterTeacherItem[],
): Promise<BulkCreateMasterTeacherResult> {
  if (items.length === 0) {
    return { inserted: [], failures: [] };
  }

  return runWithConnection(async (connection) => {
    const failures: BulkCreateMasterTeacherResult["failures"] = [];
    const inserted: BulkCreateMasterTeacherResult["inserted"] = [];

    const userColumns = await getColumnsForTable(connection, "users");
    const masterTeacherInfo = await resolveMasterTeacherTable(connection);
    const remedialTeacherInfo = await resolveRemedialTeacherTable(connection);
    const mtCoordinatorInfo = await resolveMtCoordinatorTable(connection);
    const coordHandledColumns = await getColumnsSafe(connection, "mt_coordinator_handled");
    const remedialHandledColumns = await getColumnsSafe(connection, "mt_remedialteacher_handled");
    const masterTeacherRoleId = userColumns.has("role_id")
      ? await resolveRoleId(connection, MASTER_TEACHER_ROLE_NAMES, 3)
      : null;

    const masterTeacherIdSources: Array<{ table: string; column: string }> = [];
    if (userColumns.has("master_teacher_id")) {
      masterTeacherIdSources.push({ table: "users", column: "master_teacher_id" });
    }
    if (masterTeacherInfo.table) {
      if (masterTeacherInfo.columns.has("master_teacher_id")) {
        masterTeacherIdSources.push({ table: masterTeacherInfo.table, column: "master_teacher_id" });
      }
      if (masterTeacherInfo.columns.has("masterteacher_id")) {
        masterTeacherIdSources.push({ table: masterTeacherInfo.table, column: "masterteacher_id" });
      }
    }
    if (remedialTeacherInfo.table && remedialTeacherInfo.columns.has("master_teacher_id")) {
      masterTeacherIdSources.push({ table: remedialTeacherInfo.table, column: "master_teacher_id" });
    }
    if (mtCoordinatorInfo.table && mtCoordinatorInfo.columns.has("master_teacher_id")) {
      masterTeacherIdSources.push({ table: mtCoordinatorInfo.table, column: "master_teacher_id" });
    }
    try {
      const archivedColumns = await getColumnsForTable(connection, "archived_users");
      if (archivedColumns.has("master_teacher_id")) {
        masterTeacherIdSources.push({ table: "archived_users", column: "master_teacher_id" });
      } else if (archivedColumns.has("user_code")) {
        masterTeacherIdSources.push({ table: "archived_users", column: "user_code" });
      }
    } catch {
      // ignore archived_users absence
    }

    const requestTime = new Date();
    const currentYear = requestTime.getFullYear();
    const yearSuffix = String(currentYear).slice(-2);
    const useGeneratedMasterTeacherId = masterTeacherIdSources.length > 0;
    let nextSequence = 1;
    if (useGeneratedMasterTeacherId) {
      const generatedId = await generateMasterTeacherId(connection, masterTeacherIdSources, currentYear);
      nextSequence = parseMasterTeacherIdSequence(generatedId) ?? 1;
    }

    const prepared = items.map((item) => {
      const fullName = buildFullName(item.firstName, item.middleName, item.lastName, item.suffix ?? null);
      const temporaryPassword = generateTemporaryPassword();
      const masterTeacherIdValue = useGeneratedMasterTeacherId
        ? `MT-${yearSuffix}${String(nextSequence++).padStart(4, "0")}`
        : null;

      return {
        ...item,
        fullName,
        temporaryPassword,
        masterTeacherIdValue,
      };
    });

    const emailList = prepared.map((entry) => entry.email);
    const existingEmails = new Set<string>();
    for (const chunk of chunkArray(emailList, BULK_INSERT_CHUNK_SIZE)) {
      const placeholders = buildPlaceholders(chunk.length);
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT email FROM users WHERE email IN (${placeholders})`,
        chunk,
      );
      for (const row of rows) {
        if (typeof row.email === "string") {
          existingEmails.add(row.email.toLowerCase());
        }
      }
    }

    const pending = prepared.filter((entry) => {
      if (existingEmails.has(entry.email.toLowerCase())) {
        failures.push({ index: entry.index, email: entry.email, error: "Email already exists." });
        return false;
      }
      return true;
    });

    const userInsertColumns: string[] = [];
    if (userColumns.has("first_name")) userInsertColumns.push("first_name");
    if (userColumns.has("middle_name")) userInsertColumns.push("middle_name");
    if (userColumns.has("last_name")) userInsertColumns.push("last_name");
    if (userColumns.has("suffix")) userInsertColumns.push("suffix");
    if (userColumns.has("name")) userInsertColumns.push("name");
    if (userColumns.has("email")) userInsertColumns.push("email");
    if (userColumns.has("username")) userInsertColumns.push("username");
    if (userColumns.has("contact_number")) userInsertColumns.push("contact_number");
    if (userColumns.has("phone_number")) userInsertColumns.push("phone_number");
    if (userColumns.has("role")) userInsertColumns.push("role");
    if (userColumns.has("role_id") && masterTeacherRoleId !== null) userInsertColumns.push("role_id");
    if (userColumns.has("status")) userInsertColumns.push("status");
    if (userColumns.has("password")) userInsertColumns.push("password");
    if (userColumns.has("created_at")) userInsertColumns.push("created_at");
    if (userColumns.has("updated_at")) userInsertColumns.push("updated_at");

    if (userInsertColumns.length === 0) {
      throw new HttpError(500, "Unable to determine columns for users table.");
    }

    const userColumnsSql = userInsertColumns.map((column) => `\`${column}\``).join(", ");
    const userRowPlaceholder = `(${buildPlaceholders(userInsertColumns.length)})`;

    const buildUserRowValues = (entry: typeof pending[number]): any[] => {
      const values: any[] = [];
      for (const column of userInsertColumns) {
        if (column === "first_name") values.push(entry.firstName);
        else if (column === "middle_name") values.push(entry.middleName);
        else if (column === "last_name") values.push(entry.lastName);
        else if (column === "suffix") values.push(entry.suffix ?? null);
        else if (column === "name") values.push(entry.fullName);
        else if (column === "email") values.push(entry.email);
        else if (column === "username") values.push(entry.email);
        else if (column === "contact_number") values.push(entry.phoneNumber);
        else if (column === "phone_number") values.push(entry.phoneNumber);
        else if (column === "role") values.push("master_teacher");
        else if (column === "role_id") values.push(masterTeacherRoleId);
        else if (column === "status") values.push("Active");
        else if (column === "password") values.push(entry.temporaryPassword);
        else if (column === "created_at") values.push(requestTime);
        else if (column === "updated_at") values.push(requestTime);
        else values.push(null);
      }
      return values;
    };

    const masterTeacherInsertColumns: string[] = [];
    if (masterTeacherInfo.table) {
      if (masterTeacherInfo.columns.has("user_id")) masterTeacherInsertColumns.push("user_id");
      if (masterTeacherInfo.columns.has("master_teacher_id")) masterTeacherInsertColumns.push("master_teacher_id");
      if (masterTeacherInfo.columns.has("masterteacher_id")) masterTeacherInsertColumns.push("masterteacher_id");
      for (const column of ["teacher_id", "employee_id"]) {
        if (masterTeacherInfo.columns.has(column)) masterTeacherInsertColumns.push(column);
      }
      if (masterTeacherInfo.columns.has("first_name")) masterTeacherInsertColumns.push("first_name");
      if (masterTeacherInfo.columns.has("middle_name")) masterTeacherInsertColumns.push("middle_name");
      if (masterTeacherInfo.columns.has("last_name")) masterTeacherInsertColumns.push("last_name");
      if (masterTeacherInfo.columns.has("suffix")) masterTeacherInsertColumns.push("suffix");
      if (masterTeacherInfo.columns.has("name")) masterTeacherInsertColumns.push("name");
      if (masterTeacherInfo.columns.has("email")) masterTeacherInsertColumns.push("email");
      if (masterTeacherInfo.columns.has("contact_number")) masterTeacherInsertColumns.push("contact_number");
      if (masterTeacherInfo.columns.has("phone_number")) masterTeacherInsertColumns.push("phone_number");
      if (masterTeacherInfo.columns.has("remedial_teacher_grade")) masterTeacherInsertColumns.push("remedial_teacher_grade");
      if (masterTeacherInfo.columns.has("grade")) masterTeacherInsertColumns.push("grade");
      if (masterTeacherInfo.columns.has("handled_grade")) masterTeacherInsertColumns.push("handled_grade");
      if (masterTeacherInfo.columns.has("grade_level")) masterTeacherInsertColumns.push("grade_level");
      for (const column of ["section", "section_name", "class_section"]) {
        if (masterTeacherInfo.columns.has(column)) masterTeacherInsertColumns.push(column);
      }
      for (const column of ["subjects", "handled_subjects", "subject"]) {
        if (masterTeacherInfo.columns.has(column)) masterTeacherInsertColumns.push(column);
      }
      if (masterTeacherInfo.columns.has("subject_handled")) masterTeacherInsertColumns.push("subject_handled");
      for (const column of ["mt_coordinator", "coordinator_subject", "coordinator", "coordinatorSubject"]) {
        if (masterTeacherInfo.columns.has(column)) masterTeacherInsertColumns.push(column);
      }
      if (masterTeacherInfo.columns.has("status")) masterTeacherInsertColumns.push("status");
      if (masterTeacherInfo.columns.has("role")) masterTeacherInsertColumns.push("role");
      if (masterTeacherInfo.columns.has("created_at")) masterTeacherInsertColumns.push("created_at");
      if (masterTeacherInfo.columns.has("updated_at")) masterTeacherInsertColumns.push("updated_at");
    }

    const remedialInsertColumns: string[] = [];
    if (remedialTeacherInfo.table && remedialTeacherInfo.table !== masterTeacherInfo.table) {
      if (remedialTeacherInfo.columns.has("user_id")) remedialInsertColumns.push("user_id");
      if (remedialTeacherInfo.columns.has("master_teacher_id")) remedialInsertColumns.push("master_teacher_id");
      if (remedialTeacherInfo.columns.has("teacher_id")) remedialInsertColumns.push("teacher_id");
      if (remedialTeacherInfo.columns.has("first_name")) remedialInsertColumns.push("first_name");
      if (remedialTeacherInfo.columns.has("middle_name")) remedialInsertColumns.push("middle_name");
      if (remedialTeacherInfo.columns.has("last_name")) remedialInsertColumns.push("last_name");
      if (remedialTeacherInfo.columns.has("suffix")) remedialInsertColumns.push("suffix");
      if (remedialTeacherInfo.columns.has("name")) remedialInsertColumns.push("name");
      if (remedialTeacherInfo.columns.has("email")) remedialInsertColumns.push("email");
      if (remedialTeacherInfo.columns.has("contact_number")) remedialInsertColumns.push("contact_number");
      if (remedialTeacherInfo.columns.has("phone_number")) remedialInsertColumns.push("phone_number");
      for (const column of [
        "grade",
        "handled_grade",
        "grade_level",
        "gradeLevel",
        "remedial_grade",
        "remedial_teacher_grade",
      ]) {
        if (remedialTeacherInfo.columns.has(column)) remedialInsertColumns.push(column);
      }
      for (const column of ["subjects", "handled_subjects", "subject"]) {
        if (remedialTeacherInfo.columns.has(column)) remedialInsertColumns.push(column);
      }
      if (remedialTeacherInfo.columns.has("status")) remedialInsertColumns.push("status");
      if (remedialTeacherInfo.columns.has("created_at")) remedialInsertColumns.push("created_at");
      if (remedialTeacherInfo.columns.has("updated_at")) remedialInsertColumns.push("updated_at");
    }

    const mtCoordinatorInsertColumns: string[] = [];
    const mtCoordinatorHasSubjectColumns = mtCoordinatorInfo.table
      ? ["subject_handled", "subjects_handled", "handled_subject", "coordinator_subject"].some((column) =>
          mtCoordinatorInfo.columns.has(column),
        )
      : false;
    if (mtCoordinatorInfo.table && mtCoordinatorHasSubjectColumns) {
      if (mtCoordinatorInfo.columns.has("user_id")) mtCoordinatorInsertColumns.push("user_id");
      if (mtCoordinatorInfo.columns.has("master_teacher_id")) mtCoordinatorInsertColumns.push("master_teacher_id");
      if (mtCoordinatorInfo.columns.has("teacher_id")) mtCoordinatorInsertColumns.push("teacher_id");
      if (mtCoordinatorInfo.columns.has("first_name")) mtCoordinatorInsertColumns.push("first_name");
      if (mtCoordinatorInfo.columns.has("middle_name")) mtCoordinatorInsertColumns.push("middle_name");
      if (mtCoordinatorInfo.columns.has("last_name")) mtCoordinatorInsertColumns.push("last_name");
      if (mtCoordinatorInfo.columns.has("suffix")) mtCoordinatorInsertColumns.push("suffix");
      if (mtCoordinatorInfo.columns.has("name")) mtCoordinatorInsertColumns.push("name");
      if (mtCoordinatorInfo.columns.has("email")) mtCoordinatorInsertColumns.push("email");
      if (mtCoordinatorInfo.columns.has("contact_number")) mtCoordinatorInsertColumns.push("contact_number");
      if (mtCoordinatorInfo.columns.has("phone_number")) mtCoordinatorInsertColumns.push("phone_number");
      for (const column of ["subject_handled", "subjects_handled", "handled_subject", "coordinator_subject"]) {
        if (mtCoordinatorInfo.columns.has(column)) mtCoordinatorInsertColumns.push(column);
      }
      if (mtCoordinatorInfo.columns.has("status")) mtCoordinatorInsertColumns.push("status");
      if (mtCoordinatorInfo.columns.has("created_at")) mtCoordinatorInsertColumns.push("created_at");
      if (mtCoordinatorInfo.columns.has("updated_at")) mtCoordinatorInsertColumns.push("updated_at");
    }

    const gradeIdCache = new Map<string, number | null>();
    for (const entry of pending) {
      if (!gradeIdCache.has(entry.grade)) {
        gradeIdCache.set(entry.grade, await resolveGradeId(connection, entry.grade));
      }
    }

    for (const chunk of chunkArray(pending, BULK_INSERT_CHUNK_SIZE)) {
      await connection.beginTransaction();
      try {
        const userValues: any[] = [];
        const userPlaceholders: string[] = [];
        for (const entry of chunk) {
          userValues.push(...buildUserRowValues(entry));
          userPlaceholders.push(userRowPlaceholder);
        }

        await connection.query<ResultSetHeader>(
          `INSERT INTO users (${userColumnsSql}) VALUES ${userPlaceholders.join(", ")}`,
          userValues,
        );

        const userIdByEmail = new Map<string, number>();
        const chunkEmails = chunk.map((entry) => entry.email);
        for (const emailChunk of chunkArray(chunkEmails, BULK_INSERT_CHUNK_SIZE)) {
          const placeholders = buildPlaceholders(emailChunk.length);
          const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT user_id, email FROM users WHERE email IN (${placeholders})`,
            emailChunk,
          );
          for (const row of rows) {
            if (typeof row.email === "string") {
              const id = Number(row.user_id);
              if (Number.isInteger(id)) {
                userIdByEmail.set(row.email.toLowerCase(), id);
              }
            }
          }
        }

        const masterTeacherIdByEmail = new Map<string, string>();
        const teacherIdentifierByEmail = new Map<string, string>();
        for (const entry of chunk) {
          const userId = userIdByEmail.get(entry.email.toLowerCase());
          if (!userId) {
            continue;
          }
          const masterTeacherIdValue = entry.masterTeacherIdValue
            ?? formatMasterTeacherIdentifier(null, userId, currentYear);
          const teacherIdentifier = entry.teacherId ?? masterTeacherIdValue;
          masterTeacherIdByEmail.set(entry.email.toLowerCase(), masterTeacherIdValue);
          teacherIdentifierByEmail.set(entry.email.toLowerCase(), teacherIdentifier);
        }

        if (userColumns.has("master_teacher_id") || userColumns.has("user_code")) {
          const updateSets: string[] = [];
          const updateValues: any[] = [];
          if (userColumns.has("master_teacher_id")) {
            const cases: string[] = [];
            for (const entry of chunk) {
              const userId = userIdByEmail.get(entry.email.toLowerCase());
              const masterTeacherIdValue = masterTeacherIdByEmail.get(entry.email.toLowerCase());
              if (!userId || !masterTeacherIdValue) {
                continue;
              }
              cases.push("WHEN ? THEN ?");
              updateValues.push(userId, masterTeacherIdValue);
            }
            if (cases.length > 0) {
              updateSets.push(`master_teacher_id = CASE user_id ${cases.join(" ")} END`);
            }
          }
          if (userColumns.has("user_code")) {
            const cases: string[] = [];
            for (const entry of chunk) {
              const userId = userIdByEmail.get(entry.email.toLowerCase());
              const masterTeacherIdValue = masterTeacherIdByEmail.get(entry.email.toLowerCase());
              if (!userId || !masterTeacherIdValue) {
                continue;
              }
              cases.push("WHEN ? THEN ?");
              updateValues.push(userId, masterTeacherIdValue);
            }
            if (cases.length > 0) {
              updateSets.push(`user_code = CASE user_id ${cases.join(" ")} END`);
            }
          }

          if (updateSets.length > 0) {
            const ids = chunk
              .map((entry) => userIdByEmail.get(entry.email.toLowerCase()))
              .filter((id): id is number => Number.isInteger(id));
            if (ids.length > 0) {
              const placeholders = buildPlaceholders(ids.length);
              await connection.query<ResultSetHeader>(
                `UPDATE \`users\` SET ${updateSets.join(", ")} WHERE user_id IN (${placeholders})`,
                [...updateValues, ...ids],
              );
            }
          }
        }

        if (masterTeacherInfo.table && masterTeacherInsertColumns.length > 0) {
          const columnSql = masterTeacherInsertColumns.map((column) => `\`${column}\``).join(", ");
          const rowPlaceholder = `(${buildPlaceholders(masterTeacherInsertColumns.length)})`;
          const rowValues: any[] = [];
          const rowPlaceholders: string[] = [];
          for (const entry of chunk) {
            const userId = userIdByEmail.get(entry.email.toLowerCase());
            const masterTeacherIdValue = masterTeacherIdByEmail.get(entry.email.toLowerCase());
            const teacherIdentifier = teacherIdentifierByEmail.get(entry.email.toLowerCase());
            if (!userId || !masterTeacherIdValue || !teacherIdentifier) {
              continue;
            }
            for (const column of masterTeacherInsertColumns) {
              if (column === "user_id") rowValues.push(userId);
              else if (column === "master_teacher_id" || column === "masterteacher_id") rowValues.push(masterTeacherIdValue);
              else if (column === "teacher_id" || column === "employee_id") rowValues.push(teacherIdentifier);
              else if (column === "first_name") rowValues.push(entry.firstName);
              else if (column === "middle_name") rowValues.push(entry.middleName);
              else if (column === "last_name") rowValues.push(entry.lastName);
              else if (column === "suffix") rowValues.push(entry.suffix ?? null);
              else if (column === "name") rowValues.push(entry.fullName);
              else if (column === "email") rowValues.push(entry.email);
              else if (column === "contact_number") rowValues.push(entry.phoneNumber);
              else if (column === "phone_number") rowValues.push(entry.phoneNumber);
              else if (column === "remedial_teacher_grade") rowValues.push(entry.grade);
              else if (column === "grade") rowValues.push(entry.grade);
              else if (column === "handled_grade") rowValues.push(entry.grade);
              else if (column === "grade_level") rowValues.push(entry.grade);
              else if (["section", "section_name", "class_section"].includes(column)) rowValues.push(entry.section ?? null);
              else if (["subjects", "handled_subjects", "subject"].includes(column)) rowValues.push(entry.subjects ?? null);
              else if (column === "subject_handled") rowValues.push(entry.coordinatorSubject);
              else if (["mt_coordinator", "coordinator_subject", "coordinator", "coordinatorSubject"].includes(column)) {
                rowValues.push(entry.coordinatorSubject);
              } else if (column === "status") rowValues.push("Active");
              else if (column === "role") rowValues.push("master_teacher");
              else if (column === "created_at") rowValues.push(requestTime);
              else if (column === "updated_at") rowValues.push(requestTime);
              else rowValues.push(null);
            }
            rowPlaceholders.push(rowPlaceholder);
          }

          if (rowPlaceholders.length > 0) {
            await connection.query<ResultSetHeader>(
              `INSERT INTO \`${masterTeacherInfo.table}\` (${columnSql}) VALUES ${rowPlaceholders.join(", ")}`,
              rowValues,
            );
          }
        }

        if (remedialTeacherInfo.table && remedialInsertColumns.length > 0) {
          const columnSql = remedialInsertColumns.map((column) => `\`${column}\``).join(", ");
          const rowPlaceholder = `(${buildPlaceholders(remedialInsertColumns.length)})`;
          const rowValues: any[] = [];
          const rowPlaceholders: string[] = [];
          for (const entry of chunk) {
            const userId = userIdByEmail.get(entry.email.toLowerCase());
            const masterTeacherIdValue = masterTeacherIdByEmail.get(entry.email.toLowerCase());
            const teacherIdentifier = teacherIdentifierByEmail.get(entry.email.toLowerCase());
            if (!userId || !masterTeacherIdValue || !teacherIdentifier) {
              continue;
            }
            for (const column of remedialInsertColumns) {
              if (column === "user_id") rowValues.push(userId);
              else if (column === "master_teacher_id") rowValues.push(masterTeacherIdValue);
              else if (column === "teacher_id") rowValues.push(teacherIdentifier);
              else if (column === "first_name") rowValues.push(entry.firstName);
              else if (column === "middle_name") rowValues.push(entry.middleName);
              else if (column === "last_name") rowValues.push(entry.lastName);
              else if (column === "suffix") rowValues.push(entry.suffix ?? null);
              else if (column === "name") rowValues.push(entry.fullName);
              else if (column === "email") rowValues.push(entry.email);
              else if (column === "contact_number") rowValues.push(entry.phoneNumber);
              else if (column === "phone_number") rowValues.push(entry.phoneNumber);
              else if ([
                "grade",
                "handled_grade",
                "grade_level",
                "gradeLevel",
                "remedial_grade",
                "remedial_teacher_grade",
              ].includes(column)) rowValues.push(entry.grade);
              else if (["subjects", "handled_subjects", "subject"].includes(column)) rowValues.push(entry.subjects ?? null);
              else if (column === "status") rowValues.push("Active");
              else if (column === "created_at") rowValues.push(requestTime);
              else if (column === "updated_at") rowValues.push(requestTime);
              else rowValues.push(null);
            }
            rowPlaceholders.push(rowPlaceholder);
          }

          if (rowPlaceholders.length > 0) {
            await connection.query<ResultSetHeader>(
              `INSERT INTO \`${remedialTeacherInfo.table}\` (${columnSql}) VALUES ${rowPlaceholders.join(", ")}`,
              rowValues,
            );
          }
        }

        if (mtCoordinatorInfo.table && mtCoordinatorInsertColumns.length > 0) {
          const columnSql = mtCoordinatorInsertColumns.map((column) => `\`${column}\``).join(", ");
          const rowPlaceholder = `(${buildPlaceholders(mtCoordinatorInsertColumns.length)})`;
          const rowValues: any[] = [];
          const rowPlaceholders: string[] = [];
          for (const entry of chunk) {
            const userId = userIdByEmail.get(entry.email.toLowerCase());
            const masterTeacherIdValue = masterTeacherIdByEmail.get(entry.email.toLowerCase());
            const teacherIdentifier = teacherIdentifierByEmail.get(entry.email.toLowerCase());
            if (!userId || !masterTeacherIdValue || !teacherIdentifier) {
              continue;
            }
            for (const column of mtCoordinatorInsertColumns) {
              if (column === "user_id") rowValues.push(userId);
              else if (column === "master_teacher_id") rowValues.push(masterTeacherIdValue);
              else if (column === "teacher_id") rowValues.push(teacherIdentifier);
              else if (column === "first_name") rowValues.push(entry.firstName);
              else if (column === "middle_name") rowValues.push(entry.middleName);
              else if (column === "last_name") rowValues.push(entry.lastName);
              else if (column === "suffix") rowValues.push(entry.suffix ?? null);
              else if (column === "name") rowValues.push(entry.fullName);
              else if (column === "email") rowValues.push(entry.email);
              else if (column === "contact_number") rowValues.push(entry.phoneNumber);
              else if (column === "phone_number") rowValues.push(entry.phoneNumber);
              else if (["subject_handled", "subjects_handled", "handled_subject", "coordinator_subject"].includes(column)) {
                rowValues.push(entry.coordinatorSubject);
              } else if (column === "status") rowValues.push("Active");
              else if (column === "created_at") rowValues.push(requestTime);
              else if (column === "updated_at") rowValues.push(requestTime);
              else rowValues.push(null);
            }
            rowPlaceholders.push(rowPlaceholder);
          }

          if (rowPlaceholders.length > 0) {
            await connection.query<ResultSetHeader>(
              `INSERT INTO \`${mtCoordinatorInfo.table}\` (${columnSql}) VALUES ${rowPlaceholders.join(", ")}`,
              rowValues,
            );
          }
        }

        if (
          coordHandledColumns.size > 0 &&
          coordHandledColumns.has("master_teacher_id") &&
          coordHandledColumns.has("grade_id") &&
          coordHandledColumns.has("subject_id")
        ) {
          const values: any[] = [];
          const placeholders: string[] = [];
          for (const entry of chunk) {
            const masterTeacherIdValue = masterTeacherIdByEmail.get(entry.email.toLowerCase());
            const gradeId = gradeIdCache.get(entry.grade) ?? null;
            const coordinatorSubjectId = SUBJECT_NAME_TO_ID[entry.coordinatorSubject as keyof typeof SUBJECT_NAME_TO_ID];
            if (!masterTeacherIdValue || gradeId === null || !coordinatorSubjectId) {
              continue;
            }
            values.push(masterTeacherIdValue, gradeId, coordinatorSubjectId);
            placeholders.push("(?, ?, ?)");
          }
          if (placeholders.length > 0) {
            await connection.query<ResultSetHeader>(
              `INSERT IGNORE INTO \`mt_coordinator_handled\` (master_teacher_id, grade_id, subject_id) VALUES ${placeholders.join(", ")}`,
              values,
            );
          }
        }

        if (
          remedialHandledColumns.size > 0 &&
          remedialHandledColumns.has("master_teacher_id") &&
          remedialHandledColumns.has("grade_id")
        ) {
          const values: any[] = [];
          const placeholders: string[] = [];
          for (const entry of chunk) {
            const masterTeacherIdValue = masterTeacherIdByEmail.get(entry.email.toLowerCase());
            const gradeId = gradeIdCache.get(entry.grade) ?? null;
            if (!masterTeacherIdValue || gradeId === null) {
              continue;
            }
            values.push(masterTeacherIdValue, gradeId);
            placeholders.push("(?, ?)");
          }
          if (placeholders.length > 0) {
            await connection.query<ResultSetHeader>(
              `INSERT IGNORE INTO \`mt_remedialteacher_handled\` (master_teacher_id, grade_id) VALUES ${placeholders.join(", ")}`,
              values,
            );
          }
        }

        await connection.commit();

        for (const entry of chunk) {
          const userId = userIdByEmail.get(entry.email.toLowerCase());
          const masterTeacherIdValue = masterTeacherIdByEmail.get(entry.email.toLowerCase());
          const teacherIdentifier = teacherIdentifierByEmail.get(entry.email.toLowerCase()) ?? null;
          if (!userId || !masterTeacherIdValue) {
            failures.push({ index: entry.index, email: entry.email, error: "Failed to resolve user ID." });
            continue;
          }
          inserted.push({
            index: entry.index,
            userId,
            temporaryPassword: entry.temporaryPassword,
            record: {
              userId,
              masterTeacherId: masterTeacherIdValue,
              teacherId: teacherIdentifier,
              firstName: entry.firstName,
              middleName: entry.middleName,
              lastName: entry.lastName,
              name: entry.fullName,
              email: entry.email,
              contactNumber: entry.phoneNumber,
              grade: entry.grade,
              section: entry.section ?? null,
              subjects: entry.subjects ?? null,
              coordinatorSubject: entry.coordinatorSubject,
              status: "Active",
              lastLogin: null,
              suffix: entry.suffix ?? null,
            },
          });
        }
      } catch (error) {
        await connection.rollback();
        for (const entry of chunk) {
          try {
            const singleResult = await createMasterTeacher(entry);
            inserted.push({
              index: entry.index,
              userId: singleResult.userId,
              record: singleResult.record,
              temporaryPassword: singleResult.temporaryPassword,
            });
          } catch (singleError) {
            const errorMessage = singleError instanceof HttpError
              ? singleError.message
              : "Unexpected error while importing.";
            failures.push({ index: entry.index, email: entry.email, error: errorMessage });
          }
        }
      }
    }

    return { inserted, failures };
  });
}