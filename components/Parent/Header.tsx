"use client";
import React from "react";
import { useRouter } from "next/navigation";
import ProfileDropdown from "../Common/ProfileDropdown";
import { performClientLogout } from "@/lib/utils/logout";
import UserAvatar from "../Common/UserAvatar";
import { useStoredUserProfile } from "@/lib/hooks/useStoredUserProfile";
import { useNotifications } from "@/lib/hooks/useNotifications";

interface ParentHeaderProps {
  title?: string;
  onSearch?: (query: string) => void;
  childOptions?: Array<{ id: string; label: string }>;
  selectedChildId?: string | null;
  onChildSelect?: (childId: string) => void;
  offsetForSidebar?: boolean;
}

export default function ParentHeader({
  title,
  childOptions,
  selectedChildId,
  onChildSelect,
  offsetForSidebar = false,
}: ParentHeaderProps) {
  const storedProfile = useStoredUserProfile();
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [studentIds, setStudentIds] = React.useState<string[]>([]);
  const router = useRouter();
  const profileBtnRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const notificationBtnRef = React.useRef<HTMLButtonElement>(null);
  const notificationDropdownRef = React.useRef<HTMLDivElement>(null);

  const {
    notifications,
    loading: notificationsLoading,
    error: notificationsError,
    unreadCount,
    loadNotifications,
    markNotificationRead,
    markAllRead,
  } = useNotifications({
    endpoint: "/api/parent/notifications",
    enabled: studentIds.length > 0,
    pollIntervalMs: 60000,
    queryParams: {
      studentIds: studentIds.join(","),
    },
  });

  React.useEffect(() => {
    const fromProps = Array.isArray(childOptions)
      ? childOptions
          .map((option) => String(option.id ?? "").trim())
          .filter((value) => value.length > 0)
      : [];

    if (fromProps.length > 0) {
      setStudentIds(Array.from(new Set(fromProps)));
      return;
    }

    const rawUserId = storedProfile?.userId;
    const normalizedUserId =
      typeof rawUserId === "number"
        ? rawUserId
        : typeof rawUserId === "string" && rawUserId.trim()
          ? Number(rawUserId)
          : NaN;

    if (!Number.isFinite(normalizedUserId)) {
      setStudentIds([]);
      return;
    }

    const controller = new AbortController();

    const loadStudentIds = async () => {
      try {
        const response = await fetch(
          `/api/parent/dashboard?userId=${encodeURIComponent(String(normalizedUserId))}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const payload = (await response.json().catch(() => null)) as {
          children?: Array<{ studentId?: string | number | null; student_id?: string | number | null; id?: string | number | null }>;
          child?: { studentId?: string | number | null; student_id?: string | number | null; id?: string | number | null };
        } | null;

        if (!response.ok || !payload) {
          setStudentIds([]);
          return;
        }

        const values = new Set<string>();
        const addValue = (value: unknown) => {
          if (value === null || value === undefined) return;
          const text = String(value).trim();
          if (text) {
            values.add(text);
          }
        };

        if (Array.isArray(payload.children)) {
          payload.children.forEach((child) => {
            addValue(child.studentId ?? child.student_id ?? child.id);
          });
        }

        if (payload.child) {
          addValue(payload.child.studentId ?? payload.child.student_id ?? payload.child.id);
        }

        setStudentIds(Array.from(values));
      } catch {
        setStudentIds([]);
      }
    };

    void loadStudentIds();

    return () => controller.abort();
  }, [childOptions, storedProfile?.userId]);

  React.useEffect(() => {
    if (!showNotifications) {
      return;
    }
    void loadNotifications();
  }, [loadNotifications, showNotifications]);

  // Hide dropdowns when clicking outside
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target;
      if (target instanceof Element && target.closest("[data-logout-modal-card='true']")) {
        return;
      }
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

  return (
    <>
      {/* Page Header (for dashboard, etc.) */}
      {title && (
        <header
          className={`fixed inset-x-3 top-3 z-30 transition-all ${offsetForSidebar ? "lg:left-[21rem] lg:right-5" : ""}`}
        >
          <div className="mx-auto flex items-center justify-between gap-4 rounded-[24px] border border-[#DCE6DD] bg-white px-4 py-3 shadow-sm sm:px-6">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6a816f]">Parent Portal</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="truncate text-lg font-semibold tracking-tight text-[#0C3B1F] md:text-2xl">{title}</span>
                {childOptions && childOptions.length > 1 ? (
                  <span className="inline-flex items-center rounded-full border border-[#D7E3D9] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#4F6657]">
                    {childOptions.length} students
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-sm text-[#5B6F61]">
                {storedProfile?.firstName ? `Welcome back, ${storedProfile.firstName}.` : "Monitor your child's progress."}
              </p>
            </div>

            <div className="relative flex items-center">
            <div className="relative">
              <button
                ref={notificationBtnRef}
                className="relative mr-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#DCE6DD] bg-white text-[#0C3B1F] shadow-sm transition-colors hover:bg-[#F5F8F5]"
                aria-label="Notifications"
                onClick={() => setShowNotifications((prev) => !prev)}
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
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  ref={notificationDropdownRef}
                  className={`
                    fixed sm:absolute right-0 sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[24rem] max-w-md
                    rounded-[20px] border border-[#E2EAE3] bg-white shadow-lg z-50 max-h-[70vh] overflow-y-auto
                    transform transition-all duration-200 ease-out
                    ${showNotifications ? "opacity-100 scale-100" : "opacity-0 scale-95"}
                    left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0
                  `}
                >
                  <div className="sticky top-0 flex items-center justify-between border-b border-[#E7ECE8] bg-white px-5 py-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#68806D]">Updates</p>
                      <h3 className="text-base font-semibold text-[#0C3B1F]">Notifications</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      {notifications.length > 0 && unreadCount > 0 && (
                        <button
                          className="text-sm font-medium text-[#0C6932] hover:text-[#084D24]"
                          onClick={() => {
                            void markAllRead();
                          }}
                        >
                          Mark all as read
                        </button>
                      )}
                      <button
                        className="text-sm font-medium text-[#0C6932] hover:text-[#084D24]"
                        onClick={() => setShowNotifications(false)}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {notificationsLoading && (
                    <div className="px-5 py-8 text-center text-sm text-[#5B6F61]">Loading notifications...</div>
                  )}

                  {!notificationsLoading && notificationsError && (
                    <div className="px-4 py-6 text-center text-sm text-red-600">{notificationsError}</div>
                  )}

                  {!notificationsLoading && !notificationsError && notifications.length === 0 && (
                    <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
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
                      <p className="text-[#5B6F61]">No notifications at this time</p>
                    </div>
                  )}

                  {!notificationsLoading && !notificationsError && notifications.length > 0 && (
                    <div className="divide-y divide-[#EDF2EE] px-2 pb-2">
                      {notifications.map((note) => (
                        <button
                          type="button"
                          key={note.id}
                          className={`mt-2 w-full rounded-2xl px-4 py-4 text-left transition hover:bg-[#F4F8F5] ${
                            note.status === "unread" ? "bg-[#EEF8F0]" : "bg-white"
                          }`}
                          onClick={() => {
                            void markNotificationRead(note.id, { persist: note.id > 0 });
                            setShowNotifications(false);
                            router.push(note.targetUrl ?? "/Parent/notifications");
                          }}
                        >
                          <p className="text-sm font-medium leading-6 text-[#294233]">{note.message}</p>
                          <p className="mt-2 text-xs text-[#7B8F80]">
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
                </div>
              )}
            </div>

            <button
              ref={profileBtnRef}
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[#D6E3D8] bg-[#0C3B1F] p-0.5 shadow-sm transition-colors hover:bg-[#125428]"
              aria-label="Profile"
              onClick={() => setShowDropdown((v) => !v)}
            >
              <div className="h-full w-full overflow-hidden rounded-full border border-white/50">
                <UserAvatar
                  profileImageUrl={storedProfile?.profileImageUrl}
                  firstName={storedProfile?.firstName}
                  lastName={storedProfile?.lastName}
                  alt="Parent profile"
                  imageClassName="h-full w-full object-cover"
                  fallbackClassName="h-full w-full"
                  size={40}
                />
              </div>
            </button>
            {showDropdown && (
              <div ref={dropdownRef}>
                <ProfileDropdown
                  onProfile={() => {
                    setShowDropdown(false);
                    router.push("/Parent/profile");
                  }}
                  onLogout={() => {
                    setShowDropdown(false);
                    performClientLogout(router);
                  }}
                  childOptions={childOptions}
                  selectedChildId={selectedChildId}
                  onChildSelect={(childId) => {
                    setShowDropdown(false);
                    onChildSelect?.(childId);
                  }}
                />
              </div>
            )}
          </div>
          </div>
        </header>
      )}
    </>
  );
}
