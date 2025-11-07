export const USER_PROFILE_STORAGE_KEY = "rptCurrentUser";
export const USER_PROFILE_EVENT = "rptUserProfileUpdated";

export type StoredUserProfile = {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  role?: string | null;
  userId?: string | number | null;
  email?: string | null;
  gradeLevel?: string | null;
};

const sanitize = (value?: string | null): string => {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
};

export function storeUserProfile(profile: StoredUserProfile) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent(USER_PROFILE_EVENT, { detail: profile }));
  } catch (error) {
    console.warn("Unable to persist user profile", error);
  }
}

export function getStoredUserProfile(): StoredUserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredUserProfile;
  } catch (error) {
    console.warn("Unable to read stored user profile", error);
    return null;
  }
}

export function clearStoredUserProfile() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(USER_PROFILE_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(USER_PROFILE_EVENT, { detail: null }));
  } catch (error) {
    console.warn("Unable to clear stored user profile", error);
  }
}

export function formatFullNameWithMiddleInitial(profile?: StoredUserProfile | null): string {
  if (!profile) return "";
  const first = sanitize(profile.firstName);
  const middle = sanitize(profile.middleName);
  const last = sanitize(profile.lastName);

  const parts: string[] = [];
  if (first) {
    parts.push(first);
  }
  if (middle) {
    const initial = middle.charAt(0).toUpperCase();
    if (initial) {
      parts.push(`${initial}.`);
    }
  }
  if (last) {
    parts.push(last);
  }

  return parts.join(" ").trim();
}

export function getStoredDisplayName(fallback: string): string {
  const profile = getStoredUserProfile();
  const formatted = formatFullNameWithMiddleInitial(profile);
  return formatted || fallback;
}
