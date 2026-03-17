import { NextRequest, NextResponse } from "next/server";
import { runWithConnection } from "@/lib/db";
import { requireItAdmin } from "@/lib/server/it-admin-auth";
import { getActiveEmergencyAccessByUserId, mapEmergencyAccessResponse } from "@/lib/server/emergency-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:maintenance.execute" });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    return await runWithConnection(async (connection) => {
      const session = await getActiveEmergencyAccessByUserId(connection, auth.userId);
      return NextResponse.json({
        success: true,
        emergency_access: mapEmergencyAccessResponse(session),
      });
    });
  } catch (error) {
    console.error("Failed to fetch emergency access status", error);
    return NextResponse.json({ success: false, error: "Unable to load emergency access status." }, { status: 500 });
  }
}
