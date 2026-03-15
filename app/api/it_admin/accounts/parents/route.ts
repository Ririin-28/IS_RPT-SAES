import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import { requireItAdmin } from "@/lib/server/it-admin-auth";

export const dynamic = "force-dynamic";

const PARENT_TABLE_CANDIDATES = [
  "parent",
  "parents",
  "parent_profile",
  "parent_profiles",
] as const;

const USER_ID_COLUMNS = ["user_id", "account_id", "id"] as const;
const PARENT_ID_COLUMNS = ["parent_id", "guardian_id"] as const;
const NAME_COLUMNS = ["name", "full_name", "fullName"] as const;
const FIRST_NAME_COLUMNS = ["first_name", "firstName"] as const;
const MIDDLE_NAME_COLUMNS = ["middle_name", "middleName"] as const;
const LAST_NAME_COLUMNS = ["last_name", "lastName"] as const;
const SUFFIX_COLUMNS = ["suffix", "suffix_name", "suf"] as const;
const EMAIL_COLUMNS = ["email", "user_email"] as const;
const CONTACT_COLUMNS = [
  "contact_number",
  "contact_no",
  "phone_number",
  "phone",
  "mobile",
  "mobile_number",
] as const;
const STATUS_COLUMNS = ["status"] as const;
const STUDENT_NAME_COLUMNS = ["name", "full_name", "fullName"] as const;
const STUDENT_FIRST_NAME_COLUMNS = ["first_name", "firstName"] as const;
const STUDENT_MIDDLE_NAME_COLUMNS = ["middle_name", "middleName"] as const;
const STUDENT_LAST_NAME_COLUMNS = ["last_name", "lastName"] as const;
const STUDENT_SUFFIX_COLUMNS = ["suffix", "suffix_name", "suf"] as const;
const STUDENT_GRADE_COLUMNS = ["grade_level", "grade", "year_level", "gradeLevel"] as const;
const STUDENT_SECTION_COLUMNS = ["section"] as const;
const RELATIONSHIP_COLUMNS = ["relationship", "relation"] as const;
const ASSIGNMENT_TABLE = "student_teacher_assignment";
const PARENT_STUDENT_TABLE = "parent_student";
const STUDENT_TABLE = "student";
const GRADE_TABLE = "grade";
const ACCOUNT_LOGS_TABLE = "account_logs";

type ResolvedTable = {
  name: string;
  columns: Set<string>;
};

type RawParentRow = RowDataPacket & {
  parent_identifier: string | null;
  parent_user_id: number | null;
  user_id: number | null;
  user_first_name?: string | null;
  user_middle_name?: string | null;
  user_last_name?: string | null;
  user_suffix?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_contact_number?: string | null;
  user_phone_number?: string | null;
  user_status?: string | null;
  parent_first_name?: string | null;
  parent_middle_name?: string | null;
  parent_last_name?: string | null;
  parent_suffix?: string | null;
  parent_name?: string | null;
  parent_email?: string | null;
  parent_contact_number?: string | null;
  last_login?: Date | null;
  linked_student_id?: string | null;
  student_lrn?: string | null;
  relationship?: string | null;
  student_address?: string | null;
  student_first_name?: string | null;
  student_middle_name?: string | null;
  student_last_name?: string | null;
  student_suffix?: string | null;
  student_name?: string | null;
  student_grade_level?: string | null;
  student_grade_id?: number | null;
  student_section?: string | null;
  is_remedial?: number | null;
};

function sanitizeText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function coalesce<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string" && value.trim().length === 0) {
      continue;
    }
    return value;
  }
  return null;
}

function buildDisplayName(
  directName: string | null,
  firstName: string | null,
  middleName: string | null,
  lastName: string | null,
  suffix: string | null,
  fallback: string | null,
): string | null {
  if (directName) {
    return directName;
  }

  const parts = [firstName, middleName, lastName].filter(Boolean) as string[];
  if (suffix) {
    parts.push(suffix);
  }

  if (parts.length > 0) {
    return parts.join(" ");
  }

  return fallback;
}

