import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import {
  ensureUserProfileImageColumn,
  uploadProfileImage,
  cleanupProfileImage,
  ProfileImageValidationError,
} from "@/lib/server/profile-image";
import { parseProfileMutationRequest, resolveAuthorizedProfileUserId } from "@/lib/server/profile-request";
import { getMasterTeacherSessionFromCookies } from "@/lib/server/master-teacher-session";
import { getTableColumns, query, runWithConnection, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const REMEDIAL_HANDLED_TABLE = "mt_remedialteacher_handled" as const;
const COORDINATOR_TABLE = "mt_coordinator" as const;
const COORDINATOR_HANDLED_TABLE = "mt_coordinator_handled" as const;
const SUBJECT_TABLE = "subject" as const;
const STUDENT_TEACHER_ASSIGNMENT_TABLE = "student_teacher_assignment" as const;

const COORDINATOR_SUBJECT_COLUMNS = [
  { column: "subject_handled", alias: "mc_subject_handled" },
  { column: "coordinator_subject", alias: "mc_coordinator_subject" },
  { column: "subject", alias: "mc_subject" },
  { column: "subjects", alias: "mc_subjects" },
  { column: "handled_subjects", alias: "mc_handled_subjects" },
  { column: "coordinator_subject_handled", alias: "mc_coordinator_subject_handled" },
] as const;

const NAME_COLUMNS = [
  { column: "first_name", alias: "user_first_name" },
  { column: "middle_name", alias: "user_middle_name" },
  { column: "last_name", alias: "user_last_name" },
  { column: "suffix", alias: "user_suffix" },
  { column: "name", alias: "user_display_name" },
] as const;

const CONTACT_COLUMNS = [
  { column: "email", alias: "user_email" },
  { column: "contact_number", alias: "user_contact_number" },
  { column: "phone_number", alias: "user_phone_number" },
] as const;

function pickFirst<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        continue;
      }
      return trimmed as T;
    }
    return value;
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

async function safeTableExists(tableName: string): Promise<boolean> {
  try {
    return await tableExists(tableName);
  } catch {
    return false;
  }
}

async function resolveMasterTeacherIds(userId: number): Promise<string[]> {
  const ids = new Set<string>();

  const columns = await safeGetColumns("master_teacher");
  if (!columns.size || !columns.has("user_id")) {
    return Array.from(ids);
  }

  const hasMasterTeacherId = columns.has("master_teacher_id");
  const selectParts = ["user_id AS user_id"];
  if (hasMasterTeacherId) {
    selectParts.push("master_teacher_id AS master_teacher_id");
  }

  const sql = `SELECT ${selectParts.join(", ")} FROM \`master_teacher\` WHERE user_id = ?`;
  const [rows] = await query<RowDataPacket[]>(sql, [userId]);

  for (const row of rows ?? []) {
    if (row.user_id != null) {
      ids.add(String(row.user_id));
    }
    if (hasMasterTeacherId && row.master_teacher_id != null) {
      const mtId = String(row.master_teacher_id).trim();
      if (mtId) {
        ids.add(mtId);
      }
    }
  }

  return Array.from(ids);
}

type RawProfileRow = RowDataPacket & {
  user_id: number;
  user_master_teacher_id?: string | null;
  user_profile_image_url?: string | null;
  mt_master_teacher_id?: string | null;
  mt_masterteacher_id?: string | null;
  mt_teacher_id?: string | null;
  rt_master_teacher_id?: string | null;
  rt_remedial_teacher_id?: string | null;
  user_first_name?: string | null;
  user_middle_name?: string | null;
  user_last_name?: string | null;
  user_suffix?: string | null;
  user_display_name?: string | null;
  user_email?: string | null;
  user_contact_number?: string | null;
  user_phone_number?: string | null;
  user_role?: string | null;
  rt_grade?: string | null;
  rt_grade_level?: string | null;
  rt_handled_grade?: string | null;
  rt_gradelevel?: string | null;
  rt_gradeLevel?: string | null;
  rt_room?: string | null;
  rt_room_number?: string | null;
  rt_homeroom?: string | null;
  rt_classroom?: string | null;
  rt_room_assigned?: string | null;
  mc_subject_handled?: string | null;
  mc_coordinator_subject?: string | null;
  mc_subject?: string | null;
  mc_subjects?: string | null;
  mc_handled_subjects?: string | null;
  mc_coordinator_subject_handled?: string | null;
};

