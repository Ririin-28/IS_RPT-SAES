"use client";
import React from "react";
import { useRouter } from "next/navigation";
import ProfileDropdown from "../Common/ProfileDropdown";
import { performClientLogout } from "@/lib/utils/logout";

interface PrincipalHeaderProps {
  title?: string;
}

export default function PrincipalHeader({ title }: PrincipalHeaderProps) {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Array<{
    id: number;
    message: string;
    status: "unread" | "read";
    createdAt: string;
  }>>([]);
  const [notificationsLoading, setNotificationsLoading] = React.useState(false);
  const [notificationsError, setNotificationsError] = React.useState<string | null>(null);
  const profileBtnRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const notificationBtnRef = React.useRef<HTMLButtonElement>(null);
  const notificationDropdownRef = React.useRef<HTMLDivElement>(null);

  // Hide dropdowns when clicking outside
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!profileBtnRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (!notificationBtnRef.current?.contains(e.target as Node) && !notificationDropdownRef.current?.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showDropdown || showNotifications) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDropdown, showNotifications]);

  React.useEffect(() => {
    if (!showNotifications) {
      return;
    }

    const controller = new AbortController();
    let isCancelled = false;

    const loadNotifications = async () => {
      setNotificationsLoading(true);
      setNotificationsError(null);
      try {
        const response = await fetch("/api/principal/notifications", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          notifications?: Array<{
            id?: number | string;
            message?: string | null;
            status?: "unread" | "read" | null;
            createdAt?: string | null;
            created_at?: string | null;
          }>;
          error?: string | null;
        } | null;

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? "Failed to load notifications.");
        }

        if (isCancelled) {
          return;
        }

        setNotifications(
          Array.isArray(payload.notifications)
            ? payload.notifications.map((note) => ({
                id: Number(note.id ?? 0),
                message: note.message ?? "",
                status: note.status === "read" ? "read" : "unread",
                createdAt: note.createdAt ?? note.created_at ?? new Date().toISOString(),
              }))
            : [],
        );

        await fetch("/api/principal/notifications", { method: "PATCH", cache: "no-store" });
        if (!isCancelled) {
          setNotifications((prev) => prev.map((note) => ({ ...note, status: "read" })));
        }
      } catch (error) {
        if (isCancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setNotificationsError(error instanceof Error ? error.message : "Failed to load notifications.");
        setNotifications([]);
      } finally {
        if (!isCancelled) {
          setNotificationsLoading(false);
        }
      }
    };

    loadNotifications();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [showNotifications]);

  const unreadCount = notifications.filter((note) => note.status === "unread").length;

  const handleNotificationClick = () => {
    setShowNotifications(false);
    router.push("/Principal/requests");
  };

  return (
    <>
      {/* Page Header (for dashboard, etc.) */}
      {title && (
        <header
          suppressHydrationWarning
          className={`
            /* Mobile */
            fixed top-2 left-20 right-4 h-16 flex items-center justify-between px-4 bg-green-50 shadow-md z-30 rounded-xl transition-all
            /* Desktop */
            md:left-70 md:px-8 md:right-6
          `}
        >
          <span className="text-base font-semibold text-[#013300] tracking-wide md:text-lg">{title}</span>
          {/* Profile Icon */}
          <div className="relative flex items-center">
            {/* Notification Button */}
            <div className="relative">
              <button
                suppressHydrationWarning
                ref={notificationBtnRef}
                className="relative w-10 h-10 flex items-center justify-center hover:scale-[1.08] transition mr-4" 
                aria-label="Notifications"
                onClick={() => setShowNotifications(prev => !prev)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#013300"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-bell-icon lucide-bell"
                >
                  <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                  <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div 
                  ref={notificationDropdownRef}
                  className={`
                    fixed sm:absolute right-0 sm:right-0 mt-2 w-[calc(100vw-3rem)] sm:w-80 max-w-md 
                    bg-white rounded-lg shadow-lg z-50 border border-gray-200 max-h-[70vh] overflow-y-auto
                    transform transition-all duration-200 ease-out
                    ${showNotifications ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
                    left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0
                  `}
                >
                  <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">Notifications</h3>
                    <button 
                      className="text-sm text-green-600 hover:text-green-800"
                      onClick={() => setShowNotifications(false)}
                    >
                      Close
                    </button>
                  </div>
                  
                  {notificationsLoading && (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">Loading notifications...</div>
                  )}

                  {!notificationsLoading && notificationsError && (
                    <div className="px-4 py-6 text-center text-sm text-red-600">{notificationsError}</div>
                  )}

                  {!notificationsLoading && !notificationsError && notifications.length === 0 && (
                    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#9CA3AF"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mb-4"
                      >
                        <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                        <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
                      </svg>
                      <p className="text-gray-500">No notifications at this time</p>
                      <p className="text-sm text-gray-400 mt-1">You&apos;ll see notifications here when you get them</p>
                    </div>
                  )}

                  {!notificationsLoading && !notificationsError && notifications.length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {notifications.map((note) => (
                        <button
                          type="button"
                          key={note.id}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50"
                          onClick={handleNotificationClick}
                        >
                          <p className="text-sm text-gray-700">{note.message}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(note.createdAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Footer removed since there are no notifications to mark as read */}
                </div>
              )}
            </div>
            <button
              suppressHydrationWarning
              ref={profileBtnRef}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-[#013300] 
              hover:border-[#013300] hover:border-2 hover:scale-[1.08] hover:shadow transition"
              aria-label="Profile"
              onClick={() => setShowDropdown((v) => !v)}
            >
              <svg width="32" height="32" fill="none" stroke="#013300" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20v-2c0-2.5 3.5-4 8-4s8 1.5 8 4v2" />
              </svg>
            </button>
            {showDropdown && (
              <div ref={dropdownRef}>
                <ProfileDropdown
                  onProfile={() => {
                    setShowDropdown(false);
                    router.push("/Principal/profile");
                  }}
                  onLogout={() => {
                    setShowDropdown(false);
                    performClientLogout(router);
                  }}
                />
              </div>
            )}
          </div>
        </header>
      )}
    </>
  );
}
