import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query, getTableColumns } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";

export const dynamic = "force-dynamic";

const LEGACY_ARCHIVE_TABLE = "archive_users";
const NEW_ARCHIVE_TABLE = "archived_users";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Super Admin",
  it_admin: "Super Admin",
  principal: "Principal",
  master_teacher: "Master Teacher",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

const SUPER_ADMIN_ROLE_FILTERS = [
  "admin",
  "it_admin",
  "it-admin",
  "it admin",
  "super_admin",
  "super-admin",
  "super admin",
  "superadmin",
] as const;

type ArchiveRow = RowDataPacket & {
  archive_id: number;
  user_id: number | null;
  role: string | null;
  role_id?: number | null;
  name: string | null;
  reason: string | null;
  timestamp: Date | null;
  user_email?: string | null;
  username?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix?: string | null;
  phone_number?: string | null;
  user_code?: string | null;
};

type ArchiveRecord = Record<string, any> & {
  archiveId?: number;
  role?: string | null;
};

function normalizeRoleValue(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const lowered = trimmed.toLowerCase();
  if (
    lowered === "it admin" ||
    lowered === "it-admin" ||
    lowered === "it_admin" ||
    lowered === "admin" ||
    lowered === "super admin" ||
    lowered === "super-admin" ||
    lowered === "super_admin" ||
    lowered === "superadmin"
  ) {
    return "super_admin";
  }
  return lowered.replace(/[\s/-]+/g, "_");
}

function resolveRoleFilterValues(role: string): string[] {
  if (role === "super_admin") {
    return Array.from(new Set(SUPER_ADMIN_ROLE_FILTERS.map((item) => item.toLowerCase())));
  }
  return [role];
}

function normalizeName(row: ArchiveRow): string | null {
  const direct = row.name ?? null;
  if (direct && direct.trim().length > 0) {
    return direct;
  }

  const first = row.first_name ?? "";
  const last = row.last_name ?? "";
  const combined = `${first} ${last}`.trim();
  if (combined.length > 0) {
    return combined;
  }

  const username = row.username ?? null;
  return username && username.trim().length > 0 ? username : null;
}

