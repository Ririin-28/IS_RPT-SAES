import { clearStoredUserProfile, getStoredUserProfile } from "./user-profile";

type RouterLike = {
  push: (href: string) => void;
};

/**
 * Clears user session artifacts and routes back to the login screen.
 */
export function performClientLogout(router: RouterLike) {
  const storedProfile = getStoredUserProfile();
  const userId = storedProfile?.userId ?? null;

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
  router.push("/auth/login?logout=true");
}
