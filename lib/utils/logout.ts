import { clearStoredUserProfile, getStoredUserProfile } from "./user-profile";
import { getStoredParentPortalEntry } from "./parent-portal-entry";

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

async function notifyBackendLogout(userId: string) {
  if (typeof fetch !== "function") {
    return false;
  }

  const maxAttempts = 2;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller
      ? window.setTimeout(() => controller.abort(), 8000)
      : null;

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
        cache: "no-store",
        keepalive: true,
        signal: controller?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `Logout request failed with status ${response.status}`);
      }

      return true;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      }
    } finally {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  console.warn("Failed to notify backend about logout", lastError);
  return false;
}

/**
 * Clears user session artifacts and routes back to the login screen.
 */
export function performClientLogout(router: RouterLike) {
  const storedProfile = getStoredUserProfile();
  const userId = storedProfile?.userId ?? null;
  const normalizedRole = typeof storedProfile?.role === "string" ? storedProfile.role.trim().toLowerCase().replace(/[\s/\-]+/g, "_") : "";
  const parentPortalEntry = normalizedRole === "parent" ? getStoredParentPortalEntry() : null;
  const logoutTarget = normalizedRole === "admin" || normalizedRole === "it_admin" || normalizedRole === "itadmin" || normalizedRole === "super_admin"
    ? "/auth/adminlogin?logout=true"
    : normalizedRole === "parent" && parentPortalEntry === "pwa"
      ? "/PWA?portal=parent&logout=true"
      : "/auth/login?logout=true";

  clearStoredUserProfile();
  try {
    sessionStorage.setItem("wasLoggedOut", "true");
  } catch (error) {
    console.warn("Unable to persist logout marker", error);
  }

  hideProtectedUiDuringLogout();

  const finalizeRedirect = () => {
    if (typeof window !== "undefined") {
      window.location.replace(logoutTarget);
      return;
    }

    router.replace(logoutTarget);
  };

  if (userId == null) {
    finalizeRedirect();
    return;
  }

  void notifyBackendLogout(String(userId)).finally(finalizeRedirect);
}