async function safeGetColumns(tableName: string): Promise<Set<string>> {
  try {
    return await getTableColumns(tableName);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ECONNRESET") {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return await getTableColumns(tableName);
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:data.archive" });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const legacyArchiveColumns = await safeGetColumns(LEGACY_ARCHIVE_TABLE).catch(() => new Set<string>());
    const newArchiveColumns = await safeGetColumns(NEW_ARCHIVE_TABLE).catch(() => new Set<string>());
    const usersColumns = await safeGetColumns("users").catch(() => new Set<string>());
    const roleColumns = await safeGetColumns("role").catch(() => new Set<string>());
    const roleNameById = new Map<number, string>();
    if (roleColumns.has("role_id") && roleColumns.has("role_name")) {
      try {
        const [rows] = await query<RowDataPacket[]>("SELECT role_id, role_name FROM role");
        for (const row of rows) {
          const id = Number(row.role_id);
          const name = typeof row.role_name === "string" ? row.role_name : null;
          if (Number.isInteger(id) && name) {
            roleNameById.set(id, name);
          }
        }
      } catch {
        // ignore role mapping failures
      }
    }

    const legacyArchiveExists = legacyArchiveColumns.size > 0;
    const newArchiveExists = newArchiveColumns.size > 0;

    if (!legacyArchiveExists && !newArchiveExists) {
      return NextResponse.json({
        total: 0,
        records: [],
        metadata: { missingTables: [LEGACY_ARCHIVE_TABLE, NEW_ARCHIVE_TABLE] },
      });
    }

    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get("role");

    // const filters: string[] = [];

    const normalizedRole = roleParam ? normalizeRoleValue(roleParam) ?? roleParam.toLowerCase() : null;

    const legacyRecords: Array<Record<string, any>> = [];
    const missingFields: string[] = [];

    if (legacyArchiveExists && legacyArchiveColumns.size > 0) {
      const legacyFilters: string[] = [];
      const legacyParams: Array<string | number> = [];

      if (normalizedRole && normalizedRole !== "all") {
        const roleValues = resolveRoleFilterValues(normalizedRole);
        if (roleValues.length > 1) {
          const placeholders = roleValues.map(() => "?").join(", ");
          legacyFilters.push(`LOWER(au.role) IN (${placeholders})`);
          legacyParams.push(...roleValues);
        } else {
          legacyFilters.push("LOWER(au.role) = ?");
          legacyParams.push(roleValues[0]);
        }
      }

      const legacyWhereClause = legacyFilters.length > 0 ? `WHERE ${legacyFilters.join(" AND ")}` : "";

      const legacySelected: string[] = [];

      const pickArchive = (column: string, alias?: string) => {
        if (legacyArchiveColumns.has(column)) {
          legacySelected.push(alias ? `au.${column} AS ${alias}` : `au.${column}`);
        } else {
          missingFields.push(`${LEGACY_ARCHIVE_TABLE}.${column}`);
        }
      };

      const pickUser = (column: string, alias?: string) => {
        if (usersColumns.has(column)) {
          legacySelected.push(alias ? `u.${column} AS ${alias}` : `u.${column}`);
        } else {
          missingFields.push(`users.${column}`);
        }
      };

      pickArchive("archive_id");
      pickArchive("user_id");
      pickArchive("role");
      pickArchive("name");
      pickArchive("reason");
      pickArchive("timestamp");

      pickUser("email", "user_email");
      pickUser("username");
      pickUser("first_name");
      pickUser("last_name");

      if (legacySelected.length > 0) {
        const [rows] = await query<ArchiveRow[]>(
          `SELECT
            ${legacySelected.join(",\n            ")}
          FROM ${LEGACY_ARCHIVE_TABLE} au
          LEFT JOIN users u ON u.user_id = au.user_id
          ${legacyWhereClause}
          ORDER BY ${legacyArchiveColumns.has("timestamp") ? "au.timestamp" : "au.archive_id"} DESC`,
          legacyParams,
        );

        legacyRecords.push(
          ...rows.map((row) => {
            const normalizedRole = normalizeRoleValue(row.role ?? undefined);
            return {
              archiveId: row.archive_id,
              userId: row.user_id,
              role: normalizedRole,
              roleLabel: normalizedRole ? ROLE_LABELS[normalizedRole] ?? normalizedRole : "Unknown",
              name: normalizeName(row),
              email: row.user_email ?? undefined,
              reason: row.reason ?? undefined,
              archivedDate: row.timestamp ? row.timestamp.toISOString() : null,
            };
          }),
        );
      }
    }

    const newRecords: Array<Record<string, any>> = [];
    if (newArchiveExists && newArchiveColumns.size > 0) {
      const selected: string[] = [];
      let joinRole = false;
      let roleField = "";

      const pickArchived = (column: string, alias?: string) => {
        if (newArchiveColumns.has(column)) {
          selected.push(alias ? `au.${column} AS ${alias}` : `au.${column}`);
        } else {
          missingFields.push(`${NEW_ARCHIVE_TABLE}.${column}`);
        }
      };

      if (newArchiveColumns.has("archived_id")) {
        selected.push("au.archived_id AS archive_id");
      }
      pickArchived("user_id");
      if (newArchiveColumns.has("role")) {
        selected.push("au.role AS role");
        roleField = "au.role";
      } else if (newArchiveColumns.has("role_id") && roleColumns.has("role_name")) {
        selected.push("r.role_name AS role");
        roleField = "r.role_name";
        joinRole = true;
      }
      if (newArchiveColumns.has("role_id")) {
        selected.push("au.role_id AS role_id");
      }
      if (newArchiveColumns.has("name")) {
        selected.push("au.name AS name");
      }
      if (newArchiveColumns.has("reason")) {
        selected.push("au.reason AS reason");
      }
      if (newArchiveColumns.has("archived_at")) {
        selected.push("au.archived_at AS timestamp");
      } else if (newArchiveColumns.has("timestamp")) {
        selected.push("au.timestamp AS timestamp");
      } else if (newArchiveColumns.has("created_at")) {
        selected.push("au.created_at AS timestamp");
      }

      if (newArchiveColumns.has("email")) {
        selected.push("au.email AS user_email");
      }
      if (newArchiveColumns.has("user_code")) {
        selected.push("au.user_code AS user_code");
      }
      if (newArchiveColumns.has("username")) {
        selected.push("au.username AS username");
      }
      if (newArchiveColumns.has("first_name")) {
        selected.push("au.first_name AS first_name");
      }
      if (newArchiveColumns.has("middle_name")) {
        selected.push("au.middle_name AS middle_name");
      }
      if (newArchiveColumns.has("last_name")) {
        selected.push("au.last_name AS last_name");
      }
      if (newArchiveColumns.has("suffix")) {
        selected.push("au.suffix AS suffix");
      }
      if (newArchiveColumns.has("phone_number")) {
        selected.push("au.phone_number AS phone_number");
      }

      if (selected.length > 0) {
        const filters: string[] = [];
        const params: Array<string | number> = [];
        if (normalizedRole && normalizedRole !== "all" && roleField) {
          const roleValues = resolveRoleFilterValues(normalizedRole);
          if (roleValues.length > 1) {
            const placeholders = roleValues.map(() => "?").join(", ");
            filters.push(`LOWER(${roleField}) IN (${placeholders})`);
            params.push(...roleValues);
          } else {
            filters.push(`LOWER(${roleField}) = ?`);
            params.push(roleValues[0]);
          }
        }
        const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

        const [rows] = await query<ArchiveRow[]>(
          `SELECT
            ${selected.join(",\n            ")}
          FROM ${NEW_ARCHIVE_TABLE} au
          ${joinRole ? "LEFT JOIN role r ON r.role_id = au.role_id" : ""}
          ${whereClause}
          ORDER BY ${newArchiveColumns.has("archived_at") ? "au.archived_at" : newArchiveColumns.has("timestamp") ? "au.timestamp" : "au.archived_id"} DESC`,
          params,
        );

        newRecords.push(
          ...rows.map((row) => {
            const normalizedRole = normalizeRoleValue(row.role ?? undefined);
            return {
              archiveId: row.archive_id,
              userId: row.user_id,
              adminId: row.user_code ?? undefined,
              userCode: row.user_code ?? undefined,
              roleId: typeof row.role_id === "number" ? row.role_id : undefined,
              role: normalizedRole,
              roleLabel: normalizedRole ? ROLE_LABELS[normalizedRole] ?? normalizedRole : "Unknown",
              name: normalizeName(row),
              email: row.user_email ?? undefined,
              username: row.username ?? undefined,
              first_name: row.first_name ?? undefined,
              middle_name: row.middle_name ?? undefined,
              last_name: row.last_name ?? undefined,
              suffix: row.suffix ?? undefined,
              phone_number: row.phone_number ?? undefined,
              reason: row.reason ?? undefined,
              archivedDate: row.timestamp ? row.timestamp.toISOString() : null,
            };
          }),
        );
      }
    }

    const combined = [...legacyRecords, ...newRecords];

    const filteredCombined = normalizedRole && normalizedRole !== "all"
      ? combined.filter((row) => normalizeRoleValue(typeof row.role === "string" ? row.role : null) === normalizedRole)
      : combined;

    if (roleNameById.size > 0) {
      for (const record of filteredCombined as ArchiveRecord[]) {
        const roleId = Number(record.roleId ?? record.role_id);
        if (Number.isInteger(roleId) && roleNameById.has(roleId)) {
          const roleName = roleNameById.get(roleId);
          const normalized = normalizeRoleValue(roleName);
          record.roleLabel = normalized ? ROLE_LABELS[normalized] ?? roleName : roleName;
        }
      }
    }

    const masterTeacherIds = filteredCombined
      .filter((row) => typeof row.role === "string" && row.role.toLowerCase() === "master_teacher")
      .map((row) => Number(row.archiveId))
      .filter((value) => Number.isInteger(value) && value > 0);

    const teacherArchiveIds = filteredCombined
      .filter((row) => typeof row.role === "string" && row.role.toLowerCase() === "teacher")
      .map((row) => Number(row.archiveId))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (masterTeacherIds.length > 0) {
      const coordinatorColumns = await safeGetColumns("archived_mt_coordinator_handled").catch(() => new Set<string>());
      const remedialColumns = await safeGetColumns("archived_mt_remedialteacher_handled").catch(() => new Set<string>());

      if (coordinatorColumns.size > 0 || remedialColumns.size > 0) {
        const placeholders = masterTeacherIds.map(() => "?").join(", ");
        const coordinatorMap = new Map<number, { grades: Set<string>; subjects: Set<string>; masterTeacherId?: string }>();
        const remedialMap = new Map<number, { grades: Set<string>; masterTeacherId?: string }>();

        if (coordinatorColumns.size > 0) {
          const [rows] = await query<RowDataPacket[]>(
            `SELECT archived_id, master_teacher_id, grade_id, subject_id FROM archived_mt_coordinator_handled WHERE archived_id IN (${placeholders})`,
            masterTeacherIds,
          );

          const subjectIds = Array.from(
            new Set(
              rows
                .map((row) => Number(row.subject_id))
                .filter((value) => Number.isInteger(value) && value > 0),
            ),
          );

          const subjectNameById = new Map<number, string>();
          if (subjectIds.length > 0) {
            try {
              const subjectColumns = await safeGetColumns("subject");
              if (subjectColumns.has("subject_id") && subjectColumns.has("subject_name")) {
                const subjectPlaceholders = subjectIds.map(() => "?").join(", ");
                const [subjectRows] = await query<RowDataPacket[]>(
                  `SELECT subject_id, subject_name FROM subject WHERE subject_id IN (${subjectPlaceholders})`,
                  subjectIds,
                );
                for (const row of subjectRows) {
                  const id = Number(row.subject_id);
                  const name = typeof row.subject_name === "string" ? row.subject_name : null;
                  if (Number.isInteger(id) && name) {
                    subjectNameById.set(id, name);
                  }
                }
              }
            } catch {
              // ignore subject mapping failures
            }
          }

          for (const row of rows) {
            const archiveId = Number(row.archived_id);
            if (!Number.isInteger(archiveId) || archiveId <= 0) {
              continue;
            }
            const entry = coordinatorMap.get(archiveId) ?? { grades: new Set<string>(), subjects: new Set<string>() };
            if (row.master_teacher_id != null && entry.masterTeacherId == null) {
              entry.masterTeacherId = String(row.master_teacher_id);
            }
            if (row.grade_id != null) {
              entry.grades.add(String(row.grade_id));
            }
            if (row.subject_id != null) {
              const subjectId = Number(row.subject_id);
              const subjectName = Number.isInteger(subjectId) ? subjectNameById.get(subjectId) : null;
              entry.subjects.add(subjectName ?? String(row.subject_id));
            }
            coordinatorMap.set(archiveId, entry);
          }
        }

        if (remedialColumns.size > 0) {
          const [rows] = await query<RowDataPacket[]>(
            `SELECT archived_id, master_teacher_id, grade_id FROM archived_mt_remedialteacher_handled WHERE archived_id IN (${placeholders})`,
            masterTeacherIds,
          );
          for (const row of rows) {
            const archiveId = Number(row.archived_id);
            if (!Number.isInteger(archiveId) || archiveId <= 0) {
              continue;
            }
            const entry = remedialMap.get(archiveId) ?? { grades: new Set<string>() };
            if (row.master_teacher_id != null && entry.masterTeacherId == null) {
              entry.masterTeacherId = String(row.master_teacher_id);
            }
            if (row.grade_id != null) {
              entry.grades.add(String(row.grade_id));
            }
            remedialMap.set(archiveId, entry);
          }
        }

        for (const record of filteredCombined as ArchiveRecord[]) {
          const archiveId = Number(record.archiveId);
          if (!Number.isInteger(archiveId) || archiveId <= 0) {
            continue;
          }
          if (String(record.role ?? "").toLowerCase() !== "master_teacher") {
            continue;
          }

          const coordinator = coordinatorMap.get(archiveId);
          const remedial = remedialMap.get(archiveId);
          const resolvedId =
            record.masterTeacherId ??
            record.master_teacher_id ??
            record.userCode ??
            record.adminId ??
            coordinator?.masterTeacherId ??
            remedial?.masterTeacherId;

          if (resolvedId) {
            record.masterTeacherId = resolvedId;
          }

          if (coordinator) {
            record.coordinatorHandledGrades = Array.from(coordinator.grades);
            record.coordinatorHandledSubjects = Array.from(coordinator.subjects);
          }
          if (remedial) {
            record.remedialHandledSubjects = Array.from(remedial.grades);
          }
        }
      }
    }

    if (teacherArchiveIds.length > 0) {
      const archivedTeacherHandledColumns = await safeGetColumns("archived_teacher_handled").catch(() => new Set<string>());
      if (archivedTeacherHandledColumns.size > 0) {
        const placeholders = teacherArchiveIds.map(() => "?").join(", ");
        const handledMap = new Map<number, { grades: Set<string>; teacherId?: string }>();

        const [rows] = await query<RowDataPacket[]>(
          `SELECT archived_id, teacher_id, grade_id FROM archived_teacher_handled WHERE archived_id IN (${placeholders})`,
          teacherArchiveIds,
        );

        for (const row of rows) {
          const archiveId = Number(row.archived_id);
          if (!Number.isInteger(archiveId) || archiveId <= 0) {
            continue;
          }
          const entry = handledMap.get(archiveId) ?? { grades: new Set<string>() };
          if (row.teacher_id != null && entry.teacherId == null) {
            entry.teacherId = String(row.teacher_id);
          }
          if (row.grade_id != null) {
            entry.grades.add(String(row.grade_id));
          }
          handledMap.set(archiveId, entry);
        }

        for (const record of filteredCombined as ArchiveRecord[]) {
          const archiveId = Number(record.archiveId);
          if (!Number.isInteger(archiveId) || archiveId <= 0) {
            continue;
          }
          if (String(record.role ?? "").toLowerCase() !== "teacher") {
            continue;
          }

          const handled = handledMap.get(archiveId);
          const resolvedId =
            record.teacherId ??
            record.teacher_id ??
            record.userCode ??
            record.user_code ??
            record.userId ??
            handled?.teacherId;

          if (resolvedId) {
            record.teacherId = resolvedId;
          }
          if (handled) {
            record.handledGrades = Array.from(handled.grades);
          }
        }
      }
    }

    filteredCombined.sort((a, b) => {
      const aTime = a.archivedDate ? new Date(a.archivedDate).getTime() : 0;
      const bTime = b.archivedDate ? new Date(b.archivedDate).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json({
      total: filteredCombined.length,
      records: filteredCombined,
      ...(missingFields.length > 0 ? { metadata: { missingColumns: missingFields } } : {}),
    });
  } catch (error) {
    console.error("Failed to fetch archived users", error);
    return NextResponse.json(
      { error: "Failed to fetch archived users." },
      { status: 500 }
    );
  }
}
