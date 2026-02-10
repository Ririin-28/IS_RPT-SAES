"use client";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { clearStoredUserProfile, storeUserProfile } from "@/lib/utils/user-profile";

type ITAdminSessionGuardProps = {
  children: ReactNode;
};

// Temporary bypass to allow admin access without session validation.
// Set to false to re-enable server/session checks.
const DISABLE_ADMIN_SESSION_GUARD = true;

type AppRouterInstance = ReturnType<typeof useRouter>;

function redirectAdminToLogin(router: AppRouterInstance) {
  clearStoredUserProfile();
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem("wasLoggedOut", "true");
    } catch (storageError) {
      console.warn("Unable to persist logout marker", storageError);
    }
    window.history.replaceState(null, "", "/auth/adminlogin?logout=true");
    window.location.replace("/auth/adminlogin?logout=true");
  } else {
    router.replace("/auth/adminlogin?logout=true");
  }
}

const ADMIN_ROLE_SET = new Set(["admin", "it_admin", "itadmin"]);

const normalizeRole = (role: string | null | undefined) => {
  if (!role) {
    return "";
  }
  return role.trim().toLowerCase().replace(/[\s/\-]+/g, "_");
};

export default function ITAdminSessionGuard({ children }: ITAdminSessionGuardProps) {
  const router = useRouter();
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (DISABLE_ADMIN_SESSION_GUARD) {
      return;
    }

    let active = true;

    const redirectToLogin = () => {
      if (!active || redirectingRef.current) {
        return;
      }
      redirectingRef.current = true;
      redirectAdminToLogin(router);
    };

    const handlePageShow = (event: Event) => {
      const persisted = Boolean((event as Event & { persisted?: boolean }).persisted);
      if (persisted) {
        if (shouldRedirectImmediately()) {
          redirectToLogin();
        } else {
          verify();
        }
      }
    };

    const handlePopState = () => {
      if (shouldRedirectImmediately()) {
        redirectToLogin();
      }
    };

    const shouldRedirectImmediately = () => {
      try {
        return sessionStorage.getItem("wasLoggedOut") === "true";
      } catch {
        return false;
      }
    };

    const verify = async () => {
      if (shouldRedirectImmediately()) {
        redirectToLogin();
        return;
      }

      try {
        const response = await fetch("/api/it-admin/session", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unauthorized");
        }

        const data = (await response.json()) as {
          user?: {
            userId?: number;
            email?: string | null;
            firstName?: string | null;
            middleName?: string | null;
            lastName?: string | null;
            role?: string | null;
          };
        };

        if (!active) {
          return;
        }

        if (data?.user) {
          const normalizedRole = normalizeRole(data.user.role);
          if (!ADMIN_ROLE_SET.has(normalizedRole)) {
            throw new Error("Invalid role");
          }
          storeUserProfile({
            userId: data.user.userId ?? null,
            email: data.user.email ?? null,
            firstName: data.user.firstName ?? null,
            middleName: data.user.middleName ?? null,
            lastName: data.user.lastName ?? null,
            role: normalizedRole,
          });
          try {
            sessionStorage.setItem("wasLoggedOut", "false");
          } catch (storageError) {
            console.warn("Unable to persist logout marker", storageError);
          }
        }
      } catch {
        if (!active) {
          return;
        }
        redirectToLogin();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);
    verify();

    return () => {
      active = false;
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [router]);

  useLayoutEffect(() => {
    if (DISABLE_ADMIN_SESSION_GUARD) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }
    try {
      if (window.sessionStorage.getItem("wasLoggedOut") === "true" && !redirectingRef.current) {
        redirectingRef.current = true;
        redirectAdminToLogin(router);
      }
    } catch {
      // Ignore storage errors
    }
  }, [router]);

  return <>{children}</>;
}
