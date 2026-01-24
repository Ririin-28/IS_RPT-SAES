import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import {
  getMasterTeacherSessionFromCookies,
  updateMasterTeacherSessionRole,
  type MasterTeacherRoleContext,
} from "@/lib/server/master-teacher-session";

const COORDINATOR_HANDLED_TABLE = "mt_coordinator_handled" as const;
const REMEDIAL_HANDLED_TABLE = "mt_remedialteacher_handled" as const;

const resolveCoordinatorRoleId = async (masterTeacherId: string): Promise<string | null> => {
  const columns = await getTableColumns(COORDINATOR_HANDLED_TABLE).catch(() => new Set<string>());
  if (!columns.size || !columns.has("coordinator_role_id") || !columns.has("master_teacher_id")) {
    return null;
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT coordinator_role_id FROM ${COORDINATOR_HANDLED_TABLE}
     WHERE master_teacher_id = ? AND coordinator_role_id IS NOT NULL
     LIMIT 1`,
    [masterTeacherId],
  );

  const value = rows[0]?.coordinator_role_id;
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const resolveRemedialRoleId = async (masterTeacherId: string): Promise<string | null> => {
  const columns = await getTableColumns(REMEDIAL_HANDLED_TABLE).catch(() => new Set<string>());
  if (!columns.size || !columns.has("remedial_role_id") || !columns.has("master_teacher_id")) {
    return null;
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT remedial_role_id FROM ${REMEDIAL_HANDLED_TABLE}
     WHERE master_teacher_id = ? AND remedial_role_id IS NOT NULL
     LIMIT 1`,
    [masterTeacherId],
  );

  const value = rows[0]?.remedial_role_id;
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

export async function POST(request: NextRequest) {
  const session = await getMasterTeacherSessionFromCookies();
  if (!session) {
    return NextResponse.json({ success: false, error: "Master teacher session not found." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { roleContext?: string | null } | null;
  const roleContext = (payload?.roleContext ?? null) as MasterTeacherRoleContext;

  if (roleContext !== "coordinator" && roleContext !== "remedial") {
    return NextResponse.json({ success: false, error: "Invalid role context." }, { status: 400 });
  }

  const [coordinatorRoleId, remedialRoleId] = await Promise.all([
    resolveCoordinatorRoleId(session.masterTeacherId),
    resolveRemedialRoleId(session.masterTeacherId),
  ]);

  await updateMasterTeacherSessionRole(
    session.sessionId,
    roleContext,
    coordinatorRoleId ?? session.coordinatorRoleId,
    remedialRoleId ?? session.remedialRoleId,
  );

  return NextResponse.json({
    success: true,
    roleContext,
    coordinatorRoleId: coordinatorRoleId ?? session.coordinatorRoleId,
    remedialRoleId: remedialRoleId ?? session.remedialRoleId,
  });
}
