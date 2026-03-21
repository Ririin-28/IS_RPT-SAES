import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import HydrationBoundary from "@/components/Common/HydrationBoundary";
import TeacherSessionGuard from "@/components/Teacher/TeacherSessionGuard";
import { getTeacherSessionFromCookies } from "@/lib/server/teacher-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const session = await getTeacherSessionFromCookies();
  if (!session) {
    redirect("/auth/login?logout=true");
  }

  return (
    <TeacherSessionGuard>
      <HydrationBoundary>{children}</HydrationBoundary>
    </TeacherSessionGuard>
  );
}
