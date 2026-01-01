import { type RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { normalizeRoleName, resolvePortalPath, resolveUserRole } from "@/lib/server/role-resolution";

interface CheckCredentialsPayload {
  email: string;
  password: string;
  userId?: string | number | null;
}

interface UserRow extends RowDataPacket {
  user_id: number;
  email: string;
  password: string;
  role: string | null;
}

const ADMIN_ROLES = new Set(["admin", "it_admin", "itadmin"]);

function requiresUserId(normalizedRole: string): boolean {
  return ADMIN_ROLES.has(normalizedRole);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(req: Request): Promise<Response> {
  try {
    return await runWithConnection(async (db) => {
      try {
        const { email, password, userId } = (await req.json()) as CheckCredentialsPayload;

        let normalizedUserId: number | null = null;
        if (userId !== undefined && userId !== null && String(userId).trim().length > 0) {
          normalizedUserId = toNumber(userId);
          if (normalizedUserId === null) {
            return new Response(JSON.stringify({ match: false }), { status: 200 });
          }
        }

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

        if (requiresUserId(normalizedRole) && normalizedUserId === null) {
          return new Response(
            JSON.stringify({ match: false, requireUserId: true, role: roleForLogic }),
            { status: 200 },
          );
        }

        if (password !== user.password) {
          return new Response(JSON.stringify({ match: false }), { status: 200 });
        }

        return new Response(
          JSON.stringify({
            match: true,
            role: roleForLogic,
            redirectPath: resolvePortalPath(normalizedRole),
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
