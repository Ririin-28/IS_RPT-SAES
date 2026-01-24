import type { Connection, PoolConnection, RowDataPacket } from "mysql2/promise";

export type UserRoleSource = {
  role?: string | null;
  role_name?: string | null;
  roleName?: string | null;
  role_id?: number | null;
  roleId?: number | null;
  user_code?: string | null;
  userCode?: string | null;
  master_teacher_id?: string | null;
  masterTeacherId?: string | null;
  teacher_id?: string | null;
  teacherId?: string | null;
  principal_id?: string | null;
  principalId?: string | null;
};

const ROLE_PREFIX_RULES: Array<{ prefix: string; role: string }> = [
  { prefix: "MT-", role: "master_teacher" },
  { prefix: "TE-", role: "teacher" },
  { prefix: "PR-", role: "principal" },
  { prefix: "PA-", role: "parent" },
  { prefix: "PT-", role: "parent" },
  { prefix: "ST-", role: "student" },
];

const PORTAL_PATH_BY_ROLE: Record<string, string> = {
  admin: "/IT_Admin/welcome",
  it_admin: "/IT_Admin/welcome",
  itadmin: "/IT_Admin/welcome",
  principal: "/Principal/welcome",
  parent: "/Parent/welcome",
  teacher: "/Teacher/welcome",
  master_teacher: "/MasterTeacher/welcome",
  masterteacher: "/MasterTeacher/welcome",
};

const ROLE_ALIASES: Record<string, string> = {
  coordinator: "master_teacher",
  mt_coordinator: "master_teacher",
  master_teacher_coordinator: "master_teacher",
  masterteacher_coordinator: "master_teacher",
};

let roleTableAvailable: boolean | null = null;

export function normalizeRoleName(role: string | null | undefined): string {
  if (!role) {
    return "";
  }
  return role.trim().toLowerCase().replace(/[\s/\-]+/g, "_");
}

export function resolveCanonicalRole(normalizedRole: string): string {
  if (!normalizedRole) {
    return "";
  }
  return ROLE_ALIASES[normalizedRole] ?? normalizedRole;
}

function pickStringRoleCandidate(source: UserRoleSource): string | null {
  const candidates = [
    source.role,
    source.role_name,
    source.roleName,
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

function pickRoleFromIdentifiers(source: UserRoleSource): string | null {
  const identifierCandidates = [
    source.user_code,
    source.userCode,
    source.master_teacher_id,
    source.masterTeacherId,
    source.teacher_id,
    source.teacherId,
    source.principal_id,
    source.principalId,
  ];

  for (const candidate of identifierCandidates) {
    if (!candidate) {
      continue;
    }
    const upper = candidate.trim().toUpperCase();
    if (!upper) {
      continue;
    }
    for (const rule of ROLE_PREFIX_RULES) {
      if (upper.startsWith(rule.prefix)) {
        return rule.role;
      }
    }
  }

  return null;
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === "ER_NO_SUCH_TABLE" || code === "42S02";
}

async function lookupRoleNameById(
  db: Connection | PoolConnection,
  roleId: number | null | undefined,
): Promise<string | null> {
  if (roleId == null || Number.isNaN(roleId)) {
    return null;
  }
  if (roleTableAvailable === false) {
    return null;
  }
  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT role_name FROM role WHERE role_id = ? LIMIT 1",
      [roleId],
    );
    roleTableAvailable = true;
    const value = rows[0]?.role_name;
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  } catch (error) {
    if (isMissingTableError(error)) {
      roleTableAvailable = false;
      return null;
    }
    throw error;
  }
}

export async function resolveUserRole(
  db: Connection | PoolConnection,
  source: UserRoleSource & { role_id?: number | null; roleId?: number | null },
): Promise<string | null> {
  const direct = pickStringRoleCandidate(source);
  if (direct) {
    return direct;
  }

  const roleFromIds = pickRoleFromIdentifiers(source);
  if (roleFromIds) {
    return roleFromIds;
  }

  const fallback = await lookupRoleNameById(db, source.role_id ?? source.roleId ?? null);
  if (fallback) {
    return fallback;
  }

  return null;
}

export function resolvePortalPath(normalizedRole: string): string {
  if (!normalizedRole) {
    return "/";
  }
  const canonical = resolveCanonicalRole(normalizedRole);
  return PORTAL_PATH_BY_ROLE[canonical] ?? "/";
}