function buildParentDisplayName(
  directName: string | null,
  firstName: string | null,
  middleName: string | null,
  lastName: string | null,
  suffix: string | null,
  fallback: string | null,
): string | null {
  if (lastName && firstName) {
    const middleInitial = middleName ? `${middleName.charAt(0).toUpperCase()}.` : null;
    const baseName = `${lastName}, ${firstName}${middleInitial ? ` ${middleInitial}` : ""}`;
    return suffix ? `${baseName}, ${suffix}` : baseName;
  }

  const partialParts = [lastName, firstName].filter(Boolean) as string[];
  if (partialParts.length > 0) {
    const baseName = partialParts.join(", ");
    return suffix ? `${baseName}, ${suffix}` : baseName;
  }

  return directName ?? fallback;
}

function pickColumn(columns: Set<string>, candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }

  const lowerLookup = new Map<string, string>();
  for (const column of columns) {
    lowerLookup.set(column.toLowerCase(), column);
  }

  for (const candidate of candidates) {
    const resolved = lowerLookup.get(candidate.toLowerCase());
    if (resolved) {
      return resolved;
    }
  }

  for (const candidate of candidates) {
    const needle = candidate.toLowerCase();
    for (const column of columns) {
      if (column.toLowerCase().includes(needle)) {
        return column;
      }
    }
  }

  return null;
}

async function safeGetColumns(tableName: string): Promise<Set<string>> {
  try {
    return await getTableColumns(tableName);
  } catch {
    return new Set<string>();
  }
}

