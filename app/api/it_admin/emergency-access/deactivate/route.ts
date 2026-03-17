import { NextRequest, NextResponse } from "next/server";
import { runWithConnection } from "@/lib/db";
import { requireItAdmin } from "@/lib/server/it-admin-auth";
import { deactivateEmergencyAccess, writeEmergencyAuditLog } from "@/lib/server/emergency-access";
import { resolveRequestIp } from "@/lib/server/security-audit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:maintenance.execute" });
  if (!auth.ok) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as { emergency_access_id?: unknown } | null;
  const emergencyAccessId = Number(body?.emergency_access_id);

  if (!Number.isInteger(emergencyAccessId) || emergencyAccessId <= 0) {
    return NextResponse.json({ success: false, error: "A valid emergency_access_id is required." }, { status: 400 });
  }

  const ipAddress = resolveRequestIp(request);

  try {
    return await runWithConnection(async (connection) => {
      const deactivated = await deactivateEmergencyAccess(connection, auth.userId, emergencyAccessId);
      if (!deactivated) {
        return NextResponse.json(
          { success: false, error: "No active emergency session found for this IT Admin." },
          { status: 404 },
        );
      }

      await writeEmergencyAuditLog(connection, {
        action: "EMERGENCY_ACCESS_DEACTIVATED",
        userId: auth.userId,
        emergencyAccessId,
        targetModule: "EmergencyAccess",
        targetRecordId: emergencyAccessId,
        ipAddress,
        details: {
          performed_by_role: "IT Admin",
          performed_via: "Emergency Access",
          deactivated_for_role: "Principal",
        },
      });

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error("Failed to deactivate emergency access", error);
    return NextResponse.json({ success: false, error: "Unable to deactivate emergency access." }, { status: 500 });
  }
}
