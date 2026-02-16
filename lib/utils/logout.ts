import { clearStoredUserProfile, getStoredUserProfile } from "./user-profile";

type RouterLike = {
  replace: (href: string) => void;
  push?: (href: string) => void;
};

/**
 * Clears user session artifacts and routes back to the login screen.
 */
export function performClientLogout(router: RouterLike) {
  const storedProfile = getStoredUserProfile();
  const userId = storedProfile?.userId ?? null;
  const normalizedRole = typeof storedProfile?.role === "string" ? storedProfile.role.trim().toLowerCase().replace(/[\s/\-]+/g, "_") : "";
  const logoutTarget = normalizedRole === "admin" || normalizedRole === "it_admin" || normalizedRole === "itadmin" || normalizedRole === "super_admin"
    ? "/auth/adminlogin?logout=true"
    : "/auth/login?logout=true";

  if (userId != null) {
    try {
      const payload = JSON.stringify({ userId });

      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/auth/logout", blob);
      } else if (typeof fetch === "function") {
        fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: payload,
          keepalive: true,
        }).catch((error) => {
          console.warn("Failed to notify backend about logout", error);
        });
      }
    } catch (error) {
      console.warn("Unable to propagate logout event", error);
    }
  }

  clearStoredUserProfile();
  try {
    sessionStorage.setItem("wasLoggedOut", "true");
  } catch (error) {
    console.warn("Unable to persist logout marker", error);
  }
  router.replace(logoutTarget);
}
