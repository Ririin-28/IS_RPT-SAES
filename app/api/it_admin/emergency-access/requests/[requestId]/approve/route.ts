import { NextRequest, NextResponse } from "next/server";
import { runWithConnection } from "@/lib/db";
import { requireItAdmin } from "@/lib/server/it-admin-auth";
import {
  canManagePrincipalRequests,
  hasActiveEmergencyAccess,
  writeEmergencyAuditLog,
} from "@/lib/server/emergency-access";
import { approvePendingRequest } from "@/lib/server/emergency-requests";
import { resolveRequestIp } from "@/lib/server/security-audit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const auth = await requireItAdmin(request, { permission: "it_admin:content.manage" });
  if (!auth.ok) {
    return auth.response;
  }

  const { requestId: rawRequestId } = await params;
  const requestId = Number(rawRequestId);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid request id." }, { status: 400 });
  }

  const ipAddress = resolveRequestIp(request);

  try {
    return await runWithConnection(async (connection) => {
      const permission = await canManagePrincipalRequests(connection, {
        userId: auth.userId,
        canonicalRole: auth.canonicalRole,
      });
      if (!permission.allowed) {
        return NextResponse.json({ success: false, error: "Emergency Requests access is not active." }, { status: 403 });
      }

      const active = await hasActiveEmergencyAccess(connection, auth.userId, "Requests");
      if (!active.active || !active.session) {
        return NextResponse.json({ success: false, error: "Emergency Requests access is not active." }, { status: 403 });
      }

      await connection.beginTransaction();
      try {
        const status = await approvePendingRequest(connection, requestId);

        await writeEmergencyAuditLog(connection, {
          action: "EMERGENCY_REQUEST_APPROVED",
          userId: auth.userId,
          emergencyAccessId: Number(active.session.emergency_access_id),
          targetModule: "Requests",
          targetRecordId: requestId,
          ipAddress,
          details: {
            performed_by_role: "IT Admin",
            performed_via: "Emergency Access",
            request_id: requestId,
            old_status: status.previous,
            new_status: status.current,
          },
        });

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        const message = error instanceof Error ? error.message : "Failed to approve request.";
        if (message === "REQUEST_NOT_FOUND") {
          return NextResponse.json({ success: false, error: "Request not found." }, { status: 404 });
        }
        if (message === "REQUEST_NOT_PENDING") {
          return NextResponse.json(
            { success: false, error: "Request is no longer pending." },
            { status: 409 },
          );
        }
        throw error;
      }

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error("Failed to approve emergency request", error);
    return NextResponse.json({ success: false, error: "Unable to approve request." }, { status: 500 });
  }
}
