import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const STUDENT_TABLE_CANDIDATES = ["student", "students", "student_info"] as const;
const STUDENT_ID_COLUMNS = ["student_id", "id", "studentid"] as const;
const SECTION_COLUMNS = ["section", "section_name", "class_section", "handled_section"] as const;
const SUBJECT_COLUMNS = ["subjects", "handled_subjects", "subject", "subject_list"] as const;
const CONTACT_COLUMNS = [
  "contact_number",
  "contact_no",
  "contact",
  "phone",
  "mobile",
  "phone_number",
] as const;
const EMAIL_COLUMNS = ["email", "user_email"] as const;
const NAME_COLUMNS = ["first_name", "middle_name", "last_name"] as const;

function extractGradeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  const match = text.match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatGradeLabel(value: unknown): string | null {
  const number = extractGradeNumber(value);
  if (number) {
    return `Grade ${number}`;
  }
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function pickFirstColumn(columns: Set<string>, candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveName(row: Record<string, any>): {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  fullName: string | null;
} {
  const candidates = [
    ["student_first_name", "student_middle_name", "student_last_name"],
    ["user_first_name", "user_middle_name", "user_last_name"],
    ["first_name", "middle_name", "last_name"],
  ];

  for (const [firstKey, middleKey, lastKey] of candidates) {
    const first = row[firstKey];
    const middle = row[middleKey];
    const last = row[lastKey];

    if (first || middle || last) {
      const firstName = first ? String(first).trim() : null;
      const middleName = middle ? String(middle).trim() : null;
      const lastName = last ? String(last).trim() : null;
      const parts = [firstName, middleName, lastName].filter(Boolean);
      return {
        firstName,
        middleName,
        lastName,
        fullName: parts.length ? parts.join(" ") : null,
      };
    }
  }

  return { firstName: null, middleName: null, lastName: null, fullName: null };
}

async function resolveStudentTable(): Promise<{ name: string; columns: Set<string> } | null> {
  for (const candidate of STUDENT_TABLE_CANDIDATES) {
    if (!(await tableExists(candidate))) {
      continue;
    }
    const columns = await getTableColumns(candidate);
    const hasUserId = columns.has("user_id");
    const hasIdentifier = STUDENT_ID_COLUMNS.some((column) => columns.has(column));
    if (!hasUserId || !hasIdentifier) {
      continue;
    }
    return { name: candidate, columns };
  }
  return null;
}

export async function GET() {
  try {
    const studentTable = await resolveStudentTable();
    if (!studentTable) {
      return NextResponse.json(
        {
          students: [],
          total: 0,
          metadata: {
            studentTable: null,
            notes: "No student table detected. Ensure a student table exists with user_id column.",
          },
        },
        { status: 200 },
      );
    }

    const userColumns = await getTableColumns("users");
    const studentIdColumn = pickFirstColumn(studentTable.columns, STUDENT_ID_COLUMNS) ?? "student_id";
    const sectionColumn = pickFirstColumn(studentTable.columns, SECTION_COLUMNS) ?? "section";
    const subjectColumn = pickFirstColumn(studentTable.columns, SUBJECT_COLUMNS);
    const gradeColumn = studentTable.columns.has("grade_level") ? "grade_level" : studentTable.columns.has("grade") ? "grade" : null;

    const studentContactColumn = pickFirstColumn(studentTable.columns, CONTACT_COLUMNS);
    const userContactColumn = pickFirstColumn(userColumns, CONTACT_COLUMNS);
    const studentEmailColumn = pickFirstColumn(studentTable.columns, EMAIL_COLUMNS);
    const userEmailColumn = pickFirstColumn(userColumns, EMAIL_COLUMNS) ?? "email";

    const selectParts: string[] = [
      `s.${studentIdColumn} AS student_identifier`,
      `s.user_id AS student_user_id`,
    ];

    if (gradeColumn) {
      selectParts.push(`s.${gradeColumn} AS grade_value`);
    } else {
      selectParts.push(`NULL AS grade_value`);
    }

    if (sectionColumn) {
      selectParts.push(`s.${sectionColumn} AS section_value`);
    } else {
      selectParts.push(`NULL AS section_value`);
    }

    if (subjectColumn) {
      selectParts.push(`s.${subjectColumn} AS subject_value`);
    } else {
      selectParts.push(`NULL AS subject_value`);
    }

    if (studentContactColumn) {
      selectParts.push(`s.${studentContactColumn} AS student_contact`);
    } else {
      selectParts.push(`NULL AS student_contact`);
    }

    if (studentEmailColumn) {
      selectParts.push(`s.${studentEmailColumn} AS student_email`);
    } else {
      selectParts.push(`NULL AS student_email`);
    }

    for (const column of NAME_COLUMNS) {
      if (studentTable.columns.has(column)) {
        selectParts.push(`s.${column} AS student_${column}`);
      } else {
        selectParts.push(`NULL AS student_${column}`);
      }
    }

    for (const column of NAME_COLUMNS) {
      if (userColumns.has(column)) {
        selectParts.push(`u.${column} AS user_${column}`);
      } else {
        selectParts.push(`NULL AS user_${column}`);
      }
    }

    if (userContactColumn) {
      selectParts.push(`u.${userContactColumn} AS user_contact`);
    } else {
      selectParts.push(`NULL AS user_contact`);
    }

    if (userColumns.has(userEmailColumn)) {
      selectParts.push(`u.${userEmailColumn} AS user_email`);
    } else {
      selectParts.push(`u.email AS user_email`);
    }

    selectParts.push("u.username AS user_username");

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM \`${studentTable.name}\` AS s
      JOIN users AS u ON u.user_id = s.user_id
      ORDER BY u.last_name ASC, u.first_name ASC
    `;

    const [rows] = await query<RowDataPacket[]>(sql);

    const students = rows.map((row) => {
      const identifierRaw = row.student_identifier;
      const studentId = identifierRaw !== null && identifierRaw !== undefined ? String(identifierRaw) : null;
      const gradeNumber = extractGradeNumber(row.grade_value);
      const gradeLabel = formatGradeLabel(row.grade_value);
      const section = row.section_value ? String(row.section_value).trim() : null;
      const subjects = row.subject_value ? String(row.subject_value).trim() : null;
      const nameParts = resolveName(row);
      const email = row.student_email ?? row.user_email ?? null;
      const contactNumber = row.student_contact ?? row.user_contact ?? null;

      return {
        studentId,
        userId: row.student_user_id ?? null,
        grade: gradeNumber ?? (gradeLabel ? gradeLabel : null),
        gradeNumber,
        gradeLabel,
        section,
        sections: section,
        subjects,
        name: nameParts.fullName,
        firstName: nameParts.firstName,
        middleName: nameParts.middleName,
        lastName: nameParts.lastName,
        email,
        contactNumber: contactNumber ? String(contactNumber) : null,
        username: row.user_username ?? null,
      };
    });

    const total = students.length;

    return NextResponse.json({
      students,
      total,
      metadata: {
        studentTable: studentTable.name,
        notes: null,
      },
    });
  } catch (error) {
    console.error("Failed to load principal students", error);
    return NextResponse.json({ error: "Failed to load students." }, { status: 500 });
  }
}
