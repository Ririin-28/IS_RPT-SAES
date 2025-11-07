import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const REMEDIAL_TABLE = "remedial_teachers" as const;
const COORDINATOR_TABLE = "mt_coordinator" as const;

const REMEDIAL_GRADE_COLUMNS = [
  { column: "grade", alias: "rt_grade" },
  { column: "grade_level", alias: "rt_grade_level" },
  { column: "handled_grade", alias: "rt_handled_grade" },
  { column: "gradelevel", alias: "rt_gradelevel" },
  { column: "gradeLevel", alias: "rt_gradeLevel" },
] as const;

const REMEDIAL_ROOM_COLUMNS = [
  { column: "room", alias: "rt_room" },
  { column: "room_number", alias: "rt_room_number" },
  { column: "homeroom", alias: "rt_homeroom" },
  { column: "classroom", alias: "rt_classroom" },
  { column: "room_assigned", alias: "rt_room_assigned" },
] as const;

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

type RawProfileRow = RowDataPacket & {
  user_id: number;
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

export async function PUT(request: NextRequest) {
  const url = new URL(request.url);
  const userIdParam = url.searchParams.get("userId");

  if (!userIdParam) {
    return NextResponse.json(
      { success: false, error: "Missing userId query parameter." },
      { status: 400 },
    );
  }

  const userId = Number(userIdParam);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid userId value." }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  try {
    const userColumns = await safeGetColumns("users");
    const remedialColumns = await safeGetColumns(REMEDIAL_TABLE);
    const coordinatorColumns = await safeGetColumns(COORDINATOR_TABLE);

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

    if (updates.length > 0) {
      params.push(userId);
      await query(`UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`, params);
    }

    if (body.grade !== undefined && remedialColumns.size > 0) {
      const gradeCol = remedialColumns.has("grade") ? "grade" : remedialColumns.has("grade_level") ? "grade_level" : null;
      if (gradeCol) {
        await query(`UPDATE \`${REMEDIAL_TABLE}\` SET ${gradeCol} = ? WHERE user_id = ?`, [body.grade?.trim() || null, userId]);
      }
    }

    if (body.room !== undefined && remedialColumns.size > 0) {
      const roomCol = remedialColumns.has("room") ? "room" : remedialColumns.has("room_number") ? "room_number" : null;
      if (roomCol) {
        await query(`UPDATE \`${REMEDIAL_TABLE}\` SET ${roomCol} = ? WHERE user_id = ?`, [body.room?.trim() || null, userId]);
      }
    }

    if (body.subject !== undefined && coordinatorColumns.size > 0) {
      const subjectCol = coordinatorColumns.has("subject_handled") ? "subject_handled" : coordinatorColumns.has("coordinator_subject") ? "coordinator_subject" : null;
      if (subjectCol) {
        await query(`UPDATE \`${COORDINATOR_TABLE}\` SET ${subjectCol} = ? WHERE user_id = ?`, [body.subject?.trim() || null, userId]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update master teacher profile", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userIdParam = url.searchParams.get("userId");

  if (!userIdParam) {
    return NextResponse.json(
      { success: false, error: "Missing userId query parameter." },
      { status: 400 },
    );
  }

  const userId = Number(userIdParam);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid userId value." }, { status: 400 });
  }

  try {
    const userColumns = await safeGetColumns("users");
    if (userColumns.size === 0) {
      return NextResponse.json(
        { success: false, error: "Users table is not accessible." },
        { status: 500 },
      );
    }

    const remedialColumns = await safeGetColumns(REMEDIAL_TABLE);
    const coordinatorColumns = await safeGetColumns(COORDINATOR_TABLE);

    const selectParts: string[] = ["u.user_id AS user_id"];

    const addUserColumn = (column: string, alias: string) => {
      if (userColumns.has(column)) {
        selectParts.push(`u.${column} AS ${alias}`);
      }
    };

    const addRemedialColumn = (column: string, alias: string) => {
      if (remedialColumns.has(column)) {
        selectParts.push(`rt.${column} AS ${alias}`);
      }
    };

    const addCoordinatorColumn = (column: string, alias: string) => {
      if (coordinatorColumns.has(column)) {
        selectParts.push(`mc.${column} AS ${alias}`);
      }
    };

    for (const { column, alias } of NAME_COLUMNS) {
      addUserColumn(column, alias);
    }
    for (const { column, alias } of CONTACT_COLUMNS) {
      addUserColumn(column, alias);
    }
    addUserColumn("role", "user_role");

    for (const candidate of REMEDIAL_GRADE_COLUMNS) {
      addRemedialColumn(candidate.column, candidate.alias);
    }
    for (const candidate of REMEDIAL_ROOM_COLUMNS) {
      addRemedialColumn(candidate.column, candidate.alias);
    }
    for (const candidate of COORDINATOR_SUBJECT_COLUMNS) {
      addCoordinatorColumn(candidate.column, candidate.alias);
    }

    let remedialJoin = "";
    if (remedialColumns.size > 0) {
      const conditions: string[] = [];
      if (remedialColumns.has("user_id")) {
        conditions.push("rt.user_id = u.user_id");
      }
      if (remedialColumns.has("teacher_id")) {
        conditions.push("rt.teacher_id = u.user_id");
      }
      if (remedialColumns.has("master_teacher_id")) {
        conditions.push("rt.master_teacher_id = u.user_id");
      }
      if (remedialColumns.has("remedial_teacher_id")) {
        conditions.push("rt.remedial_teacher_id = u.user_id");
      }
      if (remedialColumns.has("email") && userColumns.has("email")) {
        conditions.push("rt.email = u.email");
      }
      remedialJoin = ` LEFT JOIN \`${REMEDIAL_TABLE}\` AS rt ON ${conditions.join(" OR ") || "FALSE"}`;
    }

    let coordinatorJoin = "";
    if (coordinatorColumns.size > 0) {
      const conditions: string[] = [];
      if (coordinatorColumns.has("user_id")) {
        conditions.push("mc.user_id = u.user_id");
      }
      if (coordinatorColumns.has("master_teacher_id")) {
        conditions.push("mc.master_teacher_id = u.user_id");
      }
      if (coordinatorColumns.has("coordinator_id")) {
        conditions.push("mc.coordinator_id = u.user_id");
      }
      if (coordinatorColumns.has("email") && userColumns.has("email")) {
        conditions.push("mc.email = u.email");
      }
      coordinatorJoin = ` LEFT JOIN \`${COORDINATOR_TABLE}\` AS mc ON ${conditions.join(" OR ") || "FALSE"}`;
    }

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM users AS u
      ${remedialJoin}
      ${coordinatorJoin}
      WHERE u.user_id = ?
      LIMIT 1
    `;

    const [rows] = await query<RawProfileRow[]>(sql, [userId]);
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Profile was not found." },
        { status: 404 },
      );
    }

    const row = rows[0];

    const firstName = pickFirst(row.user_first_name);
    const middleName = pickFirst(row.user_middle_name);
    const lastName = pickFirst(row.user_last_name);
    const suffix = pickFirst(row.user_suffix);
    const displayName = pickFirst(row.user_display_name, buildName(firstName, middleName, lastName, suffix));

    const email = pickFirst(row.user_email);
    const contactNumber = pickFirst(row.user_contact_number, row.user_phone_number);

    const grade = pickFirst(
      row.rt_grade,
      row.rt_grade_level,
      row.rt_handled_grade,
      row.rt_gradeLevel,
      row.rt_gradelevel,
    );

    const room = pickFirst(
      row.rt_room,
      row.rt_room_number,
      row.rt_homeroom,
      row.rt_classroom,
      row.rt_room_assigned,
    );

    const subjectHandled = pickFirst(
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
        room,
        subjectHandled,
        role: pickFirst(row.user_role),
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
