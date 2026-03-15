"use client";

import { useEffect, useState } from "react";
import {
  getStoredUserProfile,
  USER_PROFILE_EVENT,
  type StoredUserProfile,
} from "@/lib/utils/user-profile";

export function useStoredUserProfile(): StoredUserProfile | null {
  const [storedProfile, setStoredProfile] = useState<StoredUserProfile | null>(() =>
    getStoredUserProfile(),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleProfileChange = (event: Event) => {
      const customEvent = event as CustomEvent<StoredUserProfile | null>;
      setStoredProfile(customEvent.detail ?? getStoredUserProfile());
    };

    const handleStorage = () => {
      setStoredProfile(getStoredUserProfile());
    };

    window.addEventListener(USER_PROFILE_EVENT, handleProfileChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(USER_PROFILE_EVENT, handleProfileChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return storedProfile;
}
