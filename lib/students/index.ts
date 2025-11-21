import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, runWithConnection } from "@/lib/db";
import {
  type StudentRecordDto,
  type StudentSubject,
  type CreateStudentRecordInput,
  type UpdateStudentRecordInput,
  resolveStudentSubject,
} from "./shared";
import { normalizeMaterialSubject } from "@/lib/materials/shared";

export type StudentRecordRow = RowDataPacket & {
  student_record_id: number;
  student_identifier: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  full_name: string | null;
  grade_level: string | null;
  section: string | null;
  age: string | null;
  subject: string;
  guardian_name: string | null;
  guardian_contact: string | null;
  address: string | null;
  relationship: string | null;
  english_phonemic: string | null;
  filipino_phonemic: string | null;
  math_proficiency: string | null;
  created_by: number;
  updated_by: number | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const STUDENT_TABLE = "student_records";

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

export async function ensureStudentSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS \`${STUDENT_TABLE}\` (
      student_record_id INT AUTO_INCREMENT PRIMARY KEY,
      student_identifier VARCHAR(100) NULL,
      first_name VARCHAR(100) NULL,
      middle_name VARCHAR(100) NULL,
      last_name VARCHAR(100) NULL,
      full_name VARCHAR(255) NOT NULL,
      grade_level VARCHAR(50) NULL,
      section VARCHAR(50) NULL,
  age VARCHAR(20) NULL,
      subject VARCHAR(50) NOT NULL,
      guardian_name VARCHAR(255) NULL,
      guardian_contact VARCHAR(100) NULL,
  relationship VARCHAR(100) NULL,
      address TEXT NULL,
      english_phonemic VARCHAR(100) NULL,
      filipino_phonemic VARCHAR(100) NULL,
      math_proficiency VARCHAR(100) NULL,
      created_by INT NOT NULL,
      updated_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_student_subject (student_identifier, subject),
      INDEX idx_subject (subject),
      INDEX idx_grade (grade_level),
      INDEX idx_section (section),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const columns = await getTableColumns(STUDENT_TABLE);
  if (!columns.has("english_phonemic")) {
    await query(
      `ALTER TABLE \`${STUDENT_TABLE}\` ADD COLUMN english_phonemic VARCHAR(100) NULL AFTER address`
    );
  }
  if (!columns.has("age")) {
    await query(
      `ALTER TABLE \`${STUDENT_TABLE}\` ADD COLUMN age VARCHAR(20) NULL AFTER section`
    );
  }
  if (!columns.has("relationship")) {
    await query(
      `ALTER TABLE \`${STUDENT_TABLE}\` ADD COLUMN relationship VARCHAR(100) NULL AFTER guardian_contact`
    );
  }
  if (!columns.has("filipino_phonemic")) {
    await query(
      `ALTER TABLE \`${STUDENT_TABLE}\` ADD COLUMN filipino_phonemic VARCHAR(100) NULL AFTER english_phonemic`
    );
  }
  if (!columns.has("math_proficiency")) {
    await query(
      `ALTER TABLE \`${STUDENT_TABLE}\` ADD COLUMN math_proficiency VARCHAR(100) NULL AFTER filipino_phonemic`
    );
  }
}

export function studentRowToDto(row: StudentRecordRow): StudentRecordDto {
  const subject = normalizeMaterialSubject(row.subject) ?? "English";
  return {
    id: Number(row.student_record_id),
    studentIdentifier: row.student_identifier ?? null,
    firstName: row.first_name ?? null,
    middleName: row.middle_name ?? null,
    lastName: row.last_name ?? null,
    fullName: (row.full_name ?? "Unnamed Student").trim(),
    gradeLevel: row.grade_level ?? null,
    section: row.section ?? null,
  age: row.age ?? null,
    subject,
    guardianName: row.guardian_name ?? null,
    guardianContact: row.guardian_contact ?? null,
  relationship: row.relationship ?? null,
    address: row.address ?? null,
    englishPhonemic: row.english_phonemic ?? null,
    filipinoPhonemic: row.filipino_phonemic ?? null,
    mathProficiency: row.math_proficiency ?? null,
    createdBy: Number(row.created_by),
    updatedBy: row.updated_by !== null && row.updated_by !== undefined ? Number(row.updated_by) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  } satisfies StudentRecordDto;
}