async function resolveTable(candidates: readonly string[]): Promise<ResolvedTable | null> {
  for (const candidate of candidates) {
    if (!(await tableExists(candidate).catch(() => false))) {
      continue;
    }

    const columns = await safeGetColumns(candidate);
    if (columns.size > 0) {
      return { name: candidate, columns };
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:accounts.manage" });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const userColumns = await safeGetColumns("users");
    const parentTable = await resolveTable(PARENT_TABLE_CANDIDATES);
    const parentStudentColumns = await safeGetColumns(PARENT_STUDENT_TABLE);
    const studentColumns = await safeGetColumns(STUDENT_TABLE);
    const gradeColumns = await safeGetColumns(GRADE_TABLE);
    const assignmentColumns = await safeGetColumns(ASSIGNMENT_TABLE);
    const accountLogsColumns = await safeGetColumns(ACCOUNT_LOGS_TABLE);

    if (!parentTable || !parentTable.columns.size) {
      return NextResponse.json({ error: "Parent table is not accessible." }, { status: 500 });
    }

    const parentIdColumn = pickColumn(parentTable.columns, PARENT_ID_COLUMNS);
    const parentUserIdColumn = pickColumn(parentTable.columns, USER_ID_COLUMNS);

    if (!parentIdColumn) {
      return NextResponse.json({ error: "Parent identifier column is missing." }, { status: 500 });
    }

    const userFirstNameColumn = pickColumn(userColumns, FIRST_NAME_COLUMNS);
    const userMiddleNameColumn = pickColumn(userColumns, MIDDLE_NAME_COLUMNS);
    const userLastNameColumn = pickColumn(userColumns, LAST_NAME_COLUMNS);
    const userSuffixColumn = pickColumn(userColumns, SUFFIX_COLUMNS);
    const userNameColumn = pickColumn(userColumns, NAME_COLUMNS);
    const userEmailColumn = pickColumn(userColumns, EMAIL_COLUMNS);
    const userContactColumn = pickColumn(userColumns, CONTACT_COLUMNS);
    const userStatusColumn = pickColumn(userColumns, STATUS_COLUMNS);

    const parentFirstNameColumn = pickColumn(parentTable.columns, FIRST_NAME_COLUMNS);
    const parentMiddleNameColumn = pickColumn(parentTable.columns, MIDDLE_NAME_COLUMNS);
    const parentLastNameColumn = pickColumn(parentTable.columns, LAST_NAME_COLUMNS);
    const parentSuffixColumn = pickColumn(parentTable.columns, SUFFIX_COLUMNS);
    const parentNameColumn = pickColumn(parentTable.columns, NAME_COLUMNS);
    const parentEmailColumn = pickColumn(parentTable.columns, EMAIL_COLUMNS);
    const parentContactColumn = pickColumn(parentTable.columns, CONTACT_COLUMNS);

    const studentIdColumn = studentColumns.has("student_id") ? "student_id" : null;
    const studentLrnColumn = studentColumns.has("lrn") ? "lrn" : null;
    const studentFirstNameColumn = pickColumn(studentColumns, STUDENT_FIRST_NAME_COLUMNS);
    const studentMiddleNameColumn = pickColumn(studentColumns, STUDENT_MIDDLE_NAME_COLUMNS);
    const studentLastNameColumn = pickColumn(studentColumns, STUDENT_LAST_NAME_COLUMNS);
    const studentSuffixColumn = pickColumn(studentColumns, STUDENT_SUFFIX_COLUMNS);
    const studentNameColumn = pickColumn(studentColumns, STUDENT_NAME_COLUMNS);
    const studentGradeIdColumn = studentColumns.has("grade_id") ? "grade_id" : null;
    const studentGradeLevelColumn = pickColumn(studentColumns, STUDENT_GRADE_COLUMNS);
    const studentSectionColumn = pickColumn(studentColumns, STUDENT_SECTION_COLUMNS);

    const parentStudentParentIdColumn = parentStudentColumns.has("parent_id") ? "parent_id" : pickColumn(parentStudentColumns, PARENT_ID_COLUMNS);
    const parentStudentStudentIdColumn = parentStudentColumns.has("student_id") ? "student_id" : null;
    const parentStudentRelationshipColumn = pickColumn(parentStudentColumns, RELATIONSHIP_COLUMNS);
    const parentStudentAddressColumn = parentStudentColumns.has("address") ? "address" : null;
    const parentStudentIdColumn = parentStudentColumns.has("parent_student_id") ? "parent_student_id" : null;

    const gradeIdColumn = gradeColumns.has("grade_id") ? "grade_id" : null;
    const gradeLevelColumn = pickColumn(gradeColumns, ["grade_level", "grade", "name"]);

    const canJoinUsers = Boolean(parentUserIdColumn && userColumns.has("user_id"));
    const canJoinParentStudents = Boolean(parentStudentParentIdColumn && parentStudentStudentIdColumn);
    const canJoinStudents = Boolean(canJoinParentStudents && studentIdColumn);
    const canJoinGrade = Boolean(canJoinStudents && studentGradeIdColumn && gradeIdColumn && gradeLevelColumn);
    const canJoinAccountLogs = accountLogsColumns.has("user_id") && (accountLogsColumns.has("last_login") || accountLogsColumns.has("created_at"));
    const canComputeRemedial = assignmentColumns.has("student_id") && assignmentColumns.has("remedial_role_id");

    const selectParts: string[] = [
      `p.\`${parentIdColumn}\` AS parent_identifier`,
      parentUserIdColumn ? `p.\`${parentUserIdColumn}\` AS parent_user_id` : "NULL AS parent_user_id",
      canJoinUsers ? "u.user_id AS user_id" : "NULL AS user_id",
      userFirstNameColumn ? `u.\`${userFirstNameColumn}\` AS user_first_name` : "NULL AS user_first_name",
      userMiddleNameColumn ? `u.\`${userMiddleNameColumn}\` AS user_middle_name` : "NULL AS user_middle_name",
      userLastNameColumn ? `u.\`${userLastNameColumn}\` AS user_last_name` : "NULL AS user_last_name",
      userSuffixColumn ? `u.\`${userSuffixColumn}\` AS user_suffix` : "NULL AS user_suffix",
      userNameColumn ? `u.\`${userNameColumn}\` AS user_name` : "NULL AS user_name",
      userEmailColumn ? `u.\`${userEmailColumn}\` AS user_email` : "NULL AS user_email",
      userContactColumn ? `u.\`${userContactColumn}\` AS user_contact_number` : "NULL AS user_contact_number",
      userContactColumn ? `u.\`${userContactColumn}\` AS user_phone_number` : "NULL AS user_phone_number",
      userStatusColumn ? `u.\`${userStatusColumn}\` AS user_status` : "NULL AS user_status",
      parentFirstNameColumn ? `p.\`${parentFirstNameColumn}\` AS parent_first_name` : "NULL AS parent_first_name",
      parentMiddleNameColumn ? `p.\`${parentMiddleNameColumn}\` AS parent_middle_name` : "NULL AS parent_middle_name",
      parentLastNameColumn ? `p.\`${parentLastNameColumn}\` AS parent_last_name` : "NULL AS parent_last_name",
      parentSuffixColumn ? `p.\`${parentSuffixColumn}\` AS parent_suffix` : "NULL AS parent_suffix",
      parentNameColumn ? `p.\`${parentNameColumn}\` AS parent_name` : "NULL AS parent_name",
      parentEmailColumn ? `p.\`${parentEmailColumn}\` AS parent_email` : "NULL AS parent_email",
      parentContactColumn ? `p.\`${parentContactColumn}\` AS parent_contact_number` : "NULL AS parent_contact_number",
      canJoinAccountLogs ? "latest.last_login AS last_login" : "NULL AS last_login",
      canJoinParentStudents ? `ps.\`${parentStudentStudentIdColumn}\` AS linked_student_id` : "NULL AS linked_student_id",
      studentLrnColumn ? `s.\`${studentLrnColumn}\` AS student_lrn` : "NULL AS student_lrn",
      parentStudentRelationshipColumn ? `ps.\`${parentStudentRelationshipColumn}\` AS relationship` : "NULL AS relationship",
      parentStudentAddressColumn ? `ps.\`${parentStudentAddressColumn}\` AS student_address` : "NULL AS student_address",
      studentFirstNameColumn ? `s.\`${studentFirstNameColumn}\` AS student_first_name` : "NULL AS student_first_name",
      studentMiddleNameColumn ? `s.\`${studentMiddleNameColumn}\` AS student_middle_name` : "NULL AS student_middle_name",
      studentLastNameColumn ? `s.\`${studentLastNameColumn}\` AS student_last_name` : "NULL AS student_last_name",
      studentSuffixColumn ? `s.\`${studentSuffixColumn}\` AS student_suffix` : "NULL AS student_suffix",
      studentNameColumn ? `s.\`${studentNameColumn}\` AS student_name` : "NULL AS student_name",
      canJoinGrade
        ? `g.\`${gradeLevelColumn}\` AS student_grade_level`
        : studentGradeLevelColumn
          ? `s.\`${studentGradeLevelColumn}\` AS student_grade_level`
          : "NULL AS student_grade_level",
      studentGradeIdColumn ? `s.\`${studentGradeIdColumn}\` AS student_grade_id` : "NULL AS student_grade_id",
      studentSectionColumn ? `s.\`${studentSectionColumn}\` AS student_section` : "NULL AS student_section",
      canComputeRemedial ? "CASE WHEN rs.student_id IS NULL THEN 0 ELSE 1 END AS is_remedial" : "0 AS is_remedial",
    ];

    let joinClauses = "";
    if (canJoinUsers && parentUserIdColumn) {
      joinClauses += ` LEFT JOIN users u ON u.user_id = p.\`${parentUserIdColumn}\``;
    }
    if (canJoinAccountLogs) {
      joinClauses += ` LEFT JOIN (
        SELECT user_id, MAX(COALESCE(last_login, created_at)) AS last_login
        FROM ${ACCOUNT_LOGS_TABLE}
        GROUP BY user_id
      ) AS latest ON latest.user_id = p.\`${parentUserIdColumn}\``;
    }
    if (canJoinParentStudents && parentStudentParentIdColumn) {
      joinClauses += ` LEFT JOIN ${PARENT_STUDENT_TABLE} ps ON ps.\`${parentStudentParentIdColumn}\` = p.\`${parentIdColumn}\``;
      if (canJoinStudents && studentIdColumn) {
        joinClauses += ` LEFT JOIN ${STUDENT_TABLE} s ON s.\`${studentIdColumn}\` = ps.\`${parentStudentStudentIdColumn}\``;
      }
      if (canJoinGrade && studentGradeIdColumn && gradeIdColumn && gradeLevelColumn) {
        joinClauses += ` LEFT JOIN ${GRADE_TABLE} g ON g.\`${gradeIdColumn}\` = s.\`${studentGradeIdColumn}\``;
      }
      if (canComputeRemedial) {
        const activeFilter = assignmentColumns.has("is_active") ? " AND is_active = 1" : "";
        joinClauses += ` LEFT JOIN (
          SELECT DISTINCT student_id
          FROM ${ASSIGNMENT_TABLE}
          WHERE remedial_role_id IS NOT NULL
            AND TRIM(CAST(remedial_role_id AS CHAR)) <> ''
            ${activeFilter}
        ) AS rs ON rs.student_id = ps.\`${parentStudentStudentIdColumn}\``;
      }
    }

    const orderBy = [
      canJoinUsers ? "u.user_id DESC" : `p.\`${parentIdColumn}\` DESC`,
      parentStudentIdColumn ? `ps.\`${parentStudentIdColumn}\` ASC` : "",
      studentLastNameColumn ? "student_last_name ASC" : "",
      studentFirstNameColumn ? "student_first_name ASC" : "",
    ]
      .filter(Boolean)
      .join(", ");

    const [rows] = await query<RawParentRow[]>(
      `SELECT
        ${selectParts.join(",\n        ")}
      FROM \`${parentTable.name}\` p
      ${joinClauses}
      ORDER BY ${orderBy || `p.\`${parentIdColumn}\` DESC`}`,
    );

    const parentMap = new Map<string, any>();

    for (const row of rows) {
      const parentIdentifier = sanitizeText(row.parent_identifier) ?? sanitizeText(row.parent_user_id) ?? sanitizeText(row.user_id);
      if (!parentIdentifier) {
        continue;
      }

      const existing = parentMap.get(parentIdentifier);
      if (!existing) {
        const firstName = sanitizeText(coalesce(row.user_first_name, row.parent_first_name));
        const middleName = sanitizeText(coalesce(row.user_middle_name, row.parent_middle_name));
        const lastName = sanitizeText(coalesce(row.user_last_name, row.parent_last_name));
        const suffix = sanitizeText(coalesce(row.user_suffix, row.parent_suffix));
        const directName = sanitizeText(coalesce(row.user_name, row.parent_name));
        const email = sanitizeText(coalesce(row.user_email, row.parent_email));
        const contactNumber = sanitizeText(coalesce(row.user_contact_number, row.user_phone_number, row.parent_contact_number));
        const address = sanitizeText(row.student_address);
        const name = buildParentDisplayName(
          directName,
          firstName,
          middleName,
          lastName,
          suffix,
          email ?? `Parent ${parentIdentifier}`,
        );

        parentMap.set(parentIdentifier, {
          userId: row.user_id ?? row.parent_user_id ?? null,
          parentId: parentIdentifier,
          firstName,
          middleName,
          lastName,
          suffix,
          name,
          email,
          contactNumber,
          address,
          status: sanitizeText(row.user_status) ?? "Active",
          lastLogin: row.last_login instanceof Date ? row.last_login.toISOString() : null,
          linkedStudents: [],
          linkedStudentsCount: 0,
          remedialStudentsCount: 0,
        });
      }

      const parentRecord = parentMap.get(parentIdentifier);
      if (!parentRecord.address) {
        parentRecord.address = sanitizeText(row.student_address);
      }
      const studentId = sanitizeText(row.linked_student_id);
      if (!studentId) {
        continue;
      }

      const alreadyLinked = parentRecord.linkedStudents.some((student: any) => student.studentId === studentId);
      if (alreadyLinked) {
        continue;
      }

      const studentFirstName = sanitizeText(row.student_first_name);
      const studentMiddleName = sanitizeText(row.student_middle_name);
      const studentLastName = sanitizeText(row.student_last_name);
      const studentSuffix = sanitizeText(row.student_suffix);
      const studentDirectName = sanitizeText(row.student_name);
      const studentName = buildDisplayName(
        studentDirectName,
        studentFirstName,
        studentMiddleName,
        studentLastName,
        studentSuffix,
        `Student ${studentId}`,
      );

      let gradeLabel = sanitizeText(row.student_grade_level);
      if (!gradeLabel && row.student_grade_id != null && Number.isFinite(Number(row.student_grade_id))) {
        gradeLabel = `Grade ${row.student_grade_id}`;
      }

      const isRemedial = Number(row.is_remedial ?? 0) > 0;
      parentRecord.linkedStudents.push({
        studentId,
        lrn: sanitizeText(row.student_lrn),
        name: studentName,
        firstName: studentFirstName,
        middleName: studentMiddleName,
        lastName: studentLastName,
        suffix: studentSuffix,
        relationship: sanitizeText(row.relationship),
        address: sanitizeText(row.student_address),
        grade: gradeLabel,
        section: sanitizeText(row.student_section),
        remedialStatus: isRemedial ? "In Remedial" : "Not in Remedial",
        isRemedial,
      });
      parentRecord.linkedStudentsCount += 1;
      if (isRemedial) {
        parentRecord.remedialStudentsCount += 1;
      }
    }

    const records = Array.from(parentMap.values());

    return NextResponse.json({
      total: records.length,
      records,
      metadata: {
        parentTableDetected: parentTable.name,
        parentStudentJoined: canJoinParentStudents,
        studentJoined: canJoinStudents,
        remedialComputed: canComputeRemedial,
      },
    });
  } catch (error) {
    console.error("Failed to fetch parent accounts", error);
    return NextResponse.json({ error: "Failed to fetch parent accounts." }, { status: 500 });
  }
}
