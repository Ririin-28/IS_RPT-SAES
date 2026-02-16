import { type RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { normalizeRoleName, resolveCanonicalRole, resolvePortalPath, resolveUserRole } from "@/lib/server/role-resolution";
import { ensureSuperAdminPhaseOneMigration } from "@/lib/server/super-admin-migration";

interface CheckCredentialsPayload {
  email: string;
  password: string;
  userId?: string | number | null;
  itAdminId?: string | null;
}

interface UserRow extends RowDataPacket {
  user_id: number;
  email: string;
  password: string;
  role: string | null;
}

const ADMIN_ROLES = new Set(["admin", "it_admin", "itadmin", "super_admin"]);

function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_TABLE_ERROR" || code === "42S02";
}

async function resolveSuperAdminLinkedUserId(
  db: import("mysql2/promise").PoolConnection,
  superAdminId: string,
): Promise<number | null> {
  try {
    const [superAdmins] = await db.execute<RowDataPacket[]>(
      "SELECT user_id FROM super_admin WHERE it_admin_id = ? LIMIT 1",
      [superAdminId],
    );
    const linkedUserId = Number(superAdmins[0]?.user_id);
    if (Number.isFinite(linkedUserId) && linkedUserId > 0) {
      return linkedUserId;
    }
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ER_BAD_FIELD_ERROR") {
      const [superAdmins] = await db.execute<RowDataPacket[]>(
        "SELECT user_id FROM super_admin WHERE super_admin_id = ? LIMIT 1",
        [superAdminId],
      );
      const linkedUserId = Number(superAdmins[0]?.user_id);
      if (Number.isFinite(linkedUserId) && linkedUserId > 0) {
        return linkedUserId;
      }
    } else if (!isMissingTableError(error)) {
      throw error;
    }
  }

  try {
    const [itAdmins] = await db.execute<RowDataPacket[]>(
      "SELECT user_id FROM it_admin WHERE it_admin_id = ? LIMIT 1",
      [superAdminId],
    );
    const linkedUserId = Number(itAdmins[0]?.user_id);
    if (Number.isFinite(linkedUserId) && linkedUserId > 0) {
      return linkedUserId;
    }
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
  }

  return null;
}

function requiresItAdminId(normalizedRole: string): boolean {
  return ADMIN_ROLES.has(normalizedRole);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeItAdminId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(req: Request): Promise<Response> {
  try {
    return await runWithConnection(async (db) => {
      await ensureSuperAdminPhaseOneMigration(db);

      try {
        const { email, password, userId, itAdminId } = (await req.json()) as CheckCredentialsPayload;

        let normalizedUserId: number | null = null;
        if (userId !== undefined && userId !== null && String(userId).trim().length > 0) {
          normalizedUserId = toNumber(userId);
          if (normalizedUserId === null) {
            return new Response(JSON.stringify({ match: false }), { status: 200 });
          }
        }

        const normalizedItAdminId = sanitizeItAdminId(itAdminId);

        const params: Array<string | number> = [email];
        let query = "SELECT * FROM users WHERE email = ?";
        if (normalizedUserId !== null) {
          query += " AND user_id = ?";
          params.push(normalizedUserId);
        }

        const [users] = await db.execute<UserRow[]>(query, params);
        const user = users[0];
        if (!user) {
          return new Response(JSON.stringify({ match: false }), { status: 200 });
        }

        const resolvedRole = await resolveUserRole(db, user);
        const roleForLogic = resolvedRole ?? user.role ?? null;
        const normalizedRole = normalizeRoleName(roleForLogic);
        const canonicalRole = resolveCanonicalRole(normalizedRole);

        if (requiresItAdminId(normalizedRole)) {
          if (!normalizedItAdminId) {
            return new Response(
              JSON.stringify({ match: false, requireItAdminId: true, requireUserId: true, role: canonicalRole || normalizedRole || roleForLogic }),
              { status: 200 },
            );
          }

          const linkedUserId = await resolveSuperAdminLinkedUserId(db, normalizedItAdminId);
          if (!linkedUserId || linkedUserId !== Number(user.user_id)) {
            return new Response(JSON.stringify({ match: false }), { status: 200 });
          }
        }

        if (password !== user.password) {
          return new Response(JSON.stringify({ match: false }), { status: 200 });
        }

        return new Response(
          JSON.stringify({
            match: true,
            role: canonicalRole || normalizedRole || roleForLogic,
            redirectPath: resolvePortalPath(canonicalRole || normalizedRole),
          }),
          { status: 200 },
        );
      } catch (err) {
        console.error("check-credentials handler error", err);
        return new Response(JSON.stringify({ match: false }), { status: 200 });
      }
    });
  } catch (err) {
    console.error("check-credentials connection error", err);
    return new Response(JSON.stringify({ match: false, error: "DB_CONNECTION_FAILED" }), { status: 500 });
  }
}
