import { clearStoredUserProfile } from "./user-profile";

type RouterLike = {
  push: (href: string) => void;
};

/**
 * Clears user session artifacts and routes back to the login screen.
 */
export function performClientLogout(router: RouterLike) {
  clearStoredUserProfile();
  try {
    sessionStorage.setItem("wasLoggedOut", "true");
  } catch (error) {
    console.warn("Unable to persist logout marker", error);
  }
  router.push("/auth/login?logout=true");
}
