import { ReactNode } from "react";
import { redirect } from "next/navigation";
import SuperAdminSessionGuard from "@/components/Super_Admin/SuperAdminSessionGuard";
import { getAdminSessionFromCookies } from "@/lib/server/admin-session";

// Enforce server-side admin session checks.
const DISABLE_ADMIN_SESSION_CHECK = false;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LegacyITAdminLayout({ children }: { children: ReactNode }) {
  if (!DISABLE_ADMIN_SESSION_CHECK) {
    const session = await getAdminSessionFromCookies();
    if (!session) {
      redirect("/auth/adminlogin");
    }
  }

  return (
    <SuperAdminSessionGuard>{children}</SuperAdminSessionGuard>
  );
}
