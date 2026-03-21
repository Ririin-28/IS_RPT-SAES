"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { clearStoredUserProfile, storeUserProfile } from "@/lib/utils/user-profile";

type MasterTeacherSessionGuardProps = {
  children: ReactNode;
};

type AppRouterInstance = ReturnType<typeof useRouter>;

function redirectMasterTeacherToLogin(router: AppRouterInstance) {
  clearStoredUserProfile();
  const target = "/auth/login?logout=true";
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", target);
    window.location.replace(target);
  } else {
    router.replace(target);
  }
}

export default function MasterTeacherSessionGuard({ children }: MasterTeacherSessionGuardProps) {
  const router = useRouter();
  const redirectingRef = useRef(false);

  useEffect(() => {
    let active = true;

    const redirectToLogin = () => {
      if (!active || redirectingRef.current) {
        return;
      }
      redirectingRef.current = true;
      redirectMasterTeacherToLogin(router);
    };

    const verify = async () => {
      try {
        const response = await fetch("/api/master_teacher/session", {
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
            profileImageUrl?: string | null;
            role?: string | null;
          };
        };

        if (!active) {
          return;
        }

        if (data?.user) {
          storeUserProfile({
            userId: data.user.userId ?? null,
            email: data.user.email ?? null,
            firstName: data.user.firstName ?? null,
            middleName: data.user.middleName ?? null,
            lastName: data.user.lastName ?? null,
            profileImageUrl: data.user.profileImageUrl ?? null,
            role: "master_teacher",
          });
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
