"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { clearStoredUserProfile, storeUserProfile } from "@/lib/utils/user-profile";

type SuperAdminSessionGuardProps = {
  children: ReactNode;
};

const DISABLE_SUPER_ADMIN_SESSION_GUARD = true;

type AppRouterInstance = ReturnType<typeof useRouter>;

function redirectSuperAdminToLogin(router: AppRouterInstance) {
  clearStoredUserProfile();
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", "/auth/adminlogin");
    window.location.replace("/auth/adminlogin");
  } else {
    router.replace("/auth/adminlogin");
  }
}

const SUPER_ADMIN_ROLE_SET = new Set(["admin", "it_admin", "itadmin", "super_admin"]);

const normalizeRole = (role: string | null | undefined) => {
  if (!role) {
    return "";
  }
  return role.trim().toLowerCase().replace(/[\s/\-]+/g, "_");
};

export default function SuperAdminSessionGuard({ children }: SuperAdminSessionGuardProps) {
  const router = useRouter();
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (DISABLE_SUPER_ADMIN_SESSION_GUARD) {
      return;
    }

    let active = true;

    const redirectToLogin = () => {
      if (!active || redirectingRef.current) {
        return;
      }
      redirectingRef.current = true;
      redirectSuperAdminToLogin(router);
    };

    const verify = async () => {
      try {
        const response = await fetch("/api/super_admin/session", {
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
          if (!SUPER_ADMIN_ROLE_SET.has(normalizedRole)) {
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

    void verify();

    return () => {
      active = false;
    };
  }, [router]);

  return <>{children}</>;
}
