"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Super_Admin/Sidebar";
import Header from "@/components/Super_Admin/Header";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";

import TableList from "@/components/Common/Tables/TableList";

interface OverviewData {
  totalUsers: number | null;
  newUsersThisWeek: number | null;
  pendingOnboarding: number | null;
  archivedAccounts: number | null;
}

interface RecentLogin {
  id: number;
  userId: number | null;
  role?: string;
  name?: string | null;
  email?: string;
  status?: string;
  loginTime: string | null;
}

interface DashboardPayload {
  overview: OverviewData;
  metadata?: {
    newUsersSourceColumn: string | null;
    missingTrustedDeviceColumns?: string[];
    trustedDevicesAvailable?: boolean;
  };
  recentLogins: RecentLogin[];
}

// OverviewCard component with responsive styles
function OverviewCard({
  value,
  label,
  icon,
  className = "",
  onClick,
  tooltip,
}: {
  value: React.ReactNode;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  tooltip?: string;
}) {
  // Sanitize string values to prevent XSS
  const sanitizeContent = (content: any): React.ReactNode => {
    if (typeof content === 'string') {
      // For strings, create a text node instead of rendering HTML
      return content;
    }
    return content;
  };

    const baseClasses = `
      /* Mobile */
      relative group rounded-2xl border border-white/70 bg-white/60 shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl
      flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px]
    transition duration-200 hover:border-gray-200 hover:bg-white/70

      /* Tablet */
      sm:p-6 sm:min-w-[180px] sm:min-h-[120px]

      /* Desktop */
      lg:p-7
      ${className}
    `;

  const tooltipNode = tooltip ? (
    <span className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden w-56 -translate-x-1/2 -translate-y-full rounded-md bg-slate-700 px-3 py-2 text-center text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:block group-hover:opacity-100">
      {tooltip}
    </span>
  ) : null;

  const content = (
    <>
      {tooltipNode}
      <div className="flex flex-row items-center">
        <span
          className="
          /* Mobile */
          text-4xl font-semibold text-slate-900

          /* Tablet */
          sm:text-5xl
        "
        >
          {sanitizeContent(value)}
        </span>
        {icon && (
          <span
            className="
          /* Mobile */
          ml-1

          /* Tablet */
          sm:ml-2
        "
          >
            {icon}
          </span>
        )}
      </div>
      <div
        className="
        /* Mobile */
        text-slate-600 text-sm font-medium mt-1 tracking-wide

        /* Tablet */
        sm:text-base sm:mt-2
      "
      >
        {sanitizeContent(label)}
      </div>
    </>
  );

  if (typeof onClick === "function") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClasses} focus:outline-none cursor-pointer text-left`}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}


function formatDateTime(dt: string | null | undefined) {
  if (!dt) return "—";
  const date = new Date(dt);
  if (Number.isNaN(date.getTime())) {
    return dt;
  }
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ITAdminDashboard() {
  const router = useRouter();
  const handleNavigation = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  const [overview, setOverview] = useState<OverviewData>({
    totalUsers: null,
    newUsersThisWeek: null,
    pendingOnboarding: null,
    archivedAccounts: null,
  });
  const [recentLogins, setRecentLogins] = useState<RecentLogin[]>([]);
  const [metadata, setMetadata] = useState<DashboardPayload["metadata"]>({
    newUsersSourceColumn: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const fetchDashboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
  const response = await fetch("/api/super_admin/dashboard", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as DashboardPayload;
        if (!isActive) return;
        setOverview(
          payload.overview ?? {
            totalUsers: null,
            newUsersThisWeek: null,
            pendingOnboarding: null,
            archivedAccounts: null,
          }
        );
        setRecentLogins(payload.recentLogins ?? []);
        setMetadata(payload.metadata ?? { newUsersSourceColumn: null });
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchDashboard();

    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overviewCards = useMemo(
    () => [
      {
        key: "total-users",
        label: "Total Accounts",
        tooltip: "Total registered accounts.",
        value: overview.totalUsers,
        icon: (
          <svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <path d="M16 3.128a4 4 0 0 1 0 7.744" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <circle cx="9" cy="7" r="4" />
          </svg>
        ),
        onClick: () => handleNavigation("/Super_Admin/accounts"),
      },
      {
        key: "new-users",
        label: "New Accounts",
        tooltip: "Total newly added accounts.",
        value: overview.newUsersThisWeek,
        icon: (
          <svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" x2="19" y1="8" y2="14" />
            <line x1="22" x2="16" y1="11" y2="11" />
          </svg>
        ),
        onClick: () => handleNavigation("/Super_Admin/accounts"),
      },
      {
        key: "pending-users",
        label: "Unverified Accounts",
        tooltip: "Total accounts created but not yet activated by users.",
        value: overview.pendingOnboarding,
        icon: (
          <svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 14v2.2l1.6 1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v.832" />
            <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2" />
            <circle cx="16" cy="16" r="6" />
            <rect x="8" y="2" width="8" height="4" rx="1" />
          </svg>
        ),
        onClick: () => handleNavigation("/Super_Admin/operations-log"),
      },
      {
        key: "archived-users",
        label: "Archived Accounts",
        tooltip: "Total archived accounts.",
        value: overview.archivedAccounts,
        icon: (
          <svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.929 4.929 19.07 19.071" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        ),
        onClick: () => handleNavigation("/Super_Admin/recovery"),
      },
    ],
    [overview, handleNavigation]
  );

  const tableColumns = useMemo(
    () => [
      { key: "name", title: "User", render: (row: any) => row.name ?? "Unknown" },
      { key: "role", title: "Role" },
      { key: "loginTime", title: "Login Time", render: (row: any) => formatDateTime(row.loginTime) },
      {
        key: "status",
        title: "Status",
        render: (row: any) => {
          const statusLabel = typeof row.status === "string" ? row.status : "Offline";
          const normalized = statusLabel.toLowerCase();
          const isOnline = normalized === "online";
          const display = isOnline ? "Online" : "Offline";
          const className = isOnline ? "text-green-600" : "text-gray-500";

          return <span className={`font-semibold ${className}`}>{display}</span>;
        },
      },
    ],
    []
  );

  const tableData = useMemo(() => {
    if (isLoading) {
      return [];
    }
    return recentLogins.map((entry) => ({
      ...entry,
      role: entry.role ? entry.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—",
      status:
        typeof entry.status === "string" && entry.status.toLowerCase() === "online"
          ? "Online"
          : "Offline",
    }));
  }, [isLoading, recentLogins]);

  const onboardingHint = useMemo(() => {
    if (!metadata) {
      return null;
    }

    if (metadata.trustedDevicesAvailable === false) {
      return "The trusted_devices table is missing. Add trusted device records to enable onboarding metrics.";
    }

    const columns = metadata.missingTrustedDeviceColumns;
    if (columns && columns.length > 0) {
      return `Ensure the trusted_devices table includes one of these timestamp columns: ${columns.join(", ")}.`;
    }

    return metadata.newUsersSourceColumn
      ? `Using ${metadata.newUsersSourceColumn} to determine when devices were registered.`
      : null;
  }, [metadata]);

  return (
    <div className="flex h-screen bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec] overflow-hidden">
      {/*---------------------------------Sidebar---------------------------------*/}
      <Sidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Dashboard" />

        <main className="flex-1 overflow-y-auto">
          <div className="relative p-4 h-full sm:p-5 md:p-6">
            <div className="pointer-events-none absolute -top-16 right-10 h-52 w-52 rounded-full bg-emerald-200/55 blur-3xl" />
            <div className="pointer-events-none absolute bottom-8 left-8 h-56 w-56 rounded-full bg-emerald-100/45 blur-3xl" />
            {/*---------------------------------Main Container---------------------------------*/}
            <div className="relative h-full min-h-95 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">
              {/* Overview Cards Section */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <SecondaryHeader title="Super Admin Overview" />
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 sm:gap-5 sm:mb-7 lg:grid-cols-4 lg:gap-6 lg:mb-8">
                {overviewCards.map((card) => {
                  const rawValue = card.value;
                  const displayValue = isLoading
                    ? "…"
                    : rawValue === null || rawValue === undefined
                      ? "—"
                      : rawValue;
                  return (
                    <OverviewCard
                      key={card.key}
                      value={displayValue}
                      label={card.label}
                      tooltip={card.tooltip}
                      icon={card.icon}
                      onClick={card.onClick}
                    />
                  );
                })}
              </div>
              {!isLoading && overview.newUsersThisWeek === null && (
                <p className="text-xs text-gray-500 mb-4">
                  Unable to compute new users this week. {onboardingHint ?? "Trusted device timestamps are unavailable."}
                </p>
              )}
              {/* Recent Logins Table Section */}
              <div className="mt-8">
                <TertiaryHeader title="Recent Logins" />
                <TableList columns={tableColumns} data={tableData} pageSize={5} hidePagination={true} />
                {isLoading && (
                  <p className="mt-3 text-sm text-gray-500">Loading recent logins…</p>
                )}
                {!isLoading && tableData.length === 0 && !error && (
                  <p className="mt-3 text-sm text-gray-500">No login activity recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
