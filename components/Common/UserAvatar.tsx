"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type UserAvatarProps = {
  profileImageUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  initials?: string | null;
  alt?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  size?: number;
};

function getInitials(firstName?: string | null, lastName?: string | null, initials?: string | null): string {
  if (typeof initials === "string" && initials.trim().length > 0) {
    return initials.trim().slice(0, 2).toUpperCase();
  }

  const firstInitial = typeof firstName === "string" ? firstName.trim().charAt(0) : "";
  const lastInitial = typeof lastName === "string" ? lastName.trim().charAt(0) : "";
  const combined = `${firstInitial}${lastInitial}`.toUpperCase();

  if (combined) {
    return combined;
  }

  if (firstInitial) {
    return firstInitial.toUpperCase();
  }

  if (lastInitial) {
    return lastInitial.toUpperCase();
  }

  return "U";
}

function hasUtilityClass(className: string, utility: string): boolean {
  return new RegExp(`(?:^|\\s)${utility}(?:\\s|$)`).test(className);
}

export default function UserAvatar({
  profileImageUrl,
  firstName,
  lastName,
  initials,
  alt = "Profile",
  imageClassName = "",
  fallbackClassName = "",
  size = 32,
}: UserAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [profileImageUrl]);

  if (profileImageUrl && !hasImageError) {
    return (
      <Image
        src={profileImageUrl}
        alt={alt}
        width={size}
        height={size}
        unoptimized
        className={imageClassName}
        onError={() => setHasImageError(true)}
      />
    );
  }

  const resolvedInitials = getInitials(firstName, lastName, initials);
  const fillWidth = hasUtilityClass(fallbackClassName, "w-full");
  const fillHeight = hasUtilityClass(fallbackClassName, "h-full");

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-linear-to-br from-[#1f7a45] to-[#013300] font-bold uppercase text-white ${fallbackClassName}`}
      style={{
        width: fillWidth ? "100%" : size,
        height: fillHeight ? "100%" : size,
        fontSize: Math.max(12, Math.round(size * 0.4)),
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      {resolvedInitials}
    </div>
  );
}
