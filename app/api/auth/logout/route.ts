import { runWithConnection } from "@/lib/db";
import { recordAccountLogout } from "@/lib/server/account-logs";
import {
  buildClearedParentSessionCookie,
  extractParentSessionToken,
  revokeParentSession,
} from "@/lib/server/parent-session";
import {
  buildClearedAdminSessionCookie,
  extractAdminSessionToken,
  revokeAdminSession,
} from "@/lib/server/admin-session";
import {
  buildClearedPrincipalSessionCookie,
  extractPrincipalSessionToken,
  revokePrincipalSessionByToken,
} from "@/lib/server/principal-session";
import {
  buildClearedMasterTeacherSessionCookie,
  extractMasterTeacherSessionToken,
  revokeMasterTeacherSessionByToken,
} from "@/lib/server/master-teacher-session";
import {
  buildClearedTeacherSessionCookie,
  extractTeacherSessionToken,
  revokeTeacherSessionByToken,
} from "@/lib/server/teacher-session";

interface LogoutPayload {
  userId?: number | string | null;
}

export async function POST(req: Request): Promise<Response> {
  const respond = async (
    status: number,
    payload: Record<string, unknown>,
    extraHeaders?: Record<string, string | string[]>,
  ): Promise<Response> => {
    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });

    if (extraHeaders) {
      for (const [key, value] of Object.entries(extraHeaders)) {
        if (Array.isArray(value)) {
          value.forEach((headerValue) => headers.append(key, headerValue));
        } else {
          headers.append(key, value);
        }
      }
    }

    return new Response(JSON.stringify(payload), {
      status,
      headers,
    });
  };

  try {
    const { userId } = (await req.json().catch(() => ({ userId: null }))) as LogoutPayload;
    const cookieHeader = req.headers.get("cookie");
    const parentSessionToken = extractParentSessionToken(cookieHeader);
    const adminSessionToken = extractAdminSessionToken(cookieHeader);
    const principalSessionToken = extractPrincipalSessionToken(cookieHeader);
    const masterTeacherSessionToken = extractMasterTeacherSessionToken(cookieHeader);
    const teacherSessionToken = extractTeacherSessionToken(cookieHeader);
    const numericUserId = Number(userId);
    const hasValidBodyUserId = Number.isFinite(numericUserId) && numericUserId > 0;

    if (
      !parentSessionToken &&
      !adminSessionToken &&
      !principalSessionToken &&
      !masterTeacherSessionToken &&
      !teacherSessionToken &&
      !hasValidBodyUserId
    ) {
      return respond(400, { error: "Invalid user id" });
    }

    return await runWithConnection(async (db) => {
      let resolvedUserId: number | null = null;
      const responseCookies: string[] = [];

      if (parentSessionToken) {
        const sessionUserId = await revokeParentSession(db, parentSessionToken);
        if (sessionUserId != null) {
          resolvedUserId = sessionUserId;
        }
        responseCookies.push(buildClearedParentSessionCookie());
      }

      if (adminSessionToken) {
        const sessionUserId = await revokeAdminSession(db, adminSessionToken);
        if (sessionUserId != null) {
          resolvedUserId = sessionUserId;
        }
        responseCookies.push(buildClearedAdminSessionCookie());
      }

      if (principalSessionToken) {
        const sessionUserId = await revokePrincipalSessionByToken(db, principalSessionToken);
        if (sessionUserId != null) {
          resolvedUserId = sessionUserId;
        }
        responseCookies.push(buildClearedPrincipalSessionCookie());
      }

      if (masterTeacherSessionToken) {
        const sessionUserId = await revokeMasterTeacherSessionByToken(db, masterTeacherSessionToken);
        if (sessionUserId != null) {
          resolvedUserId = sessionUserId;
        }
        responseCookies.push(buildClearedMasterTeacherSessionCookie());
      }

      if (teacherSessionToken) {
        const sessionUserId = await revokeTeacherSessionByToken(db, teacherSessionToken);
        if (sessionUserId != null) {
          resolvedUserId = sessionUserId;
        }
        responseCookies.push(buildClearedTeacherSessionCookie());
      }

      if (resolvedUserId == null && hasValidBodyUserId) {
        resolvedUserId = numericUserId;
      }

      if (resolvedUserId != null) {
        await recordAccountLogout(db, resolvedUserId);
      }

      return respond(200, { success: true }, responseCookies.length > 0 ? { "Set-Cookie": responseCookies } : undefined);
    });
  } catch (error) {
    console.error("Logout request failed", error);
    return respond(500, { error: "Server error" });
  }
}
