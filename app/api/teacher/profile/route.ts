import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const TEACHER_TABLE_CANDIDATES = [
  "remedial_teachers",
  "teacher",
  "teachers",
  "teacher_info",
  "teacher_profile",
  "teacher_profiles",
  "faculty",
  "faculty_info",
  "faculty_profiles",
] as const;

const GRADE_COLUMNS = [
  "grade",
  "grade_level",
  "handled_grade",
  "gradelevel",
  "gradeLevel",
  "year_level",
] as const;

const SUBJECT_COLUMNS = [
  "subject",
  "subjects",
  "subject_handled",
  "handled_subjects",
  "subject_area",
  "subjects_handled",
] as const;

const SECTION_COLUMNS = [
  "section",
  "sections",
  "section_name",
  "handled_section",
  "class_section",
  "section_handled",
] as const;

const CONTACT_COLUMNS = [
  "contact_number",
  "contact_no",
  "phone",
  "phone_number",
  "mobile",
  "mobile_number",
] as const;

const EMAIL_COLUMNS = [
  "email",
  "user_email",
] as const;

const IDENTIFIER_COLUMNS = [
  "teacher_id",
  "employee_id",
  "user_code",
  "id",
  "user_id",
] as const;

type ColumnName = string;

type ResolvedTeacherTable = {
  name: string;
  columns: Set<ColumnName>;
};

const loadTeacherHandledGrade = async (
  teacherIds: Array<string | number | null | undefined>,
): Promise<{ gradeRaw: string | null; gradeLabel: string | null; gradeNumber: number | null } | null> => {
  const ids = teacherIds
    .map((id) => {
      if (id === null || id === undefined) return null;
      const text = String(id).trim();
      return text.length ? text : null;
    })
    .filter((id): id is string => Boolean(id));

  if (!ids.length) {
    return null;
  }

  const uniqueIds = Array.from(new Set(ids));

  try {
    const [rows] = await query<RowDataPacket[]>(
      `SELECT th.grade_id, g.grade_level
       FROM teacher_handled th
       LEFT JOIN grade g ON g.grade_id = th.grade_id
       WHERE th.teacher_id IN (${uniqueIds.map(() => "?").join(", ")})
       LIMIT 1`,
      uniqueIds,
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const raw = row.grade_level ?? row.grade_id ?? null;
    const gradeRaw = raw != null ? String(raw) : null;
    const gradeLabel = formatGradeLabel(raw ?? row.grade_id);
    const gradeNumber = extractGradeNumber(raw ?? row.grade_id);
    return { gradeRaw, gradeLabel, gradeNumber };
  } catch (error) {
    console.error("Failed to load teacher_handled grade", error);
    return null;
  }
};

const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
};

const extractGradeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const match = String(value).match(/(\d+)/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatGradeLabel = (value: unknown): string | null => {
  const number = extractGradeNumber(value);
  if (number) {
    return `Grade ${number}`;
  }
  const text = toNullableString(value);
  return text ?? null;
};

const pickColumn = (columns: Set<string>, candidates: readonly string[]): string | null => {
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
};

const resolveTeacherTable = async (): Promise<ResolvedTeacherTable | null> => {
  for (const candidate of TEACHER_TABLE_CANDIDATES) {
    if (!(await tableExists(candidate))) {
      continue;
    }
    const columns = await getTableColumns(candidate);
    if (!columns.size) {
      continue;
    }
    return { name: candidate, columns };
  }
  return null;
};

export async function PUT(request: NextRequest) {
  const userIdParam = request.nextUrl.searchParams.get("userId");
  if (!userIdParam) {
    return NextResponse.json(
      { success: false, error: "Missing userId query parameter." },
      { status: 400 },
    );
  }

  const userId = Number(userIdParam);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json(
      { success: false, error: "Invalid userId value." },
      { status: 400 },
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  try {
    const userColumns = await getTableColumns("users");
    const updates: string[] = [];
    const params: any[] = [];

    if (body.firstName !== undefined && userColumns.has("first_name")) {
      updates.push("first_name = ?");
      params.push(body.firstName?.trim() || null);
    }
    if (body.middleName !== undefined && userColumns.has("middle_name")) {
      updates.push("middle_name = ?");
      params.push(body.middleName?.trim() || null);
    }
    if (body.lastName !== undefined && userColumns.has("last_name")) {
      updates.push("last_name = ?");
      params.push(body.lastName?.trim() || null);
    }
    if (body.email !== undefined && userColumns.has("email")) {
      updates.push("email = ?");
      params.push(body.email?.trim() || null);
    }
    if (body.contactNumber !== undefined && userColumns.has("contact_number")) {
      updates.push("contact_number = ?");
      params.push(body.contactNumber?.trim() || null);
    }
    if (body.subject !== undefined && userColumns.has("subject")) {
      updates.push("subject = ?");
      params.push(body.subject?.trim() || null);
    }

    if (updates.length > 0) {
      params.push(userId);
      await query(`UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`, params);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update teacher profile", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const userIdParam = request.nextUrl.searchParams.get("userId");
  if (!userIdParam) {
    return NextResponse.json(
      { success: false, error: "Missing userId query parameter." },
      { status: 400 },
    );
  }

  const userId = Number(userIdParam);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json(
      { success: false, error: "Invalid userId value." },
      { status: 400 },
    );
  }

  try {
    const userColumns = await getTableColumns("users");
    if (!userColumns.size) {
      return NextResponse.json(
        { success: false, error: "Users table is unavailable." },
        { status: 500 },
      );
    }

    const teacherTable = await resolveTeacherTable();

    const selectParts: string[] = ["u.user_id AS user_id"];

    const addUserColumn = (column: string, alias: string) => {
      if (userColumns.has(column)) {
        selectParts.push(`u.${column} AS ${alias}`);
      } else {
        selectParts.push(`NULL AS ${alias}`);
      }
    };

    addUserColumn("first_name", "user_first_name");
    addUserColumn("middle_name", "user_middle_name");
    addUserColumn("last_name", "user_last_name");
    addUserColumn("suffix", "user_suffix");
    addUserColumn(userColumns.has("teacher_id") ? "teacher_id" : "", "user_teacher_id");
    addUserColumn(userColumns.has("role") ? "role" : "", "user_role");
    addUserColumn(userColumns.has("user_code") ? "user_code" : "", "user_code");

    const userGradeColumn = pickColumn(userColumns, GRADE_COLUMNS);
    if (userGradeColumn) {
      selectParts.push(`u.${userGradeColumn} AS user_grade`);
    } else {
      selectParts.push("NULL AS user_grade");
    }

    const userSubjectColumn = pickColumn(userColumns, SUBJECT_COLUMNS);
    if (userSubjectColumn) {
      selectParts.push(`u.${userSubjectColumn} AS user_subject`);
    } else {
      selectParts.push("NULL AS user_subject");
    }

    const userSectionColumn = pickColumn(userColumns, SECTION_COLUMNS);
    if (userSectionColumn) {
      selectParts.push(`u.${userSectionColumn} AS user_section`);
    } else {
      selectParts.push("NULL AS user_section");
    }

    const userContactColumn = pickColumn(userColumns, CONTACT_COLUMNS);
    if (userContactColumn) {
      selectParts.push(`u.${userContactColumn} AS user_contact`);
    } else {
      selectParts.push("NULL AS user_contact");
    }

    const userEmailColumn = pickColumn(userColumns, EMAIL_COLUMNS) ?? (userColumns.has("email") ? "email" : null);
    if (userEmailColumn) {
      selectParts.push(`u.${userEmailColumn} AS user_email`);
    } else {
      selectParts.push("NULL AS user_email");
    }

    let joinClause = "";

    if (teacherTable) {
      const joinConditions: string[] = [];
      const { name, columns } = teacherTable;
      const addTeacherColumn = (column: string, alias: string) => {
        if (columns.has(column)) {
          selectParts.push(`t.${column} AS ${alias}`);
        } else {
          selectParts.push(`NULL AS ${alias}`);
        }
      };

      addTeacherColumn(pickColumn(columns, IDENTIFIER_COLUMNS) ?? "", "teacher_identifier");
      addTeacherColumn(pickColumn(columns, GRADE_COLUMNS) ?? "", "teacher_grade");
      addTeacherColumn(pickColumn(columns, SUBJECT_COLUMNS) ?? "", "teacher_subject");
      addTeacherColumn(pickColumn(columns, SECTION_COLUMNS) ?? "", "teacher_section");
      addTeacherColumn(pickColumn(columns, CONTACT_COLUMNS) ?? "", "teacher_contact");
      addTeacherColumn(pickColumn(columns, EMAIL_COLUMNS) ?? "", "teacher_email");

      const joinCandidatePairs: Array<[string, string]> = [
        ["user_id", "user_id"],
        ["teacher_id", "user_id"],
        ["employee_id", "user_id"],
        ["id", "user_id"],
        ["user_code", "user_code"],
        ["teacher_id", "teacher_id"],
        ["user_code", "teacher_id"],
        ["teacher_id", "user_code"],
        userEmailColumn ? ["email", userEmailColumn] : ["", ""],
      ];

      for (const [teacherKey, userKey] of joinCandidatePairs) {
        if (!teacherKey || !userKey) {
          continue;
        }
        if (columns.has(teacherKey) && userColumns.has(userKey)) {
          joinConditions.push(`t.${teacherKey} = u.${userKey}`);
        }
      }

      if (!joinConditions.length) {
        if (columns.has("user_id")) {
          joinConditions.push("t.user_id = u.user_id");
        }
        if (columns.has("teacher_id") && userColumns.has("user_code")) {
          joinConditions.push("t.teacher_id = u.user_code");
        }
      }

      if (joinConditions.length) {
        joinClause = `LEFT JOIN \`${name}\` AS t ON ${joinConditions.join(" OR ")}`;
      }
    } else {
      selectParts.push("NULL AS teacher_identifier");
      selectParts.push("NULL AS teacher_grade");
      selectParts.push("NULL AS teacher_subject");
      selectParts.push("NULL AS teacher_section");
      selectParts.push("NULL AS teacher_contact");
      selectParts.push("NULL AS teacher_email");
    }

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM users AS u
      ${joinClause}
      WHERE u.user_id = ?
      LIMIT 1
    `;

    const [rows] = await query<RowDataPacket[]>(sql, [userId]);
    if (!rows.length) {
      return NextResponse.json(
        { success: false, error: "Teacher profile not found." },
        { status: 404 },
      );
    }

    const row = rows[0] as RowDataPacket & {
      user_grade?: unknown;
      teacher_grade?: unknown;
      user_subject?: unknown;
      teacher_subject?: unknown;
      user_section?: unknown;
      teacher_section?: unknown;
      user_contact?: unknown;
      teacher_contact?: unknown;
      user_email?: unknown;
      teacher_email?: unknown;
      teacher_identifier?: unknown;
      user_first_name?: unknown;
      user_middle_name?: unknown;
      user_last_name?: unknown;
      user_suffix?: unknown;
      user_teacher_id?: unknown;
      user_code?: unknown;
      user_role?: unknown;
    };

    const teacherIds = [
      row.teacher_identifier,
      row.user_teacher_id,
      row.user_code,
      row.user_id,
    ];
    const handledGrade = await loadTeacherHandledGrade(teacherIds);

    const gradeRaw = handledGrade?.gradeRaw
      ?? toNullableString(row.teacher_grade)
      ?? toNullableString(row.user_grade);
    const gradeLabel = handledGrade?.gradeLabel ?? formatGradeLabel(gradeRaw);
    const gradeNumber = handledGrade?.gradeNumber ?? extractGradeNumber(gradeRaw);

    const profilePayload = {
      userId: row.user_id,
      role: row.user_role ?? null,
      firstName: toNullableString(row.user_first_name),
      middleName: toNullableString(row.user_middle_name),
      lastName: toNullableString(row.user_last_name),
      suffix: toNullableString(row.user_suffix),
      grade: gradeLabel,
      gradeLabel,
      gradeRaw,
      gradeNumber,
      subjectHandled: toNullableString(row.teacher_subject) ?? toNullableString(row.user_subject),
      section: toNullableString(row.teacher_section) ?? toNullableString(row.user_section),
      contactNumber: toNullableString(row.teacher_contact) ?? toNullableString(row.user_contact),
      email: toNullableString(row.teacher_email) ?? toNullableString(row.user_email),
      teacherIdentifier: toNullableString(row.teacher_identifier),
    };

    if (!profilePayload.grade) {
      return NextResponse.json({
        success: true,
        profile: profilePayload,
        metadata: { missingGrade: true },
      });
    }

    return NextResponse.json({ success: true, profile: profilePayload, metadata: { missingGrade: false } });
  } catch (error) {
    console.error("Failed to load teacher profile", error);
    return NextResponse.json(
      { success: false, error: "Failed to load teacher profile." },
      { status: 500 },
    );
  }
}
