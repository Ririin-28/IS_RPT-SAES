import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import HydrationBoundary from "@/components/Common/HydrationBoundary";
import PrincipalSessionGuard from "@/components/Principal/PrincipalSessionGuard";
import { getPrincipalSessionFromCookies } from "@/lib/server/principal-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrincipalLayout({ children }: { children: ReactNode }) {
  const session = await getPrincipalSessionFromCookies();
  if (!session) {
    redirect("/auth/login?logout=true");
  }

  return (
    <PrincipalSessionGuard>
      <HydrationBoundary>{children}</HydrationBoundary>
    </PrincipalSessionGuard>
  );
}
