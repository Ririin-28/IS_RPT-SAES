import { ReactNode } from "react";
import Script from "next/script";
import { redirect } from "next/navigation";
import ParentSessionGuard from "@/components/Parent/ParentSessionGuard";
import { getParentSessionFromCookies } from "@/lib/server/parent-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const session = await getParentSessionFromCookies();
  if (!session) {
    redirect("/auth/login?logout=true");
  }

  return (
    <>
      <Script
        id="parent-session-precheck"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `(() => {
  function redirectIfLoggedOut(fromHistory) {
    try {
      if (typeof window === "undefined") {
        return false;
      }
      if (window.sessionStorage.getItem("wasLoggedOut") === "true") {
        if (fromHistory) {
          document.documentElement.style.visibility = "hidden";
        }
        window.history.replaceState(null, "", "/auth/login?logout=true");
        window.location.replace("/auth/login?logout=true");
        return true;
      }
    } catch (error) {
      console.warn("Unable to inspect session storage", error);
    }
    return false;
  }

  if (redirectIfLoggedOut(false)) {
    return;
  }

  window.addEventListener("pageshow", (event) => {
    if (event?.persisted) {
      redirectIfLoggedOut(true);
    }
  });

  window.addEventListener("popstate", () => {
    redirectIfLoggedOut(true);
  });
})();`,
        }}
      />
      <ParentSessionGuard>{children}</ParentSessionGuard>
    </>
  );
}
