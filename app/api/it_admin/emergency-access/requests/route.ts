import { NextRequest, NextResponse } from "next/server";
import { runWithConnection } from "@/lib/db";
import { requireItAdmin } from "@/lib/server/it-admin-auth";
import {
  canManagePrincipalRequests,
  hasActiveEmergencyAccess,
  writeEmergencyAuditLog,
} from "@/lib/server/emergency-access";
import {
  approvePendingRequest,
  listPendingPrincipalRequests,
  rejectPendingRequest,
} from "@/lib/server/emergency-requests";
import { resolveRequestIp } from "@/lib/server/security-audit";

export const dynamic = "force-dynamic";

function buildRequesterName(row: Record<string, unknown>): string | null {
  const direct = typeof row.user_name === "string" ? row.user_name.trim() : "";
  if (direct) return direct;
  const parts = [row.user_first_name, row.user_middle_name, row.user_last_name]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  const base = parts.join(" ").trim();
  const suffix = typeof row.user_suffix === "string" ? row.user_suffix.trim() : "";
  const combined = suffix ? `${base} ${suffix}`.trim() : base;
  return combined || null;
}

export async function GET(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:content.manage" });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    return await runWithConnection(async (connection) => {
      const permission = await canManagePrincipalRequests(connection, {
        userId: auth.userId,
        canonicalRole: auth.canonicalRole,
      });
      if (!permission.allowed) {
        return NextResponse.json({
          success: true,
          locked: true,
          requests: [],
          emergency_access: null,
        });
      }

      const active = await hasActiveEmergencyAccess(connection, auth.userId, "Requests");
      if (!active.active || !active.session) {
        return NextResponse.json({
          success: true,
          locked: true,
          requests: [],
          emergency_access: null,
        });
      }

      const rows = await listPendingPrincipalRequests(connection);

      const grouped = new Map<string, Record<string, unknown>[]>();
      for (const row of rows) {
        const key = row.submitted_by ? `requester-${row.submitted_by}` : String(row.request_id);
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(row);
      }

      const requests = Array.from(grouped.entries()).map(([groupKey, groupRows]) => {
        const row = groupRows[0] as Record<string, unknown>;
        const requesterName = buildRequesterName(row);
        const requesterId = row.submitted_by ? String(row.submitted_by) : null;

        return {
          id: String(row.request_id),
          title: typeof row.title === "string" ? row.title : null,
          requester: requesterName ?? (requesterId ? `MT ${requesterId}` : null),
          requesterId,
          quarter: typeof row.quarter_name === "string" ? row.quarter_name : null,
          subject: typeof row.subject_name === "string" ? row.subject_name : null,
          grade: row.grade_id !== null && row.grade_id !== undefined ? `Grade ${row.grade_id}` : null,
          status: "Pending",
          displayStatus: "Pending",
          displayLabel: "Remedial Schedule",
          type: "Remedial",
          description: null,
          startDate: row.schedule_date ? String(row.schedule_date) : null,
          endDate: row.schedule_date ? String(row.schedule_date) : null,
          approvedAt: null,
          approvedBy: null,
          updatedAt: row.submitted_at ? String(row.submitted_at) : null,
          requestedDate:
            row.submitted_at ? new Date(String(row.submitted_at)).toISOString().slice(0, 10) : null,
          requestedTimestamp: row.submitted_at ? new Date(String(row.submitted_at)).getTime() : null,
          sourceTable: "request_remedial_schedule",
          planBatchId: groupKey,
          relatedRowIds: groupRows.slice(1).map((entry) => String(entry.request_id)),
          activitiesPlan: groupRows.map((entry) => ({
            title: entry.title ? String(entry.title) : null,
            activityDate: entry.schedule_date ? String(entry.schedule_date) : null,
            day: entry.day ? String(entry.day) : null,
            quarter: entry.quarter_name ? String(entry.quarter_name) : null,
            subject: entry.subject_name ? String(entry.subject_name) : null,
            grade: entry.grade_id ? `Grade ${entry.grade_id}` : null,
          })),
        };
      });

      return NextResponse.json({
        success: true,
        locked: false,
        emergency_access: {
          emergency_access_id: Number(active.session.emergency_access_id),
          reason: String(active.session.reason),
          activated_at: String(active.session.activated_at),
          expires_at: active.session.expires_at ? String(active.session.expires_at) : null,
        },
        requests,
      });
    });
  } catch (error) {
    console.error("Failed to load emergency requests", error);
    return NextResponse.json({ success: false, error: "Unable to load emergency requests." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:content.manage" });
  if (!auth.ok) {
    return auth.response;
  }

  const payload = (await request.json().catch(() => null)) as {
    requestId?: string | number;
    action?: string;
    rejectionReason?: string | null;
  } | null;

  const requestId = Number(payload?.requestId);
  const action = typeof payload?.action === "string" ? payload.action.toLowerCase().trim() : "";

  if (!Number.isInteger(requestId) || requestId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid requestId." }, { status: 400 });
  }
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ success: false, error: "Unsupported action." }, { status: 400 });
  }

  const rejectionReason = typeof payload?.rejectionReason === "string" ? payload.rejectionReason.trim() : "";
  if (action === "reject" && !rejectionReason) {
    return NextResponse.json({ success: false, error: "Rejection reason is required." }, { status: 400 });
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
        if (action === "approve") {
          await approvePendingRequest(connection, requestId);
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
              old_status: "Pending",
              new_status: "Approved",
            },
          });
          await connection.commit();
          return NextResponse.json({ success: true, status: "Approved" });
        }

        await rejectPendingRequest(connection, requestId, rejectionReason, "IT Admin");
        await writeEmergencyAuditLog(connection, {
          action: "EMERGENCY_REQUEST_REJECTED",
          userId: auth.userId,
          emergencyAccessId: Number(active.session.emergency_access_id),
          targetModule: "Requests",
          targetRecordId: requestId,
          ipAddress,
          details: {
            performed_by_role: "IT Admin",
            performed_via: "Emergency Access",
            request_id: requestId,
            old_status: "Pending",
            new_status: "Rejected",
            reason: rejectionReason,
          },
        });
        await connection.commit();
        return NextResponse.json({ success: true, status: "Rejected" });
      } catch (error) {
        await connection.rollback();
        const message = error instanceof Error ? error.message : "Unable to update request.";
        if (message === "REQUEST_NOT_FOUND") {
          return NextResponse.json({ success: false, error: "Request not found." }, { status: 404 });
        }
        if (message === "REQUEST_NOT_PENDING") {
          return NextResponse.json({ success: false, error: "Request is no longer pending." }, { status: 409 });
        }
        throw error;
      }
    });
  } catch (error) {
    console.error("Failed to update emergency request", error);
    return NextResponse.json({ success: false, error: "Unable to update request." }, { status: 500 });
  }
}