type StudentIdSequence = {
  prefix: string;
  next: number;
};

const studentIdSequenceCache = new WeakMap<any, StudentIdSequence>();

async function generateStudentId(connection: any): Promise<string> {
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  const expectedPrefix = `ST-${yearSuffix}`;

  let sequence = studentIdSequenceCache.get(connection);

  if (!sequence || sequence.prefix !== expectedPrefix) {
    const [rows] = (await connection.query(
      `SELECT student_identifier FROM \`${STUDENT_TABLE}\` WHERE student_identifier LIKE ? ORDER BY student_identifier DESC LIMIT 1`,
      [`${expectedPrefix}%`],
    )) as [RowDataPacket[]];

    let nextNum = 1;
    if (rows.length > 0) {
      const lastId = rows[0].student_identifier;
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



export async function insertStudents(
  userId: number,
  subject: StudentSubject,
  students: CreateStudentRecordInput[],
): Promise<number> {
  if (students.length === 0) {
    return 0;
  }

  await ensureStudentSchema();

  return runWithConnection(async (connection) => {
    await connection.beginTransaction();
    try {
      const insertSql = `
        INSERT INTO \`${STUDENT_TABLE}\`
          (student_identifier, first_name, middle_name, last_name, full_name, grade_level, section, age, subject,
           guardian_name, guardian_contact, relationship, address, english_phonemic, filipino_phonemic, math_proficiency, created_by, updated_by)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          first_name = VALUES(first_name),
          middle_name = VALUES(middle_name),
          last_name = VALUES(last_name),
          full_name = VALUES(full_name),
          grade_level = VALUES(grade_level),
          section = VALUES(section),
          age = VALUES(age),
          guardian_name = VALUES(guardian_name),
          guardian_contact = VALUES(guardian_contact),
          relationship = VALUES(relationship),
          address = VALUES(address),
          english_phonemic = VALUES(english_phonemic),
          filipino_phonemic = VALUES(filipino_phonemic),
          math_proficiency = VALUES(math_proficiency),
          updated_by = VALUES(updated_by)
      `;

      const values: Array<[
        string,
        string | null,
        string | null,
        string | null,
        string,
        string | null,
        string | null,
        string | null,
        StudentSubject,
        string | null,
        string | null,
        string | null,
        string | null,
        string | null,
        string | null,
        string | null,
        number,
        number,
      ]> = [];

      for (const student of students) {
        const fullName = buildFullName(student);
        const trimmedIdentifier = typeof student.studentIdentifier === "string" ? student.studentIdentifier.trim() : "";
        const studentId = trimmedIdentifier.length > 0 ? trimmedIdentifier : await generateStudentId(connection);

        values.push([
          studentId,
          student.firstName ?? null,
          student.middleName ?? null,
          student.lastName ?? null,
          fullName,
          student.gradeLevel ?? null,
          student.section ?? null,
          student.age ?? null,
          subject,
          student.guardianName ?? null,
          student.guardianContact ?? null,
          student.relationship ?? null,
          student.address ?? null,
          student.englishPhonemic ?? null,
          student.filipinoPhonemic ?? null,
          student.mathProficiency ?? null,
          userId,
          userId,
        ]);
      }

      await connection.query(insertSql, [values]);
      await connection.commit();
      return values.length;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}

export async function deleteStudents(userId: number, subject: StudentSubject, ids: number[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  await ensureStudentSchema();

  const placeholders = ids.map(() => "?").join(",");
  const sql = `
    DELETE FROM \`${STUDENT_TABLE}\`
    WHERE student_record_id IN (${placeholders})
      AND subject = ?
  `;

  const params = [...ids, subject];
  const [result] = await query(sql, params);
  const affected = "affectedRows" in result ? Number(result.affectedRows) : 0;
  return affected;
}

export type StudentQueryOptions = {
  subject: StudentSubject;
  search?: string | null;
  gradeLevel?: string | null;
  section?: string | null;
  page?: number;
  pageSize?: number;
};

export async function fetchStudents({
  subject,
  search,
  gradeLevel,
  section,
  page = 1,
  pageSize = 50,
}: StudentQueryOptions): Promise<{ data: StudentRecordDto[]; total: number; page: number; pageSize: number }> {
  await ensureStudentSchema();

  const filters: string[] = ["subject = ?"];
  const params: Array<string | number> = [subject];

  if (gradeLevel && gradeLevel.trim()) {
    filters.push("grade_level = ?");
    params.push(gradeLevel.trim());
  }

  if (section && section.trim()) {
    filters.push("section = ?");
    params.push(section.trim());
  }

  if (search && search.trim()) {
    filters.push("(full_name LIKE ? OR student_identifier LIKE ? OR guardian_name LIKE ?)");
    const wildcard = `%${search.trim()}%`;
    params.push(wildcard, wildcard, wildcard);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const offset = (Math.max(page, 1) - 1) * Math.max(pageSize, 1);

  const [rows] = await query<StudentRecordRow[]>(
    `SELECT SQL_CALC_FOUND_ROWS * FROM \`${STUDENT_TABLE}\` ${whereClause} ORDER BY full_name ASC LIMIT ? OFFSET ?`,
    [...params, Math.max(pageSize, 1), offset],
  );

  const [countRows] = await query<RowDataPacket[]>("SELECT FOUND_ROWS() AS total");
  const total = countRows.length > 0 ? Number(countRows[0].total) : rows.length;

  return {
    data: rows.map(studentRowToDto),
    total,
    page: Math.max(page, 1),
    pageSize: Math.max(pageSize, 1),
  };
}

export async function fetchStudentById(id: number): Promise<StudentRecordDto | null> {
  await ensureStudentSchema();
  const [rows] = await query<StudentRecordRow[]>(
    `SELECT * FROM \`${STUDENT_TABLE}\` WHERE student_record_id = ? LIMIT 1`,
    [id],
  );
  if (rows.length === 0) {
    return null;
  }
  return studentRowToDto(rows[0]);
}

export async function updateStudent(
  id: number,
  userId: number,
  subject: StudentSubject,
  input: UpdateStudentRecordInput,
): Promise<StudentRecordDto | null> {
  await ensureStudentSchema();

  const fields: string[] = [];
  const params: Array<string | number | null> = [];

  const fullName = buildFullName(input);
  fields.push("full_name = ?");
  params.push(fullName);

  const assign = <T extends keyof UpdateStudentRecordInput>(key: T, column: string) => {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      const rawValue = input[key];
      const normalizedValue = typeof rawValue === "string" ? rawValue.trim() : rawValue;
      fields.push(`${column} = ?`);
      const finalValue =
        normalizedValue === undefined || normalizedValue === null || normalizedValue === ""
          ? null
          : typeof normalizedValue === "number"
            ? normalizedValue
            : String(normalizedValue);
      params.push(finalValue);
    }
  };

  assign("studentIdentifier", "student_identifier");
  assign("firstName", "first_name");
  assign("middleName", "middle_name");
  assign("lastName", "last_name");
  assign("gradeLevel", "grade_level");
  assign("section", "section");
  assign("age", "age");
  assign("guardianName", "guardian_name");
  assign("guardianContact", "guardian_contact");
  assign("relationship", "relationship");
  assign("address", "address");
  assign("englishPhonemic", "english_phonemic");
  assign("filipinoPhonemic", "filipino_phonemic");
  assign("mathProficiency", "math_proficiency");

  fields.push("updated_by = ?");
  params.push(userId);

  if (fields.length === 0) {
    return fetchStudentById(id);
  }

  params.push(id, subject);
  const sql = `
    UPDATE \`${STUDENT_TABLE}\`
    SET ${fields.join(", ")}
    WHERE student_record_id = ?
      AND subject = ?
    LIMIT 1
  `;

  await query(sql, params);
  return fetchStudentById(id);
}

export async function normalizeCoordinatorSubject(value: unknown, fallback: StudentSubject): Promise<StudentSubject> {
  return resolveStudentSubject(value, fallback);
}
