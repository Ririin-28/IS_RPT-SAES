import { NextRequest, NextResponse } from "next/server";
import { GET as BaseGet, PUT as BasePut } from "@/app/api/it_admin/emergency-access/weekly-schedule/route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return BaseGet(request);
}

export async function PUT(request: NextRequest) {
  return BasePut(request);
}

export async function DELETE() {
  // Keep Principal module compatibility for reset action.
  return NextResponse.json({
    success: true,
    schedule: {
      Monday: "",
      Tuesday: "",
      Wednesday: "",
      Thursday: "",
      Friday: "",
      startTime: "",
      endTime: "",
    },
    options: { subjects: ["Assessment", "English", "Filipino", "Math"] },
  });
}
