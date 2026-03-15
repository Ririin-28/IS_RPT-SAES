"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Sidebar from "@/components/IT_Admin/Sidebar";
import Header from "@/components/IT_Admin/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";

type RoleLoginData = {
  role: string;
  count: number;
};

type MonthlyGrowthData = {
  month: string;
  totalAccounts: number;
};

type ResponsePoint = {
  time: string;
  responseMs: number;
};

type AnomalyPoint = {
  time: string;
  value: number;
  isAnomaly: boolean;
  metricName?: string;
  expectedValue?: number;
  severity?: "low" | "medium" | "high";
};

type ChartState<T> = {
  data: T[];
  loading: boolean;
  error: string | null;
  empty: boolean;
};

type AnomalyDotProps = {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: AnomalyPoint;
};

interface OverviewData {
  totalUsers: number | null;
  newUsersThisWeek: number | null;
  pendingOnboarding: number | null;
  archivedAccounts: number | null;
}

interface DashboardPayload {
  overview: OverviewData;
  metadata?: {
    newUsersSourceColumn: string | null;
    missingTrustedDeviceColumns?: string[];
    trustedDevicesAvailable?: boolean;
  };
}

type DateRangeValue = "daily" | "weekly" | "30d" | "3m" | "6m";
type RoleFilterValue =
  | "all"
  | "it admin"
  | "principal"
  | "coordinator"
  | "master teacher"
  | "teacher"
  | "parent"
  | "student";

const ROLE_ORDER = ["IT Admin", "Principal", "Coordinator", "Master Teacher", "Teacher", "Parent", "Student"] as const;
const ROLE_FILTER_OPTIONS: RoleFilterValue[] = [
  "all",
  "it admin",
  "principal",
  "coordinator",
  "master teacher",
  "teacher",
  "parent",
  "student",
];
const DATE_RANGE_OPTIONS: Array<{ label: string; value: DateRangeValue }> = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 3 Months", value: "3m" },
  { label: "Last 6 Months", value: "6m" },
];
const MONTH_OPTIONS = [
  { label: "January", value: 1 },
  { label: "February", value: 2 },
  { label: "March", value: 3 },
  { label: "April", value: 4 },
  { label: "May", value: 5 },
  { label: "June", value: 6 },
  { label: "July", value: 7 },
  { label: "August", value: 8 },
  { label: "September", value: 9 },
  { label: "October", value: 10 },
  { label: "November", value: 11 },
  { label: "December", value: 12 },
] as const;
const palette = {
  primary: "#0f766e",
  secondary: "#16a34a",
  muted: "#65a30d",
  text: "#0f172a",
};

function formatRole(value: string) {
  const normalized = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getMonthLabel(value: number | null): string {
  if (!value) return "";
  return MONTH_OPTIONS.find((month) => month.value === value)?.label ?? "";
}

function renderAnomalyDot(props: AnomalyDotProps) {
  const point = props.payload;
  const dotKey = point ? `${point.time}-${point.value}-${props.index ?? 0}` : `dot-${props.index ?? 0}`;

  if (!point?.isAnomaly || typeof props.cx !== "number" || typeof props.cy !== "number") {
    return <circle key={dotKey} cx={props.cx ?? 0} cy={props.cy ?? 0} r={0} fill="transparent" />;
  }

  return <circle key={dotKey} cx={props.cx} cy={props.cy} r={4} fill="#dc2626" stroke="#991b1b" strokeWidth={1} />;
}

function GlassChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/55 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="h-64 sm:h-72">{children}</div>
    </section>
  );
}

