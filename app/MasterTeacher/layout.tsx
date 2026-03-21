import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import HydrationBoundary from "@/components/Common/HydrationBoundary";
import MasterTeacherSessionGuard from "@/components/MasterTeacher/MasterTeacherSessionGuard";
import { getMasterTeacherSessionFromCookies } from "@/lib/server/master-teacher-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MasterTeacherLayout({ children }: { children: ReactNode }) {
  const session = await getMasterTeacherSessionFromCookies();
  if (!session) {
    redirect("/auth/login?logout=true");
  }

  return (
    <MasterTeacherSessionGuard>
      <HydrationBoundary>{children}</HydrationBoundary>
    </MasterTeacherSessionGuard>
  );
}
