import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

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

const splitGradeLevels = (value: unknown): number[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => extractGradeNumber(item)).filter((item): item is number => Number.isFinite(item));
  }
  const text = String(value);
  const matches = text.match(/\d+/g) ?? [];
  return matches.map((item) => Number(item)).filter((item) => Number.isFinite(item));
};

const mergeGrades = (...gradeLists: number[][]): number[] => {
  const all = gradeLists.flat();
  const unique = Array.from(new Set(all)).filter((value) => Number.isFinite(value));
  return unique.sort((a, b) => a - b);
};

async function fetchRoleRecords(role: "teacher" | "master_teacher") {
  const tableInfo = await resolveRoleTable(role);
  if (!tableInfo) {
    return { table: null, records: [] };
  }

  const userColumns = await getTableColumns("users");
  const identifierColumn =
    pickFirst(tableInfo.columns, IDENTIFIER_COLUMNS) ?? (role === "teacher" ? "teacher_id" : "master_teacher_id");

  const baseSelect: string[] = [
    `t.${identifierColumn} AS table_identifier`,
    "t.user_id AS user_id",
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
  baseSelect.push(userContactColumn ? `u.${userContactColumn} AS user_contact` : "NULL AS user_contact");

  const userEmailColumn = pickFirst(userColumns, EMAIL_COLUMNS) ?? "email";
  baseSelect.push(`u.${userEmailColumn} AS user_email`);

  baseSelect.push("NULL AS section_value");
  baseSelect.push("NULL AS subjects_value");

  const joinClauses: string[] = ["JOIN users AS u ON u.user_id = t.user_id"];

  const gradeTableExists = await tableExists("grade");
  if (role === "teacher") {
    const teacherHandledExists = await tableExists("teacher_handled");
    if (teacherHandledExists && gradeTableExists) {
      joinClauses.push(
        "LEFT JOIN (",
        "  SELECT th.teacher_id,",
        "    GROUP_CONCAT(DISTINCT g.grade_level ORDER BY g.grade_level) AS grade_levels",
        "  FROM teacher_handled AS th",
        "  LEFT JOIN grade AS g ON g.grade_id = th.grade_id",
        "  GROUP BY th.teacher_id",
        ") AS tg ON tg.teacher_id = t.teacher_id",
      );
      baseSelect.push("tg.grade_levels AS grade_levels");
    } else {
      baseSelect.push("NULL AS grade_levels");
    }
  } else {
    const coordinatorHandledExists = await tableExists("mt_coordinator_handled");
    const remedialHandledExists = await tableExists("mt_remedialteacher_handled");
    if (coordinatorHandledExists && gradeTableExists) {
      joinClauses.push(
        "LEFT JOIN (",
        "  SELECT mch.master_teacher_id,",
        "    GROUP_CONCAT(DISTINCT gc.grade_level ORDER BY gc.grade_level) AS coordinator_grade_levels",
        "  FROM mt_coordinator_handled AS mch",
        "  LEFT JOIN grade AS gc ON gc.grade_id = mch.grade_id",
        "  GROUP BY mch.master_teacher_id",
        ") AS mtc ON mtc.master_teacher_id = t.master_teacher_id",
      );
      baseSelect.push("mtc.coordinator_grade_levels AS coordinator_grade_levels");
    } else {
      baseSelect.push("NULL AS coordinator_grade_levels");
    }

    if (remedialHandledExists && gradeTableExists) {
      joinClauses.push(
        "LEFT JOIN (",
        "  SELECT mrh.master_teacher_id,",
        "    GROUP_CONCAT(DISTINCT gr.grade_level ORDER BY gr.grade_level) AS remedial_grade_levels",
        "  FROM mt_remedialteacher_handled AS mrh",
        "  LEFT JOIN grade AS gr ON gr.grade_id = mrh.grade_id",
        "  GROUP BY mrh.master_teacher_id",
        ") AS mtr ON mtr.master_teacher_id = t.master_teacher_id",
      );
      baseSelect.push("mtr.remedial_grade_levels AS remedial_grade_levels");
    } else {
      baseSelect.push("NULL AS remedial_grade_levels");
    }
  }

  const hasUserLastName = userColumns.has("last_name");
  const hasUserFirstName = userColumns.has("first_name");
  const hasUserUsername = userColumns.has("username");

  const orderClauses: string[] = [];
  if (hasUserLastName) {
    orderClauses.push("u.last_name ASC");
  }
  if (hasUserFirstName) {
    orderClauses.push("u.first_name ASC");
  }
  if (!orderClauses.length) {
    orderClauses.push(hasUserUsername ? "u.username ASC" : "u.user_id ASC");
  }

  const sql = `
    SELECT ${baseSelect.join(", ")}
    FROM \`${tableInfo.name}\` AS t
    ${joinClauses.join("\n")}
    ORDER BY ${orderClauses.join(", ")}
  `;

  const [rows] = await query<RowDataPacket[]>(sql);

  const records = rows.map((row) => {
    const nameParts = resolveName(row);
    const email = row.user_email ?? null;
    const contact = row.user_contact ?? null;
    const gradeLevels = role === "teacher"
      ? splitGradeLevels(row.grade_levels)
      : mergeGrades(splitGradeLevels(row.coordinator_grade_levels), splitGradeLevels(row.remedial_grade_levels));

    const gradeNumber = gradeLevels.length ? gradeLevels[0] : extractGradeNumber(row.grade_value);
    const gradeLabel = gradeLevels.length ? `Grade ${gradeLevels[0]}` : formatGradeLabel(row.grade_value);

    return {
      userId: row.user_id ?? null,
      teacherId: row.table_identifier !== null && row.table_identifier !== undefined ? String(row.table_identifier) : null,
      name: nameParts.fullName,
      firstName: nameParts.firstName,
      middleName: nameParts.middleName,
      lastName: nameParts.lastName,
      email,
      contactNumber: contact ? String(contact) : null,
      grade: gradeNumber ?? (gradeLabel ?? null),
      gradeNumber,
      gradeLabel,
      gradeLevels,
      section: null,
      sections: null,
      subjects: null,
      role: role === "teacher" ? "Teacher" : "Master Teacher",
    };
  });

  return {
    table: tableInfo.name,
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
