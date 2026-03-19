import { clearStoredUserProfile, getStoredUserProfile } from "./user-profile";

type RouterLike = {
  replace: (href: string) => void;
  push?: (href: string) => void;
};

function hideProtectedUiDuringLogout() {
  if (typeof document === "undefined") {
    return;
  }

  const existingMask = document.getElementById("__logout-transition-mask__");
  if (existingMask) {
    return;
  }

  const mask = document.createElement("div");
  mask.id = "__logout-transition-mask__";
  mask.className = "fixed inset-0 z-[2147483647] flex items-center justify-center bg-[#f6faf8]";
  Object.assign(mask.style, {
    pointerEvents: "auto",
  });

  const content = document.createElement("div");
  content.className = "flex flex-col items-center gap-2 text-center";

  const spinner = document.createElement("div");
  spinner.className = "h-8 w-8 animate-spin rounded-full border-4 border-[#013300]/20 border-t-[#013300]";

  const title = document.createElement("div");
  title.textContent = "Logging out...";
  title.className = "text-sm font-medium text-gray-500";

  content.appendChild(spinner);
  content.appendChild(title);
  mask.appendChild(content);

  document.documentElement.style.background = "#f6faf8";
  document.body.style.background = "#f6faf8";
  document.body.appendChild(mask);
}

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

  hideProtectedUiDuringLogout();

  if (typeof window !== "undefined") {
    window.location.replace(logoutTarget);
    return;
  }

  router.replace(logoutTarget);
}
