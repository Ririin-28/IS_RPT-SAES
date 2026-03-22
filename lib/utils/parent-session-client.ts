import {
  getStoredUserProfile,
  storeUserProfile,
  type StoredUserProfile,
} from "@/lib/utils/user-profile";

type ParentSessionPayload = {
  success?: boolean;
  user?: {
    userId?: number | string | null;
    email?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
  } | null;
};

export function normalizeStoredUserId(userId: StoredUserProfile["userId"]): number | null {
  if (typeof userId === "number" && Number.isFinite(userId) && userId > 0) {
    return userId;
  }

  if (typeof userId === "string" && userId.trim()) {
    const parsed = Number(userId.trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

export function getStoredParentUserId(): number | null {
  const profile = getStoredUserProfile();
  const role = typeof profile?.role === "string" ? profile.role.trim().toLowerCase() : "";

  if (role && role !== "parent") {
    return null;
  }

  return normalizeStoredUserId(profile?.userId);
}

export async function hydrateParentUserProfileFromSession(): Promise<StoredUserProfile | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const response = await fetch("/api/parent/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as ParentSessionPayload | null;
    const resolvedUserId = normalizeStoredUserId(payload?.user?.userId ?? null);

    if (!response.ok || !payload?.success || !payload.user || resolvedUserId === null) {
      return null;
    }

    const nextProfile: StoredUserProfile = {
      userId: resolvedUserId,
      email: payload.user.email ?? null,
      firstName: payload.user.firstName ?? null,
      middleName: payload.user.middleName ?? null,
      lastName: payload.user.lastName ?? null,
      role: "parent",
    };

    storeUserProfile(nextProfile);
    return nextProfile;
  } catch {
    return null;
  }
}

export async function resolveParentUserId(): Promise<number | null> {
  const storedUserId = getStoredParentUserId();
  if (storedUserId !== null) {
    return storedUserId;
  }

  const hydratedProfile = await hydrateParentUserProfileFromSession();
  return normalizeStoredUserId(hydratedProfile?.userId);
}
