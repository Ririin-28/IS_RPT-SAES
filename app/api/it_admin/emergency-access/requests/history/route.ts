import { NextRequest, NextResponse } from "next/server";
import { runWithConnection } from "@/lib/db";
import { requireItAdmin } from "@/lib/server/it-admin-auth";
import { canManagePrincipalRequests } from "@/lib/server/emergency-access";

export const dynamic = "force-dynamic";

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
        return NextResponse.json({ success: true, locked: true, requests: [] });
      }

      return NextResponse.json({ success: true, locked: false, requests: [] });
    });
  } catch (error) {
    console.error("Failed to load emergency request history", error);
    return NextResponse.json({ success: false, error: "Unable to load request history." }, { status: 500 });
  }
}
