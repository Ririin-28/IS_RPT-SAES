"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiBell } from "react-icons/fi";
import { useMemo } from "react";
import { useNotifications } from "@/lib/hooks/useNotifications";

export default function FloatingNotificationBell() {
  const pathname = usePathname();
  const { notifications } = useNotifications({
    endpoint: "/api/parent/notifications",
    enabled: Boolean(pathname) && pathname !== "/Parent/welcome" && !pathname?.startsWith("/Parent/notifications"),
    pollIntervalMs: 60000,
  });

  const unreadBadgeCount = useMemo(
    () => notifications.reduce((count, note) => count + (note.id > 0 && note.status === "unread" ? 1 : 0), 0),
    [notifications],
  );

  if (!pathname || pathname === "/Parent/welcome" || pathname.startsWith("/Parent/notifications")) {
    return null;
  }

  return (
    <Link
      href="/Parent/notifications"
      aria-label="Open notifications"
      className="fixed bottom-20 right-3 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[#DCE6DD] bg-white text-[#0C3B1F] shadow-md transition hover:bg-[#F7FBF7] lg:bottom-6 lg:right-6 lg:h-14 lg:w-14 lg:shadow-lg"
    >
      <FiBell className="text-xl lg:text-[1.35rem]" />
      {unreadBadgeCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
          {unreadBadgeCount > 99 ? "99+" : unreadBadgeCount}
        </span>
      )}
    </Link>
  );
}