function buildName(
  first: string | null,
  middle: string | null,
  last: string | null,
  suffix: string | null,
): string | null {
  const parts = [first, middle, last]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .map((part) => (part ? part.trim() : ""));
  if (parts.length === 0) {
    return null;
  }
  if (suffix && suffix.trim().length > 0) {
    parts.push(suffix.trim());
  }
  return parts.join(" ");
}

async function loadRemedialHandled(masterTeacherIds: Array<string | number>): Promise<{ gradeLevel: string | null }> {
  const ids = masterTeacherIds
    .map((id) => {
      if (id === null || id === undefined) return null;
      const text = String(id).trim();
      return text.length ? text : null;
    })
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return { gradeLevel: null };
  }

  const uniqueIds = Array.from(new Set(ids));

  try {
    const handledColumns = await safeGetColumns(REMEDIAL_HANDLED_TABLE);
    const hasHandledGradeId = handledColumns.has("grade_id");

    const gradeColumns = await safeGetColumns("grade");
    const gradeLabelColumn = gradeColumns.has("grade_level")
      ? "grade_level"
      : gradeColumns.has("label")
        ? "label"
        : gradeColumns.has("name")
          ? "name"
          : gradeColumns.has("grade")
            ? "grade"
            : null;

    const selectParts = ["mr.master_teacher_id"];
    if (hasHandledGradeId) {
      selectParts.push("mr.grade_id AS handled_grade_id");
    }
    if (gradeLabelColumn) {
      selectParts.push(`g.${gradeLabelColumn} AS grade_table_label`);
    }

    const joinClause = gradeLabelColumn ? `LEFT JOIN grade g ON g.grade_id = mr.grade_id` : "";

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM ${REMEDIAL_HANDLED_TABLE} mr
      ${joinClause}
      WHERE mr.master_teacher_id IN (${uniqueIds.map(() => "?").join(", ")})
      LIMIT 1`;

    const [rows] = await query<RowDataPacket[]>(sql, uniqueIds);

    if (!Array.isArray(rows) || rows.length === 0) {
      return { gradeLevel: null };
    }

    const row = rows[0];
    const tableLabel = row.grade_table_label != null ? String(row.grade_table_label) : null;
    const handledGradeId = row.handled_grade_id != null ? Number(row.handled_grade_id) : null;

    if (tableLabel && tableLabel.trim().length) {
      return { gradeLevel: tableLabel.trim() };
    }

    if (Number.isFinite(handledGradeId)) {
      return { gradeLevel: `Grade ${handledGradeId}` };
    }

    return { gradeLevel: null };
  } catch {
    return { gradeLevel: null };
  }
}

async function loadCoordinatorHandledSubject(
  masterTeacherIds: Array<string | number>,
): Promise<string | null> {
  const ids = masterTeacherIds
    .map((id) => {
      if (id === null || id === undefined) return null;
      const text = String(id).trim();
      return text.length ? text : null;
    })
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return null;
  }

  try {
    const handledColumns = await safeGetColumns(COORDINATOR_HANDLED_TABLE);
    const tableExists = handledColumns.size > 0 || await safeTableExists(COORDINATOR_HANDLED_TABLE);
    if (!tableExists || (handledColumns.size > 0 && !handledColumns.has("master_teacher_id"))) {
      return null;
    }

    const subjectColumns = await safeGetColumns(SUBJECT_TABLE);
    const subjectNameColumn = subjectColumns.has("subject_name")
      ? "subject_name"
      : subjectColumns.has("name")
        ? "name"
        : null;

    const selectParts = ["mch.subject_id AS subject_id"];
    if (subjectNameColumn) {
      selectParts.push(`s.${subjectNameColumn} AS subject_name`);
    }

    const joinClause = subjectNameColumn ? `LEFT JOIN ${SUBJECT_TABLE} s ON s.subject_id = mch.subject_id` : "";

    const [rows] = await query<RowDataPacket[]>(
      `SELECT ${selectParts.join(", ")}
       FROM ${COORDINATOR_HANDLED_TABLE} mch
       ${joinClause}
       WHERE mch.master_teacher_id IN (${ids.map(() => "?").join(", ")})
       LIMIT 1`,
      ids,
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    const row = rows[0];
    if (row.subject_name != null) {
      const name = String(row.subject_name).trim();
      return name.length ? name : null;
    }
    if (row.subject_id != null) {
      return `Subject ${row.subject_id}`;
    }
  } catch {
    return null;
  }

  return null;
}

async function loadRemedialSubjectsFromAssignments(
  masterTeacherIds: Array<string | number>,
): Promise<string[]> {
  const ids = masterTeacherIds
    .map((id) => {
      if (id === null || id === undefined) return null;
      const text = String(id).trim();
      return text.length ? text : null;
    })
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return [];
  }

  try {
    const assignmentColumns = await safeGetColumns(STUDENT_TEACHER_ASSIGNMENT_TABLE);
    const tableExists = assignmentColumns.size > 0 || await safeTableExists(STUDENT_TEACHER_ASSIGNMENT_TABLE);
    if (!tableExists || (assignmentColumns.size > 0 && !assignmentColumns.has("teacher_id"))) {
      return [];
    }

    const subjectColumns = await safeGetColumns(SUBJECT_TABLE);
    const subjectNameColumn = subjectColumns.has("subject_name")
      ? "subject_name"
      : subjectColumns.has("name")
        ? "name"
        : null;

    const selectParts = ["sta.subject_id AS subject_id"];
    if (subjectNameColumn) {
      selectParts.push(`s.${subjectNameColumn} AS subject_name`);
    }

    const joinClause = subjectNameColumn ? `LEFT JOIN ${SUBJECT_TABLE} s ON s.subject_id = sta.subject_id` : "";
    const whereClauses = [
      `sta.teacher_id IN (${ids.map(() => "?").join(", ")})`,
    ];
    const params: Array<string | number> = [...ids];

    if (assignmentColumns.has("assigned_role")) {
      whereClauses.push("sta.assigned_role = ?");
      params.push("REMEDIAL");
    }

    if (assignmentColumns.has("is_active")) {
      whereClauses.push("sta.is_active = 1");
    }

    const [rows] = await query<RowDataPacket[]>(
      `SELECT DISTINCT ${selectParts.join(", ")}
       FROM ${STUDENT_TEACHER_ASSIGNMENT_TABLE} sta
       ${joinClause}
       WHERE ${whereClauses.join(" AND ")}`,
      params,
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    const subjects: string[] = [];
    for (const row of rows) {
      if (row.subject_name != null) {
        const name = String(row.subject_name).trim();
        if (name.length && !subjects.includes(name)) {
          subjects.push(name);
        }
      } else if (row.subject_id != null) {
        const subjectId = `Subject ${row.subject_id}`;
        if (!subjects.includes(subjectId)) {
          subjects.push(subjectId);
        }
      }
    }

    return subjects;
  } catch {
    return [];
  }
}

async function loadAllCoordinatorSubjects(
  masterTeacherIds: Array<string | number>,
): Promise<string[]> {
  const ids = masterTeacherIds
    .map((id) => {
      if (id === null || id === undefined) return null;
      const text = String(id).trim();
      return text.length ? text : null;
    })
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return [];
  }

  try {
    const handledColumns = await safeGetColumns(COORDINATOR_HANDLED_TABLE);
    const tableExists = handledColumns.size > 0 || await safeTableExists(COORDINATOR_HANDLED_TABLE);
    if (!tableExists || (handledColumns.size > 0 && !handledColumns.has("master_teacher_id"))) {
      return [];
    }

    const subjectColumns = await safeGetColumns(SUBJECT_TABLE);
    const subjectNameColumn = subjectColumns.has("subject_name")
      ? "subject_name"
      : subjectColumns.has("name")
        ? "name"
        : null;

    const selectParts = ["mch.subject_id AS subject_id"];
    if (subjectNameColumn) {
      selectParts.push(`s.${subjectNameColumn} AS subject_name`);
    }

    const joinClause = subjectNameColumn ? `LEFT JOIN ${SUBJECT_TABLE} s ON s.subject_id = mch.subject_id` : "";

    const [rows] = await query<RowDataPacket[]>(
      `SELECT ${selectParts.join(", ")}
       FROM ${COORDINATOR_HANDLED_TABLE} mch
       ${joinClause}
       WHERE mch.master_teacher_id IN (${ids.map(() => "?").join(", ")})`,
      ids,
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    const subjects: string[] = [];
    for (const row of rows) {
      if (row.subject_name != null) {
        const name = String(row.subject_name).trim();
        if (name.length && !subjects.includes(name)) {
          subjects.push(name);
        }
      } else if (row.subject_id != null) {
        const subjectId = `Subject ${row.subject_id}`;
        if (!subjects.includes(subjectId)) {
          subjects.push(subjectId);
        }
      }
    }

    return subjects;
  } catch {
    return [];
  }
}

export async function PUT(request: NextRequest) {
  const session = await getMasterTeacherSessionFromCookies().catch(() => null);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Master teacher session not found." },
      { status: 401 },
    );
  }

  const targetUser = resolveAuthorizedProfileUserId(
    request.nextUrl.searchParams.get("userId"),
    session.userId,
  );
  if (!targetUser.ok) {
    return targetUser.response;
  }

  let payload: Awaited<ReturnType<typeof parseProfileMutationRequest>>;
  try {
    payload = await parseProfileMutationRequest(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Invalid request body." },
      { status: 400 },
    );
  }

  let uploadedImageStoragePath: string | null = null;

  try {
    const userColumns = await ensureUserProfileImageColumn();
    const coordinatorColumns = await safeGetColumns(COORDINATOR_TABLE);
    const body = payload.body;
    const uploadedImage = payload.profileImage ? await uploadProfileImage(payload.profileImage) : null;
    uploadedImageStoragePath = uploadedImage?.storagePath ?? null;

    const result = await runWithConnection(async (connection) => {
      await connection.beginTransaction();

      try {
        const [currentRows] = await connection.execute<RowDataPacket[]>(
          "SELECT user_id, profile_image_url FROM users WHERE user_id = ? LIMIT 1",
          [targetUser.userId],
        );
        if (!currentRows.length) {
          await connection.rollback();
          return {
            notFound: true as const,
            previousProfileImageUrl: null,
            profileImageUrl: null,
          };
        }

        const previousProfileImageUrl = pickFirst(currentRows[0]?.profile_image_url);
        const updates: string[] = [];
        const params: Array<string | number | null> = [];

        if (body.firstName !== undefined && userColumns.has("first_name")) {
          updates.push("first_name = ?");
          params.push(typeof body.firstName === "string" ? body.firstName.trim() || null : null);
        }
        if (body.middleName !== undefined && userColumns.has("middle_name")) {
          updates.push("middle_name = ?");
          params.push(typeof body.middleName === "string" ? body.middleName.trim() || null : null);
        }
        if (body.lastName !== undefined && userColumns.has("last_name")) {
          updates.push("last_name = ?");
          params.push(typeof body.lastName === "string" ? body.lastName.trim() || null : null);
        }
        if (body.email !== undefined && userColumns.has("email")) {
          updates.push("email = ?");
          params.push(typeof body.email === "string" ? body.email.trim() || null : null);
        }
        if (body.contactNumber !== undefined && userColumns.has("contact_number")) {
          updates.push("contact_number = ?");
          params.push(typeof body.contactNumber === "string" ? body.contactNumber.trim() || null : null);
        }
        if (uploadedImage) {
          updates.push("profile_image_url = ?");
          params.push(uploadedImage.publicUrl);
        }

        if (updates.length > 0) {
          params.push(targetUser.userId);
          await connection.execute(`UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`, params);
        }

        if (body.subject !== undefined && coordinatorColumns.size > 0) {
          const subjectCol = coordinatorColumns.has("subject_handled")
            ? "subject_handled"
            : coordinatorColumns.has("coordinator_subject")
              ? "coordinator_subject"
              : null;
          if (subjectCol) {
            await connection.execute(
              `UPDATE \`${COORDINATOR_TABLE}\` SET ${subjectCol} = ? WHERE user_id = ?`,
              [typeof body.subject === "string" ? body.subject.trim() || null : null, targetUser.userId],
            );
          }
        }

        await connection.commit();
        return {
          notFound: false as const,
          previousProfileImageUrl,
          profileImageUrl: uploadedImage?.publicUrl ?? previousProfileImageUrl,
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });

    if (result.notFound) {
      if (uploadedImage) {
        await cleanupProfileImage(uploadedImage.storagePath);
      }
      return NextResponse.json({ success: false, error: "Master teacher profile not found." }, { status: 404 });
    }

    if (
      uploadedImage &&
      result.previousProfileImageUrl &&
      result.previousProfileImageUrl !== uploadedImage.publicUrl
    ) {
      await cleanupProfileImage(result.previousProfileImageUrl);
    }

    return NextResponse.json({
      success: true,
      profile: {
        profileImageUrl: result.profileImageUrl,
      },
    });
  } catch (error) {
    if (uploadedImageStoragePath) {
      await cleanupProfileImage(uploadedImageStoragePath);
    }
    console.error("Failed to update master teacher profile", error);
    if (error instanceof ProfileImageValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update profile." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await getMasterTeacherSessionFromCookies().catch(() => null);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Master teacher session not found." },
      { status: 401 },
    );
  }

  const targetUser = resolveAuthorizedProfileUserId(
    request.nextUrl.searchParams.get("userId"),
    session.userId,
  );
  if (!targetUser.ok) {
    return targetUser.response;
  }

  try {
    const userColumns = await ensureUserProfileImageColumn();
    const coordinatorColumns = await safeGetColumns(COORDINATOR_TABLE);
    const coordinatorTableExists = coordinatorColumns.size > 0 || await safeTableExists(COORDINATOR_TABLE);

    const userColumnsUnknown = userColumns.size === 0;
    const coordinatorColumnsUnknown = coordinatorTableExists && coordinatorColumns.size === 0;

    const selectParts: string[] = ["u.user_id AS user_id"];

    const addUserColumn = (column: string, alias: string) => {
      if (userColumnsUnknown || userColumns.has(column)) {
        selectParts.push(`u.${column} AS ${alias}`);
      }
    };

    const addCoordinatorColumn = (column: string, alias: string) => {
      if (!coordinatorTableExists) {
        return;
      }
      if (coordinatorColumnsUnknown || coordinatorColumns.has(column)) {
        selectParts.push(`mc.${column} AS ${alias}`);
      }
    };

    addUserColumn("master_teacher_id", "user_master_teacher_id");
    addUserColumn("profile_image_url", "user_profile_image_url");

    for (const { column, alias } of NAME_COLUMNS) {
      addUserColumn(column, alias);
    }
    for (const { column, alias } of CONTACT_COLUMNS) {
      addUserColumn(column, alias);
    }
    addUserColumn("role", "user_role");

    for (const candidate of COORDINATOR_SUBJECT_COLUMNS) {
      addCoordinatorColumn(candidate.column, candidate.alias);
    }

    let coordinatorJoin = "";
    if (coordinatorTableExists && (coordinatorColumnsUnknown || coordinatorColumns.size > 0)) {
      const conditions: string[] = [];
      if (coordinatorColumnsUnknown || coordinatorColumns.has("user_id")) {
        conditions.push("mc.user_id = u.user_id");
      }
      if (coordinatorColumnsUnknown || coordinatorColumns.has("master_teacher_id")) {
        conditions.push("mc.master_teacher_id = u.user_id");
      }
      if (coordinatorColumnsUnknown || coordinatorColumns.has("coordinator_id")) {
        conditions.push("mc.coordinator_id = u.user_id");
      }
      if ((coordinatorColumnsUnknown || coordinatorColumns.has("email")) && (userColumnsUnknown || userColumns.has("email"))) {
        conditions.push("mc.email = u.email");
      }
      coordinatorJoin = ` LEFT JOIN \`${COORDINATOR_TABLE}\` AS mc ON ${conditions.join(" OR ") || "FALSE"}`;
    }

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM users AS u
      ${coordinatorJoin}
      WHERE u.user_id = ?
      LIMIT 1
    `;

    const [rows] = await query<RawProfileRow[]>(sql, [targetUser.userId]);
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Profile was not found." },
        { status: 404 },
      );
    }

    const row = rows[0];

    const handledIds: Array<string | number> = [];
    if (row.user_master_teacher_id) handledIds.push(row.user_master_teacher_id);
    if (row.mt_master_teacher_id) handledIds.push(row.mt_master_teacher_id);
    if (row.mt_masterteacher_id) handledIds.push(row.mt_masterteacher_id);
    if (row.mt_teacher_id) handledIds.push(row.mt_teacher_id);
    if (row.rt_master_teacher_id) handledIds.push(row.rt_master_teacher_id);
    if (row.rt_remedial_teacher_id) handledIds.push(row.rt_remedial_teacher_id);
    if (Number.isFinite(row.user_id)) {
      handledIds.push(Number(row.user_id));
    }

    // Also resolve master_teacher.master_teacher_id linked to this user_id
    const masterTeacherIds = await resolveMasterTeacherIds(targetUser.userId);
    masterTeacherIds.forEach((id) => handledIds.push(id));

    const handled = await loadRemedialHandled(handledIds);
    const coordinatorHandledSubject = await loadCoordinatorHandledSubject(handledIds);
    const allCoordinatorSubjects = await loadAllCoordinatorSubjects(handledIds);
    const remedialSubjects = await loadRemedialSubjectsFromAssignments(handledIds);

    const firstName = pickFirst(row.user_first_name);
    const middleName = pickFirst(row.user_middle_name);
    const lastName = pickFirst(row.user_last_name);
    const suffix = pickFirst(row.user_suffix);
    const displayName = pickFirst(row.user_display_name, buildName(firstName, middleName, lastName, suffix));

    const email = pickFirst(row.user_email);
    const contactNumber = pickFirst(row.user_contact_number, row.user_phone_number);

    const grade = pickFirst(handled.gradeLevel);

    const room = null;

    const subjectHandled =
      allCoordinatorSubjects.length > 0
        ? allCoordinatorSubjects.join(", ")
        : pickFirst(
            coordinatorHandledSubject,
            row.mc_subject_handled,
            row.mc_coordinator_subject,
            row.mc_coordinator_subject_handled,
            row.mc_subject,
            row.mc_subjects,
            row.mc_handled_subjects,
          );

    return NextResponse.json({
      success: true,
      profile: {
        userId: row.user_id,
        firstName,
        middleName,
        lastName,
        suffix,
        displayName,
        email,
        contactNumber,
        grade,
        gradeLabel: grade,
        room,
        subjectHandled,
        remedialSubjects: remedialSubjects.length > 0 ? remedialSubjects.join(", ") : null,
        role: pickFirst(row.user_role),
        profileImageUrl: pickFirst(row.user_profile_image_url),
      },
    });
  } catch (error) {
    console.error("Failed to load master teacher profile", error);
    return NextResponse.json(
      { success: false, error: "Failed to load master teacher profile." },
      { status: 500 },
    );
  }
}
