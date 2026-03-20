export const PARENT_PORTAL_ENTRY_STORAGE_KEY = "rptParentPortalEntry";

export type ParentPortalEntry = "pwa" | "web";

export function getStoredParentPortalEntry(): ParentPortalEntry | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(PARENT_PORTAL_ENTRY_STORAGE_KEY);
    return rawValue === "pwa" || rawValue === "web" ? rawValue : null;
  } catch {
    return null;
  }
}

export function storeParentPortalEntry(entry: ParentPortalEntry) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(PARENT_PORTAL_ENTRY_STORAGE_KEY, entry);
  } catch (error) {
    console.warn("Unable to persist parent portal entry", error);
  }
}
