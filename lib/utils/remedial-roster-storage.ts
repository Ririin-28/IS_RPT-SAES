type RemedialRosterScope = "teacher" | "master-teacher-remedial";

const REMEDIAL_ROSTER_PREFIX = "rptRemedialRoster";

const normalizeKeyPart = (value?: string | number | null): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
};

const resolveStoredUserId = (): string | number | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = sessionStorage.getItem("rptCurrentUser");
    if (!raw) {
      return null;
    }

    const profile = JSON.parse(raw) as { userId?: string | number | null };
    return normalizeKeyPart(profile.userId);
  } catch {
    return null;
  }
};

export const buildRemedialRosterKey = (
  scope: RemedialRosterScope,
  subject: string,
  userId?: string | number | null,
): string | null => {
  const normalizedSubject = normalizeKeyPart(subject)?.toLowerCase();
  const normalizedUserId = normalizeKeyPart(userId);

  if (!normalizedSubject || !normalizedUserId) {
    return null;
  }

  return `${REMEDIAL_ROSTER_PREFIX}:${scope}:subject:${normalizedSubject}:user:${normalizedUserId}`;
};

export const readStoredRemedialRoster = <T>(storageKey: string | null): T[] | null => {
  if (typeof window === "undefined" || !storageKey) {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch (error) {
    console.warn("Unable to read stored remedial roster", error);
    return null;
  }
};

export const readStoredRemedialRosterForCurrentUser = <T>(
  scope: RemedialRosterScope,
  subject: string,
): T[] => {
  const userId = resolveStoredUserId();
  const storageKey = buildRemedialRosterKey(scope, subject, userId);
  return readStoredRemedialRoster<T>(storageKey) ?? [];
};

export const writeStoredRemedialRoster = (storageKey: string | null, roster: unknown): boolean => {
  if (typeof window === "undefined" || !storageKey || !Array.isArray(roster)) {
    return false;
  }

  try {
    sessionStorage.setItem(storageKey, JSON.stringify(roster));
    return true;
  } catch (error) {
    console.warn("Unable to store remedial roster", error);
    return false;
  }
};
