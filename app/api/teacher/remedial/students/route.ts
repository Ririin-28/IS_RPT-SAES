import { NextRequest, NextResponse } from "next/server";
import { GET as MasterTeacherGET } from "@/app/api/master_teacher/remedialteacher/students/route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return MasterTeacherGET(request);
}
