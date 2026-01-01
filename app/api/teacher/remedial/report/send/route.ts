import { NextRequest, NextResponse } from "next/server";
import { POST as MasterTeacherPOST } from "@/app/api/master_teacher/remedialteacher/report/send/route";

export async function POST(request: NextRequest) {
  return MasterTeacherPOST(request);
}
