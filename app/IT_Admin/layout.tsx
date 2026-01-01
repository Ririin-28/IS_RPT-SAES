import { ReactNode } from "react";
import Script from "next/script";
import { redirect } from "next/navigation";
import ITAdminSessionGuard from "@/components/IT_Admin/ITAdminSessionGuard";
import { getAdminSessionFromCookies } from "@/lib/server/admin-session";

// Temporary bypass: disable server-side admin session enforcement.
const DISABLE_ADMIN_SESSION_CHECK = true;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ITAdminLayout({ children }: { children: ReactNode }) {
  if (!DISABLE_ADMIN_SESSION_CHECK) {
    const session = await getAdminSessionFromCookies();
    if (!session) {
      redirect("/auth/adminlogin?logout=true");
    }
  }

  return (
    <>
      <Script
        id="it-admin-session-precheck"
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
        window.history.replaceState(null, "", "/auth/adminlogin?logout=true");
        window.location.replace("/auth/adminlogin?logout=true");
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
      <ITAdminSessionGuard>{children}</ITAdminSessionGuard>
    </>
  );
}
