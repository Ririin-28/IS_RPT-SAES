"use client";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import ProfileDropdown from "../Common/ProfileDropdown";
import { performClientLogout } from "@/lib/utils/logout";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { normalizeMaterialSubject } from "@/lib/materials/shared";

interface HeaderProps {
  title?: string;
  onSearch?: (query: string) => void;
}

type MaterialNotificationItem = {
  id: string;
  source: "Teacher" | "Remedial Teacher";
  title: string;
  createdAt: string;
};

const toReadableDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return parsed.toLocaleString();
};

export default function MasterTeacherHeader({ title }: HeaderProps) {
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [notifications, setNotifications] = React.useState<MaterialNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loadingNotifications, setLoadingNotifications] = React.useState(false);
  const [notificationsError, setNotificationsError] = React.useState<string | null>(null);
  const profileBtnRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const notificationBtnRef = React.useRef<HTMLButtonElement>(null);
  const notificationDropdownRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isCoordinatorView = Boolean(pathname?.startsWith("/MasterTeacher/Coordinator"));

  const syncRoleContext = React.useCallback(async (roleContext: "coordinator" | "remedial") => {
    try {
      await fetch("/api/master_teacher/session/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleContext }),
      });
    } catch {
      // ignore sync failures
    }
  }, []);

  const handleRoleSwitch = React.useCallback(
    (targetPath: string) => {
      setShowDropdown(false);
      if (pathname !== targetPath) {
        const nextRole = targetPath.startsWith("/MasterTeacher/Coordinator") ? "coordinator" : "remedial";
        void syncRoleContext(nextRole);
        router.push(targetPath);
      }
    },
    [pathname, router, syncRoleContext]
  );

  const roleOptions = React.useMemo(() => {
    if (!pathname) return undefined;
    const isCoordinator = pathname.startsWith("/MasterTeacher/Coordinator");
    const isRemedial = pathname.startsWith("/MasterTeacher/RemedialTeacher");

    if (!isCoordinator && !isRemedial) {
      return undefined;
    }

    return [
      {
        label: "Coordinator View",
        active: isCoordinator,
        onSelect: () => handleRoleSwitch("/MasterTeacher/Coordinator/dashboard"),
      },
      {
        label: "Remedial Teacher View",
        active: isRemedial,
        onSelect: () => handleRoleSwitch("/MasterTeacher/RemedialTeacher/dashboard"),
      },
    ];
  }, [handleRoleSwitch, pathname]);

  React.useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/MasterTeacher/Coordinator")) {
      void syncRoleContext("coordinator");
    } else if (pathname.startsWith("/MasterTeacher/RemedialTeacher")) {
      void syncRoleContext("remedial");
    }
  }, [pathname, syncRoleContext]);

  const loadCoordinatorNotifications = React.useCallback(async () => {
    if (!isCoordinatorView) {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError(null);
      return;
    }

    setLoadingNotifications(true);
    setNotificationsError(null);

    try {
      const profile = getStoredUserProfile();
      const userId = profile?.userId ? String(profile.userId).trim() : "";

      if (!userId) {
        setNotifications([]);
        setUnreadCount(0);
        setNotificationsError("Unable to load coordinator profile.");
        return;
      }

      const profileResponse = await fetch(
        `/api/master_teacher/coordinator/profile?userId=${encodeURIComponent(userId)}`,
        { cache: "no-store" },
      );
      const profilePayload = await profileResponse.json().catch(() => null);
      const subjectCandidate =
        profilePayload?.coordinator?.coordinatorSubject ?? profilePayload?.coordinator?.subjectsHandled ?? null;
      const normalizedSubject = normalizeMaterialSubject(subjectCandidate);

      if (!profileResponse.ok || !profilePayload?.success || !normalizedSubject) {
        setNotifications([]);
        setUnreadCount(0);
        setNotificationsError("Coordinator subject is not available.");
        return;
      }

      const teacherParams = new URLSearchParams({
        subject: normalizedSubject,
        status: "pending",
        pageSize: "25",
      });
      const remedialParams = new URLSearchParams({
        subject: normalizedSubject,
        status: "pending",
        pageSize: "25",
      });

      const [teacherRes, remedialRes] = await Promise.all([
        fetch(`/api/materials?${teacherParams.toString()}`, { cache: "no-store" }),
        fetch(`/api/master_teacher/coordinator/materials?${remedialParams.toString()}`, { cache: "no-store" }),
      ]);

      const teacherPayload = await teacherRes.json().catch(() => null);
      const remedialPayload = await remedialRes.json().catch(() => null);

      const teacherRows: Array<Record<string, unknown>> = Array.isArray(teacherPayload?.data) ? teacherPayload.data : [];
      const remedialRows: Array<Record<string, unknown>> = Array.isArray(remedialPayload?.data) ? remedialPayload.data : [];

      const teacherItems: MaterialNotificationItem[] = teacherRows.map((row, index) => ({
        id: `teacher-${String(row.id ?? row.material_id ?? index)}`,
        source: "Teacher",
        title: typeof row.title === "string" && row.title.trim().length > 0 ? row.title.trim() : "Teacher submitted a material",
        createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
      }));

      const remedialItems: MaterialNotificationItem[] = remedialRows.map((row, index) => ({
        id: `remedial-${String(row.material_id ?? row.id ?? index)}`,
        source: "Remedial Teacher",
        title:
          typeof row.title === "string" && row.title.trim().length > 0
            ? row.title.trim()
            : "Remedial teacher submitted a material",
        createdAt:
          typeof row.submitted_at === "string"
            ? row.submitted_at
            : typeof row.created_at === "string"
              ? row.created_at
              : new Date().toISOString(),
      }));

      const merged = [...teacherItems, ...remedialItems].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

      const teacherTotal = Number(teacherPayload?.pagination?.total ?? teacherItems.length);
      const remedialTotal = Number(remedialPayload?.pagination?.total ?? remedialItems.length);
      const totalPending = teacherTotal + remedialTotal;

      setNotifications(merged);
      setUnreadCount(Number.isFinite(totalPending) ? totalPending : merged.length);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError("Failed to load notifications.");
    } finally {
      setLoadingNotifications(false);
    }
  }, [isCoordinatorView]);

  React.useEffect(() => {
    void loadCoordinatorNotifications();
    if (!isCoordinatorView) return;

    const timer = window.setInterval(() => {
      void loadCoordinatorNotifications();
    }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isCoordinatorView, loadCoordinatorNotifications]);

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

  return (
    <>
      {/* Page Header (for dashboard, etc.) */}
      {title && (
        <header
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
                ref={notificationBtnRef}
                className="relative w-10 h-10 flex items-center justify-center hover:scale-[1.08] transition mr-4" 
                aria-label="Notifications"
                onClick={() => {
                  const willOpen = !showNotifications;
                  setShowNotifications(willOpen);
                  if (willOpen) {
                    void loadCoordinatorNotifications();
                  }
                }}
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
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
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
                  
                  {loadingNotifications ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">Loading notifications...</div>
                  ) : notificationsError ? (
                    <div className="px-4 py-8 text-center text-sm text-red-500">{notificationsError}</div>
                  ) : notifications.length === 0 ? (
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
                      <p className="text-gray-500">No pending material submissions.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {notifications.map((notification) => (
                        <div key={notification.id} className="px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#013300]">
                            {notification.source}
                          </p>
                          <p className="text-sm text-gray-800 mt-1">{notification.title}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {toReadableDateTime(notification.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
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
                    router.push("/MasterTeacher/RemedialTeacher/profile");
                  }}
                  onLogout={() => {
                    setShowDropdown(false);
                    performClientLogout(router);
                  }}
                  roleOptions={roleOptions}
                />
              </div>
            )}
          </div>
        </header>
      )}
    </>
  );
}
