import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLE_VARIANTS: Record<"teacher" | "master_teacher", string[]> = {
  teacher: ["teacher", "faculty"],
  master_teacher: ["master_teacher", "master-teacher", "masterteacher"],
};

const ROLE_TABLE_CANDIDATES: Record<"teacher" | "master_teacher", string[]> = {
  teacher: ["teacher", "teachers", "teacher_info"],
  master_teacher: ["master_teacher", "master_teachers", "master_teacher_info"],
};

const CONTACT_COLUMNS = [
  "contact_number",
  "contact_no",
  "phone",
  "mobile",
  "phone_number",
  "contact",
] as const;

const EMAIL_COLUMNS = ["email", "user_email"] as const;
const NAME_COLUMNS = ["first_name", "middle_name", "last_name"] as const;
const GRADE_COLUMNS = ["grade", "grade_level", "handled_grade", "year_level"] as const;
const SECTION_COLUMNS = ["section", "section_name", "class_section", "handled_section", "sections"] as const;
const SUBJECT_COLUMNS = ["subjects", "handled_subjects", "subject", "subject_list"] as const;
const IDENTIFIER_COLUMNS = ["teacher_id", "employee_id", "id", "master_teacher_id", "masterteacher_id"] as const;
const ROLE_COLUMN_CANDIDATES = ["role", "user_role", "userrole", "type", "user_type", "position"] as const;
const ROLE_TABLE_NAME = "role";
const ROLE_TABLE_NAME_COLUMN = "role_name";
const ROLE_TABLE_ID_COLUMN = "role_id";

function extractGradeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const match = String(value).match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatGradeLabel(value: unknown): string | null {
  const gradeNumber = extractGradeNumber(value);
  if (gradeNumber) {
    return `Grade ${gradeNumber}`;
  }
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function pickFirst(columns: Set<string>, candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function resolveRoleTable(role: "teacher" | "master_teacher") {
  for (const candidate of ROLE_TABLE_CANDIDATES[role]) {
    if (!(await tableExists(candidate))) {
      continue;
    }
    const columns = await getTableColumns(candidate);
    if (!columns.has("user_id")) {
      continue;
    }
    return { name: candidate, columns };
  }
  return null;
}

function resolveName(row: Record<string, any>): {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  fullName: string | null;
} {
  const variants = [
    ["table_first_name", "table_middle_name", "table_last_name"],
    ["user_first_name", "user_middle_name", "user_last_name"],
    ["first_name", "middle_name", "last_name"],
  ];

  for (const [firstKey, middleKey, lastKey] of variants) {
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

async function fetchRoleRecords(role: "teacher" | "master_teacher") {
  const tableInfo = await resolveRoleTable(role);
  const userColumns = await getTableColumns("users");
  const roleTableExists = await tableExists(ROLE_TABLE_NAME);
  const roleTableColumns = roleTableExists ? await getTableColumns(ROLE_TABLE_NAME) : null;
  const canJoinRoleTable = Boolean(
    roleTableColumns?.has(ROLE_TABLE_ID_COLUMN) && roleTableColumns?.has(ROLE_TABLE_NAME_COLUMN),
  );

  const baseSelect: string[] = [
    "u.user_id AS user_id",
    "u.username AS username",
  ];

  for (const column of NAME_COLUMNS) {
    if (userColumns.has(column)) {
      baseSelect.push(`u.${column} AS user_${column}`);
    } else {
      baseSelect.push(`NULL AS user_${column}`);
    }
  }

  const userContactColumn = pickFirst(userColumns, CONTACT_COLUMNS);
  if (userContactColumn) {
    baseSelect.push(`u.${userContactColumn} AS user_contact`);
  } else {
    baseSelect.push("NULL AS user_contact");
  }

  const userEmailColumn = pickFirst(userColumns, EMAIL_COLUMNS) ?? "email";
  baseSelect.push(`u.${userEmailColumn} AS user_email`);
  const userRoleColumn = pickFirst(userColumns, ROLE_COLUMN_CANDIDATES);
  const tableRoleColumn = tableInfo ? pickFirst(tableInfo.columns, ROLE_COLUMN_CANDIDATES) : null;

  if (canJoinRoleTable) {
    baseSelect.push(`r.${ROLE_TABLE_NAME_COLUMN} AS user_role`);
  } else if (userRoleColumn) {
    baseSelect.push(`u.${userRoleColumn} AS user_role`);
  } else if (tableRoleColumn) {
    baseSelect.push(`t.${tableRoleColumn} AS user_role`);
  } else {
    baseSelect.push("NULL AS user_role");
  }

  let joinClause = "";
  if (tableInfo) {
    const { name, columns } = tableInfo;
    joinClause = `LEFT JOIN \`${name}\` AS t ON t.user_id = u.user_id`;

    const identifierColumn = pickFirst(columns, IDENTIFIER_COLUMNS);
    baseSelect.push(
      identifierColumn
        ? `t.${identifierColumn} AS table_identifier`
        : "NULL AS table_identifier",
    );

    for (const column of NAME_COLUMNS) {
      if (columns.has(column)) {
        baseSelect.push(`t.${column} AS table_${column}`);
      } else {
        baseSelect.push(`NULL AS table_${column}`);
      }
    }

    const gradeColumn = pickFirst(columns, GRADE_COLUMNS);
    baseSelect.push(gradeColumn ? `t.${gradeColumn} AS grade_value` : "NULL AS grade_value");

    const sectionColumn = pickFirst(columns, SECTION_COLUMNS);
    baseSelect.push(sectionColumn ? `t.${sectionColumn} AS section_value` : "NULL AS section_value");

    const subjectColumn = pickFirst(columns, SUBJECT_COLUMNS);
    baseSelect.push(subjectColumn ? `t.${subjectColumn} AS subjects_value` : "NULL AS subjects_value");

    const contactColumn = pickFirst(columns, CONTACT_COLUMNS);
    baseSelect.push(contactColumn ? `t.${contactColumn} AS table_contact` : "NULL AS table_contact");

    const emailColumn = pickFirst(columns, EMAIL_COLUMNS);
    baseSelect.push(emailColumn ? `t.${emailColumn} AS table_email` : "NULL AS table_email");
  } else {
    baseSelect.push("NULL AS table_identifier");
    baseSelect.push("NULL AS table_first_name");
    baseSelect.push("NULL AS table_middle_name");
    baseSelect.push("NULL AS table_last_name");
    baseSelect.push("NULL AS grade_value");
    baseSelect.push("NULL AS section_value");
    baseSelect.push("NULL AS subjects_value");
    baseSelect.push("NULL AS table_contact");
    baseSelect.push("NULL AS table_email");
  }

  const roleFilters = ROLE_VARIANTS[role];
  const placeholders = roleFilters.map(() => "?").join(", ");

  const hasUserLastName = userColumns.has("last_name");
  const hasUserFirstName = userColumns.has("first_name");
  const hasUserUsername = userColumns.has("username");
  const hasTableLastName = tableInfo ? tableInfo.columns.has("last_name") : false;
  const hasTableFirstName = tableInfo ? tableInfo.columns.has("first_name") : false;

  const orderClauses: string[] = [];
  if (hasUserLastName) {
    orderClauses.push("u.last_name ASC");
  } else if (hasTableLastName) {
    orderClauses.push("t.last_name ASC");
  }

  if (hasUserFirstName) {
    orderClauses.push("u.first_name ASC");
  } else if (hasTableFirstName) {
    orderClauses.push("t.first_name ASC");
  }

  if (!orderClauses.length) {
    orderClauses.push(hasUserUsername ? "u.username ASC" : "u.user_id ASC");
  }

  const orderClause = orderClauses.join(", ");

  let whereClause = "";
  let params: (string | number)[] = [];

  if (canJoinRoleTable) {
    joinClause = `${joinClause}\n    LEFT JOIN ${ROLE_TABLE_NAME} AS r ON r.${ROLE_TABLE_ID_COLUMN} = u.${ROLE_TABLE_ID_COLUMN}`;
    whereClause = `WHERE r.${ROLE_TABLE_NAME_COLUMN} IN (${placeholders})`;
    params = roleFilters;
  } else if (userRoleColumn) {
    whereClause = `WHERE u.${userRoleColumn} IN (${placeholders})`;
    params = roleFilters;
  } else if (tableRoleColumn) {
    whereClause = `WHERE t.${tableRoleColumn} IN (${placeholders})`;
    params = roleFilters;
  }

  const sql = `
    SELECT ${baseSelect.join(", ")}
    FROM users AS u
    ${joinClause}
    ${whereClause}
    ORDER BY ${orderClause}
  `;

  const [rows] = await query<RowDataPacket[]>(sql, params);

  const records = rows.map((row) => {
    const identifier = row.table_identifier ?? row.user_id;
    const gradeNumber = extractGradeNumber(row.grade_value);
    const gradeLabel = formatGradeLabel(row.grade_value);
    const sectionRaw = row.section_value ? String(row.section_value).trim() : null;
    const subjectsRaw = row.subjects_value ? String(row.subjects_value).trim() : null;
    const nameParts = resolveName(row);
    const email = row.table_email ?? row.user_email ?? null;
    const contact = row.table_contact ?? row.user_contact ?? null;

    return {
      userId: row.user_id ?? null,
      teacherId: identifier !== null && identifier !== undefined ? String(identifier) : null,
      name: nameParts.fullName,
      firstName: nameParts.firstName,
      middleName: nameParts.middleName,
      lastName: nameParts.lastName,
      email,
      contactNumber: contact ? String(contact) : null,
      grade: gradeNumber ?? (gradeLabel ?? null),
      gradeNumber,
      gradeLabel,
      section: sectionRaw,
      sections: sectionRaw,
      subjects: subjectsRaw,
      role: row.user_role ?? null,
    };
  });

  return {
    table: tableInfo?.name ?? null,
    records,
  };
}

export async function GET() {
  try {
    const [teacherResult, masterResult] = await Promise.all([
      fetchRoleRecords("teacher"),
      fetchRoleRecords("master_teacher"),
    ]);

    return NextResponse.json({
      teachers: teacherResult.records,
      masterTeachers: masterResult.records,
      totals: {
        teachers: teacherResult.records.length,
        masterTeachers: masterResult.records.length,
        all: teacherResult.records.length + masterResult.records.length,
      },
      metadata: {
        teacherTable: teacherResult.table,
        masterTeacherTable: masterResult.table,
      },
    });
  } catch (error) {
    console.error("Failed to load principal teachers", error);
    return NextResponse.json({ error: "Failed to load teachers." }, { status: 500 });
  }
}
