"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { clearStoredUserProfile, storeUserProfile } from "@/lib/utils/user-profile";

type ParentSessionGuardProps = {
  children: ReactNode;
};

type AppRouterInstance = ReturnType<typeof useRouter>;

function redirectParentToLogin(router: AppRouterInstance) {
  clearStoredUserProfile();
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem("wasLoggedOut", "true");
    } catch (storageError) {
      console.warn("Unable to persist logout marker", storageError);
    }
    window.history.replaceState(null, "", "/auth/login?logout=true");
    window.location.replace("/auth/login?logout=true");
  } else {
    router.replace("/auth/login?logout=true");
  }
}

export default function ParentSessionGuard({ children }: ParentSessionGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const redirectingRef = useRef(false);

  useEffect(() => {
    let active = true;

    if (pathname === "/Parent/welcome") {
      return () => {
        active = false;
      };
    }

    const redirectToLogin = () => {
      if (!active || redirectingRef.current) {
        return;
      }
      redirectingRef.current = true;
      redirectParentToLogin(router);
    };

    const shouldRedirectImmediately = () => {
      try {
        return sessionStorage.getItem("wasLoggedOut") === "true";
      } catch (error) {
        return false;
      }
    };

    type PageShowEvent = Event & { persisted?: boolean };

    const handlePageShow = (event: Event) => {
      const persisted = Boolean((event as PageShowEvent)?.persisted);
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

    const verify = async () => {
      if (shouldRedirectImmediately()) {
        redirectToLogin();
        return;
      }

      try {
        const response = await fetch("/api/parent/session", {
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
            role: "parent",
          });
          try {
            sessionStorage.setItem("wasLoggedOut", "false");
          } catch (storageError) {
            console.warn("Unable to persist logout marker", storageError);
          }
        }
      } catch (error) {
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
  }, [pathname, router]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (pathname === "/Parent/welcome") {
      return;
    }
    try {
      if (window.sessionStorage.getItem("wasLoggedOut") === "true" && !redirectingRef.current) {
        redirectingRef.current = true;
        redirectParentToLogin(router);
      }
    } catch (error) {
      // Ignore storage access issues to avoid blocking render.
    }
  }, [pathname, router]);

  return <>{children}</>;
}