function ChartStateFallback({
  state,
  emptyMessage,
}: {
  state: ChartState<unknown>;
  emptyMessage: string;
}) {
  if (state.loading && state.data.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading chart...</div>;
  }

  if (state.error) {
    return <div className="flex h-full items-center justify-center text-sm font-medium text-red-600">{state.error}</div>;
  }

  if (state.empty || state.data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 text-sm font-medium text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return null;
}

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
  const baseClasses = `
    relative group rounded-xl border border-white/70 bg-white/60 px-4 py-3 text-left
    shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl
    transition hover:z-30 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)]
    ${className}
  `;

  const tooltipNode = tooltip ? (
    <span className="pointer-events-none absolute -top-2 left-1/2 z-80 hidden w-56 -translate-x-1/2 -translate-y-full rounded-md bg-slate-700 px-3 py-2 text-center text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:block group-hover:opacity-100">
      {tooltip}
    </span>
  ) : null;

  const content = (
    <>
      {tooltipNode}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold text-slate-900">{value}</p>
          <p className="text-sm font-medium text-slate-600">{label}</p>
        </div>
        {icon && <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">{icon}</span>}
      </div>
    </>
  );

  if (typeof onClick === "function") {
    return (
      <button type="button" onClick={onClick} className={`${baseClasses} focus:outline-none cursor-pointer text-left`}>
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

export default function ITAdminDashboard() {
  const router = useRouter();

  const [overview, setOverview] = useState<OverviewData>({
    totalUsers: null,
    newUsersThisWeek: null,
    pendingOnboarding: null,
    archivedAccounts: null,
  });
  const [metadata, setMetadata] = useState<DashboardPayload["metadata"]>({
    newUsersSourceColumn: null,
  });

  const [loginsState, setLoginsState] = useState<ChartState<RoleLoginData>>({
    data: [],
    loading: true,
    error: null,
    empty: false,
  });
  const [growthState, setGrowthState] = useState<ChartState<MonthlyGrowthData>>({
    data: [],
    loading: true,
    error: null,
    empty: false,
  });
  const [responseState, setResponseState] = useState<ChartState<ResponsePoint>>({
    data: [],
    loading: true,
    error: null,
    empty: false,
  });
  const [anomalyState, setAnomalyState] = useState<ChartState<AnomalyPoint>>({
    data: [],
    loading: true,
    error: null,
    empty: false,
  });

  const [dateRange, setDateRange] = useState<DateRangeValue>("30d");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [monthRangeFrom, setMonthRangeFrom] = useState<number | null>(null);
  const [monthRangeTo, setMonthRangeTo] = useState<number | null>(null);
  const [monthFromMenuOpen, setMonthFromMenuOpen] = useState(false);
  const [monthToMenuOpen, setMonthToMenuOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<RoleFilterValue[]>(["all"]);

  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const roleColorMap: Record<string, string> = {
    "IT Admin": "#0f766e",
    Principal: "#16a34a",
    Coordinator: "#22c55e",
    "Master Teacher": "#4ade80",
    Teacher: "#84cc16",
    Parent: "#14b8a6",
    Student: "#06b6d4",
  };

  const handleNavigation = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router],
  );

  const closeFilterPanel = useCallback(() => {
    setIsFilterModalOpen(false);
    setMonthFromMenuOpen(false);
    setMonthToMenuOpen(false);
  }, []);

  const buildCommonQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set("dateRange", dateRange);
    return params;
  }, [dateRange]);

  const selectedRoleQuery = useMemo(() => {
    if (selectedRoles.includes("all")) return null;
    return selectedRoles.join(",");
  }, [selectedRoles]);

  useEffect(() => {
    let isActive = true;

    const fetchOverview = async () => {
      setIsLoadingOverview(true);
      setOverviewError(null);

      try {
        const response = await fetch("/api/it_admin/dashboard", { cache: "no-store" });
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
          },
        );
        setMetadata(payload.metadata ?? { newUsersSourceColumn: null });
      } catch (error) {
        if (!isActive) return;
        setOverviewError(error instanceof Error ? error.message : "Unable to load dashboard overview.");
      } finally {
        if (isActive) {
          setIsLoadingOverview(false);
        }
      }
    };

    void fetchOverview();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const fetchLoginsPerRole = async () => {
      setLoginsState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const params = buildCommonQuery();
        if (selectedRoleQuery) params.set("roles", selectedRoleQuery);
        if (monthRangeFrom) params.set("monthFrom", String(monthRangeFrom));
        if (monthRangeTo) params.set("monthTo", String(monthRangeTo));

        const response = await fetch(`/api/it_admin/dashboard/logins-per-role?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
        }

        if (!isActive) return;

        const nextData = Array.isArray(payload.data) ? (payload.data as RoleLoginData[]) : [];
        setLoginsState({
          data: nextData,
          loading: false,
          error: null,
          empty: Boolean(payload.empty) || nextData.length === 0,
        });
      } catch (error) {
        if (!isActive) return;
        setLoginsState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Unable to load login analytics.",
        }));
      }
    };

    void fetchLoginsPerRole();

    return () => {
      isActive = false;
    };
  }, [buildCommonQuery, monthRangeFrom, monthRangeTo, selectedRoleQuery]);

  useEffect(() => {
    let isActive = true;

    const fetchMonthlyGrowth = async () => {
      setGrowthState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const params = buildCommonQuery();
        if (selectedRoleQuery) params.set("roles", selectedRoleQuery);
        if (monthRangeFrom) params.set("monthFrom", String(monthRangeFrom));
        if (monthRangeTo) params.set("monthTo", String(monthRangeTo));

        const response = await fetch(`/api/it_admin/dashboard/monthly-growth?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
        }

        if (!isActive) return;

        const nextData = Array.isArray(payload.data) ? (payload.data as MonthlyGrowthData[]) : [];
        setGrowthState({
          data: nextData,
          loading: false,
          error: null,
          empty: Boolean(payload.empty) || nextData.length === 0,
        });
      } catch (error) {
        if (!isActive) return;
        setGrowthState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Unable to load growth analytics.",
        }));
      }
    };

    void fetchMonthlyGrowth();

    return () => {
      isActive = false;
    };
  }, [buildCommonQuery, monthRangeFrom, monthRangeTo, selectedRoleQuery]);


  const chartLoginsByRole = useMemo(() => {
    const roleMap = new Map<string, number>();
    for (const item of loginsState.data) {
      roleMap.set(formatRole(item.role), Number(item.count ?? 0));
    }

    const ordered = ROLE_ORDER.map((role) => ({ role, count: roleMap.get(role) ?? 0 }));

    if (!selectedRoleQuery) {
      return ordered;
    }

    const selected = new Set(selectedRoleQuery.split(",").map((entry) => formatRole(entry)));
    return ordered.filter((item) => selected.has(item.role));
  }, [loginsState.data, selectedRoleQuery]);

  const clearFilters = useCallback(() => {
    setDateRange("30d");
    setMonthRangeFrom(null);
    setMonthRangeTo(null);
    setMonthFromMenuOpen(false);
    setMonthToMenuOpen(false);
    setSelectedRoles(["all"]);
  }, []);

  const toggleRole = useCallback((role: RoleFilterValue) => {
    setSelectedRoles((prev) => {
      if (role === "all") return ["all"];
      const base = prev.filter((item) => item !== "all");
      if (base.includes(role)) {
        const next = base.filter((item) => item !== role);
        return next.length > 0 ? next : ["all"];
      }
      return [...base, role];
    });
  }, []);

  const handlePrintExport = useCallback(() => {
    window.print();
  }, []);

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

  const overviewCards = useMemo(
    () => [
      {
        key: "total-users",
        label: "Total Accounts",
        tooltip: "Total registered accounts.",
        value: overview.totalUsers,
        icon: (
          <svg width="19" height="19" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <path d="M16 3.128a4 4 0 0 1 0 7.744" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <circle cx="9" cy="7" r="4" />
          </svg>
        ),
        onClick: () => handleNavigation("/IT_Admin/accounts"),
      },
      {
        key: "new-users",
        label: "New Accounts",
        tooltip: "Total newly added accounts.",
        value: overview.newUsersThisWeek,
        icon: (
          <svg width="19" height="19" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" x2="19" y1="8" y2="14" />
            <line x1="22" x2="16" y1="11" y2="11" />
          </svg>
        ),
        onClick: () => handleNavigation("/IT_Admin/accounts"),
      },
      {
        key: "pending-users",
        label: "Unverified Accounts",
        tooltip: "Total accounts created but not yet activated by users.",
        value: overview.pendingOnboarding,
        icon: (
          <svg width="19" height="19" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="17" y1="8" x2="22" y2="13" />
            <line x1="22" y1="8" x2="17" y2="13" />
          </svg>
        ),
        onClick: () => handleNavigation("/IT_Admin/logs"),
      },
      {
        key: "archived-users",
        label: "Archived Accounts",
        tooltip: "Total archived accounts.",
        value: overview.archivedAccounts,
        icon: (
          <svg width="19" height="19" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="4" rx="1" />
            <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
        ),
        onClick: () => handleNavigation("/IT_Admin/archive"),
      },
    ],
    [handleNavigation, overview],
  );

  return (
    <div className="dashboard-page flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="no-print">
        <Sidebar />
      </div>

      <div className="print-main flex-1 pt-16 flex flex-col overflow-hidden">
        <div className="no-print">
          <Header title="Dashboard" />
        </div>

        <main className="print-stage flex-1 overflow-hidden">
          <div className="relative p-4 h-full sm:p-5 md:p-6">
            <div className="no-print pointer-events-none absolute -top-16 right-10 h-52 w-52 rounded-full bg-emerald-200/55 blur-3xl" />
            <div className="no-print pointer-events-none absolute bottom-8 left-8 h-56 w-56 rounded-full bg-emerald-100/45 blur-3xl" />

            <div id="it-admin-export-root" className="relative h-full min-h-95 overflow-hidden rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SecondaryHeader title="IT Admin Overview" />
                <div className="no-print flex shrink-0 items-center gap-2">
                  <div className="relative">
                    {isFilterModalOpen && (
                      <button type="button" className="fixed inset-0 z-10 cursor-default" onClick={closeFilterPanel} aria-label="Close filter panel" />
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsFilterModalOpen((prev) => !prev);
                        if (isFilterModalOpen) {
                          setMonthFromMenuOpen(false);
                          setMonthToMenuOpen(false);
                        }
                      }}
                      className="relative z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100"
                      aria-label="Filter dashboard"
                      title="Filter"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="3 4 21 4 14 12 14 19 10 21 10 12 3 4" />
                      </svg>
                    </button>

                    {isFilterModalOpen ? (
                      <div className="absolute right-0 z-20 mt-2 w-[min(58rem,94vw)] rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_24px_48px_rgba(15,23,42,0.22)]">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-base font-semibold text-slate-900">Filter Dashboard</p>
                          <button type="button" onClick={closeFilterPanel} className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900">
                            Close
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-5">
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Global Date Range (all 4 charts)</p>
                            <div className="flex flex-wrap gap-2">
                              {DATE_RANGE_OPTIONS.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => setDateRange(option.value)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                    dateRange === option.value
                                      ? "border-emerald-700 bg-emerald-700 text-white"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-100 p-3">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">User Analytics Filters (Logins per Role + Monthly Growth)</p>
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <p className="mb-2 text-xs font-semibold text-slate-600">Month Range</p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                                  <div className="relative">
                                    {monthFromMenuOpen && <button type="button" className="fixed inset-0 z-10 cursor-default" onClick={() => setMonthFromMenuOpen(false)} aria-label="Close month-from menu" />}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMonthFromMenuOpen((prev) => !prev);
                                        setMonthToMenuOpen(false);
                                      }}
                                      className="relative z-20 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                                    >
                                      <span>{monthRangeFrom ? getMonthLabel(monthRangeFrom) : "From month"}</span>
                                      <span className="text-xs text-slate-500">v</span>
                                    </button>
                                    {monthFromMenuOpen && (
                                      <div className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                                        <button type="button" onClick={() => { setMonthRangeFrom(null); setMonthFromMenuOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Any month</button>
                                        {MONTH_OPTIONS.map((option) => (
                                          <button key={`from-${option.value}`} type="button" onClick={() => { setMonthRangeFrom(option.value); setMonthFromMenuOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">{option.label}</button>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <span className="justify-self-center text-sm font-semibold text-slate-500">to</span>

                                  <div className="relative">
                                    {monthToMenuOpen && <button type="button" className="fixed inset-0 z-10 cursor-default" onClick={() => setMonthToMenuOpen(false)} aria-label="Close month-to menu" />}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMonthToMenuOpen((prev) => !prev);
                                        setMonthFromMenuOpen(false);
                                      }}
                                      className="relative z-20 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                                    >
                                      <span>{monthRangeTo ? getMonthLabel(monthRangeTo) : "To month"}</span>
                                      <span className="text-xs text-slate-500">v</span>
                                    </button>
                                    {monthToMenuOpen && (
                                      <div className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                                        <button type="button" onClick={() => { setMonthRangeTo(null); setMonthToMenuOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Any month</button>
                                        {MONTH_OPTIONS.map((option) => (
                                          <button key={`to-${option.value}`} type="button" onClick={() => { setMonthRangeTo(option.value); setMonthToMenuOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">{option.label}</button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <p className="mb-2 text-xs font-semibold text-slate-600">Role Filter</p>
                                <div className="flex flex-wrap gap-2">
                                  {ROLE_FILTER_OPTIONS.map((roleOption) => {
                                    const label = roleOption === "all" ? "All Roles" : formatRole(roleOption);
                                    const isActive = selectedRoles.includes(roleOption);
                                    return (
                                      <button
                                        key={roleOption}
                                        type="button"
                                        onClick={() => toggleRole(roleOption)}
                                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                          isActive
                                            ? "border-emerald-700 bg-emerald-700 text-white"
                                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                          <button type="button" onClick={clearFilters} className="rounded-md border border-emerald-100 bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-800">
                            Clear All
                          </button>
                          <button type="button" className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800" onClick={closeFilterPanel}>
                            Apply Filters
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={handlePrintExport}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100"
                    aria-label="Print or export dashboard as PDF"
                    title="Print / Export PDF"
                  >
                    <Printer className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {overviewError && (
                <p className="mb-4 text-sm text-red-600" role="alert">
                  {overviewError}
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 sm:gap-5 sm:mb-7 lg:grid-cols-4 lg:gap-6 lg:mb-8">
                {overviewCards.map((card) => {
                  const rawValue = card.value;
                  const displayValue = isLoadingOverview ? "..." : rawValue === null || rawValue === undefined ? "--" : rawValue;
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

              {!isLoadingOverview && overview.newUsersThisWeek === null && (
                <p className="text-xs text-gray-500 mb-4">
                  Unable to compute new users this week. {onboardingHint ?? "Trusted device timestamps are unavailable."}
                </p>
              )}

              <section className="mb-8">
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <GlassChartCard title="Logins per Role" subtitle="Role distribution based on login history logs.">
                    <ChartStateFallback state={loginsState} emptyMessage="No role-based login data for selected filters." />
                    {!loginsState.error && !(loginsState.empty || chartLoginsByRole.length === 0) && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartLoginsByRole}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="role" tick={{ fill: palette.text, fontSize: 11 }} />
                          <YAxis tick={{ fill: palette.text, fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                            {chartLoginsByRole.map((entry) => (
                              <Cell key={entry.role} fill={roleColorMap[entry.role] ?? palette.secondary} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </GlassChartCard>

                  <GlassChartCard title="Monthly System Growth" subtitle="New accounts created per month.">
                    <ChartStateFallback state={growthState} emptyMessage="No monthly growth data for selected filters." />
                    {!growthState.error && !(growthState.empty || growthState.data.length === 0) && (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={growthState.data}>
                          <defs>
                            <linearGradient id="growthFillItAdmin" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="5%" stopColor={palette.secondary} stopOpacity={0.45} />
                              <stop offset="95%" stopColor={palette.secondary} stopOpacity={0.03} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="month" tick={{ fill: palette.text, fontSize: 11 }} />
                          <YAxis tick={{ fill: palette.text, fontSize: 11 }} />
                          <Tooltip />
                          <Area type="monotone" dataKey="totalAccounts" stroke={palette.secondary} strokeWidth={2.5} fill="url(#growthFillItAdmin)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </GlassChartCard>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }

          .no-print {
            display: none !important;
          }

          .dashboard-page,
          .dashboard-page .print-main,
          .dashboard-page .print-stage {
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .dashboard-page .print-main {
            padding-top: 0 !important;
          }

          .dashboard-page .print-stage {
            padding: 0 !important;
          }

          .dashboard-page #it-admin-export-root {
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: #ffffff !important;
            overflow: visible !important;
            height: auto !important;
            padding: 0 !important;
          }

          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
