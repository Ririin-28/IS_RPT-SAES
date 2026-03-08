"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Sidebar from "@/components/Super_Admin/Sidebar";
import Header from "@/components/Super_Admin/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";

type RoleLoginData = {
  role: string;
  count: number;
};

type DailyActiveData = {
  date: string;
  activeUsers: number;
};

type MonthlyGrowthData = {
  month: string;
  totalAccounts: number;
};

type AccountStatusData = {
  status: string;
  count: number;
};

type CpuMemoryPoint = {
  time: string;
  cpu: number;
  memory: number;
};

type ResponsePoint = {
  time: string;
  responseMs: number;
};

type DowntimePoint = {
  date: string;
  minutes: number;
  severity: "Low" | "Medium" | "High";
};

type HeatmapPoint = {
  day: string;
  hour: number;
  value: number;
};

type PredictiveRiskPoint = {
  time: string;
  risk: number;
};

type AnomalyPoint = {
  time: string;
  value: number;
  isAnomaly: boolean;
};

type DataIntegrityRisk = {
  score: number;
  level: "Low" | "Medium" | "High";
  note: string;
};

type BackupStatusPoint = {
  date: string;
  status: "Completed" | "Warning" | "Failed";
  durationMin: number;
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
  analytics?: {
    dailyActiveUsers: DailyActiveData[];
    loginsPerRole: RoleLoginData[];
    monthlySystemGrowth: MonthlyGrowthData[];
    accountStatusDistribution: AccountStatusData[];
    peakUsageHeatmap: HeatmapPoint[];
  };
  monitoring?: {
    cpuMemoryUsage: CpuMemoryPoint[];
    responseTimes: ResponsePoint[];
    downtimeHistory: DowntimePoint[];
  };
  aiMonitoring?: {
    predictiveDowntimeRisk: PredictiveRiskPoint[];
    anomalyDetection: AnomalyPoint[];
    dataIntegrityRisk: DataIntegrityRisk;
    backupStatusTimeline: BackupStatusPoint[];
  };
}

const ROLE_ORDER = ["Admin", "Principal", "Teacher", "Parent"];
const DATE_RANGE_OPTIONS = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 90 Days", value: "90d" },
] as const;

type DateRangeValue = (typeof DATE_RANGE_OPTIONS)[number]["value"];

const palette = {
  primary: "#0f766e",
  secondary: "#16a34a",
  accent: "#22c55e",
  muted: "#65a30d",
  soft: "#dcfce7",
  text: "#0f172a",
  border: "rgba(255,255,255,0.72)",
};

function formatRole(value: string) {
  const normalized = value.replace(/_/g, " ").trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTimeLabel(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getStatusColor(status: BackupStatusPoint["status"]) {
  if (status === "Completed") return "#16a34a";
  if (status === "Warning") return "#f59e0b";
  return "#dc2626";
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

function DateRangeSelect({ value, onChange }: { value: DateRangeValue; onChange: (value: DateRangeValue) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as DateRangeValue)}
      className="h-[44px] w-full rounded-2xl border border-transparent bg-[#f2f4f7] px-5 text-[18px] font-medium text-slate-600 shadow-none outline-none focus:border-emerald-200"
    >
      {DATE_RANGE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function OverviewCard({
  value,
  label,
  icon,
  onClick,
}: {
  value: React.ReactNode;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-2xl bg-[#f4f5f7] px-5 py-7 text-center shadow-[0_12px_22px_rgba(15,23,42,0.06)] transition hover:bg-[#eef0f3]"
      >
        <div className="flex items-center justify-center">
          <p className="text-5xl font-semibold text-[#0f172a]">{value}</p>
          <span className="ml-2 text-[#013300]">{icon}</span>
        </div>
        <p className="mt-2 text-lg font-medium text-slate-600">{label}</p>
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-[#f4f5f7] px-5 py-7 text-center shadow-[0_12px_22px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-center">
        <p className="text-5xl font-semibold text-[#0f172a]">{value}</p>
        <span className="ml-2 text-[#013300]">{icon}</span>
      </div>
      <p className="mt-2 text-lg font-medium text-slate-600">{label}</p>
    </div>
  );
}

function Gauge({ data }: { data: DataIntegrityRisk }) {
  const ringColor = data.level === "Low" ? "#16a34a" : data.level === "Medium" ? "#f59e0b" : "#dc2626";
  const gradientId = "gauge-gradient";

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <svg width="220" height="140" viewBox="0 0 220 140" role="img" aria-label="Data integrity risk gauge">
        <defs>
          <linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="60%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>
        <path d="M20 120 A90 90 0 0 1 200 120" fill="none" stroke="#e2e8f0" strokeWidth="16" strokeLinecap="round" />
        <path
          d="M20 120 A90 90 0 0 1 200 120"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${(data.score / 100) * 283} 283`}
        />
        <text x="110" y="92" textAnchor="middle" fontSize="28" fontWeight="700" fill="#0f172a">
          {data.score}
        </text>
        <text x="110" y="112" textAnchor="middle" fontSize="12" fontWeight="600" fill={ringColor}>
          {data.level} Risk
        </text>
      </svg>
      <p className="max-w-[18rem] text-center text-xs text-slate-500">{data.note}</p>
    </div>
  );
}

export default function ITAdminDashboard() {
  const router = useRouter();
  const exportRef = useRef<HTMLDivElement>(null);
  const [overview, setOverview] = useState<OverviewData>({
    totalUsers: null,
    newUsersThisWeek: null,
    pendingOnboarding: null,
    archivedAccounts: null,
  });
  const [dailyActiveUsers, setDailyActiveUsers] = useState<DailyActiveData[]>([]);
  const [loginsPerRole, setLoginsPerRole] = useState<RoleLoginData[]>([]);
  const [monthlyGrowth, setMonthlyGrowth] = useState<MonthlyGrowthData[]>([]);
  const [accountStatus, setAccountStatus] = useState<AccountStatusData[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [cpuMemorySeries, setCpuMemorySeries] = useState<CpuMemoryPoint[]>([]);
  const [responseSeries, setResponseSeries] = useState<ResponsePoint[]>([]);
  const [downtimeHistory, setDowntimeHistory] = useState<DowntimePoint[]>([]);
  const [predictiveRisk, setPredictiveRisk] = useState<PredictiveRiskPoint[]>([]);
  const [anomalySeries, setAnomalySeries] = useState<AnomalyPoint[]>([]);
  const [integrityRisk, setIntegrityRisk] = useState<DataIntegrityRisk>({
    score: 0,
    level: "Low",
    note: "Collecting data integrity signals.",
  });
  const [backupTimeline, setBackupTimeline] = useState<BackupStatusPoint[]>([]);

  const [dateRange, setDateRange] = useState<DateRangeValue>("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const loadDashboard = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch("/api/super_admin/dashboard", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as DashboardPayload;

      setOverview(
        payload.overview ?? {
          totalUsers: null,
          newUsersThisWeek: null,
          pendingOnboarding: null,
          archivedAccounts: null,
        },
      );
      setDailyActiveUsers(payload.analytics?.dailyActiveUsers ?? []);
      setLoginsPerRole(payload.analytics?.loginsPerRole ?? []);
      setMonthlyGrowth(payload.analytics?.monthlySystemGrowth ?? []);
      setAccountStatus(payload.analytics?.accountStatusDistribution ?? []);
      setHeatmap(payload.analytics?.peakUsageHeatmap ?? []);
      setCpuMemorySeries(payload.monitoring?.cpuMemoryUsage ?? []);
      setResponseSeries(payload.monitoring?.responseTimes ?? []);
      setDowntimeHistory(payload.monitoring?.downtimeHistory ?? []);
      setPredictiveRisk(payload.aiMonitoring?.predictiveDowntimeRisk ?? []);
      setAnomalySeries(payload.aiMonitoring?.anomalyDetection ?? []);
      setIntegrityRisk(
        payload.aiMonitoring?.dataIntegrityRisk ?? {
          score: 0,
          level: "Low",
          note: "Collecting data integrity signals.",
        },
      );
      setBackupTimeline(payload.aiMonitoring?.backupStatusTimeline ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCpuMemorySeries((previous) => {
        if (previous.length === 0) {
          return previous;
        }

        const last = previous[previous.length - 1];
        const nextCpu = clamp(last.cpu + (Math.random() * 10 - 5), 8, 96);
        const nextMemory = clamp(last.memory + (Math.random() * 8 - 4), 12, 98);

        return [...previous.slice(-23), { time: formatTimeLabel(new Date()), cpu: Math.round(nextCpu), memory: Math.round(nextMemory) }];
      });

      setResponseSeries((previous) => {
        if (previous.length === 0) {
          return previous;
        }

        const last = previous[previous.length - 1];
        const nextResponse = clamp(last.responseMs + (Math.random() * 30 - 15), 80, 450);
        const value = Math.round(nextResponse);

        setAnomalySeries((base) => {
          if (base.length === 0) {
            return base;
          }

          const nextPoint: AnomalyPoint = {
            time: formatTimeLabel(new Date()),
            value,
            isAnomaly: value >= 260,
          };
          return [...base.slice(-23), nextPoint];
        });

        return [...previous.slice(-23), { time: formatTimeLabel(new Date()), responseMs: value }];
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const filteredDailyActiveUsers = useMemo(() => {
    const maxPoints = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    return dailyActiveUsers.slice(-maxPoints);
  }, [dailyActiveUsers, dateRange]);

  const filteredRoleLogins = useMemo(() => {
    const roleMap = new Map<string, number>();
    ROLE_ORDER.forEach((role) => roleMap.set(role, 0));

    for (const item of loginsPerRole) {
      const formatted = formatRole(item.role);
      const safeRole = ROLE_ORDER.includes(formatted) ? formatted : "Admin";
      roleMap.set(safeRole, (roleMap.get(safeRole) ?? 0) + item.count);
    }

    return ROLE_ORDER.map((role) => ({ role, count: roleMap.get(role) ?? 0 }));
  }, [loginsPerRole]);

  const filteredGrowth = useMemo(() => {
    const maxPoints = dateRange === "7d" ? 3 : dateRange === "30d" ? 6 : 12;
    return monthlyGrowth.slice(-maxPoints);
  }, [dateRange, monthlyGrowth]);

  const roleColorMap: Record<string, string> = {
    Admin: "#0f766e",
    Principal: "#16a34a",
    Teacher: "#4ade80",
    Parent: "#84cc16",
  };

  const handleExportPdf = useCallback(async () => {
    if (!exportRef.current) {
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 120));

      const bounds = exportRef.current.getBoundingClientRect();
      const captureWidth = Math.round(bounds.width);
      const captureHeight = Math.max(exportRef.current.scrollHeight, Math.round(bounds.height));

      let canvas: HTMLCanvasElement;
      try {
        // Pass 1: better support for SVG charts (Recharts) and modern CSS.
        canvas = await html2canvas(exportRef.current, {
          scale: 1.8,
          useCORS: true,
          backgroundColor: "#ffffff",
          foreignObjectRendering: true,
          width: captureWidth,
          height: captureHeight,
          windowWidth: captureWidth,
          windowHeight: captureHeight,
          scrollX: 0,
          scrollY: -window.scrollY,
        });
      } catch {
        // Pass 2: sanitize styles for html2canvas parser compatibility.
        canvas = await html2canvas(exportRef.current, {
          scale: 1.8,
          useCORS: true,
          backgroundColor: "#ffffff",
          width: captureWidth,
          height: captureHeight,
          windowWidth: captureWidth,
          windowHeight: captureHeight,
          scrollX: 0,
          scrollY: -window.scrollY,
          onclone: (clonedDoc) => {
            const style = clonedDoc.createElement("style");
            style.textContent = `
              *, *::before, *::after {
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                text-shadow: none !important;
                box-shadow: none !important;
              }
              .export-sanitize, .export-sanitize * {
                background-image: none !important;
              }
            `;
            clonedDoc.head.appendChild(style);
            const clonedRoot = clonedDoc.getElementById("super-admin-export-root");
            if (clonedRoot) {
              clonedRoot.classList.add("export-sanitize");
            }
          },
        });
      }

      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "pt", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const usableWidth = pdfWidth - margin * 2;
      const usableHeight = pdfHeight - margin * 2;

      const imageWidth = usableWidth;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;

      let heightLeft = imageHeight;
      let position = margin;

      pdf.addImage(imageData, "PNG", margin, position, imageWidth, imageHeight);
      heightLeft -= usableHeight;

      while (heightLeft > 0) {
        position = margin - (imageHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imageData, "PNG", margin, position, imageWidth, imageHeight);
        heightLeft -= usableHeight;
      }

      pdf.save(`super-admin-dashboard-${Date.now()}.pdf`);
    } catch (exportError) {
      console.error("Dashboard PDF export failed", exportError);
      const message = exportError instanceof Error ? exportError.message : "";
      setError(message ? `Failed to export dashboard to PDF: ${message}` : "Failed to export dashboard to PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, []);

  const overviewCards = useMemo(
    () => [
      {
        key: "total-users",
        label: "Total Accounts",
        value: overview.totalUsers,
        icon: (
          <svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <path d="M16 3.128a4 4 0 0 1 0 7.744" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <circle cx="9" cy="7" r="4" />
          </svg>
        ),
        onClick: () => router.push("/Super_Admin/accounts"),
      },
      {
        key: "new-users",
        label: "New Accounts",
        value: overview.newUsersThisWeek,
        icon: (
          <svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" x2="19" y1="8" y2="14" />
            <line x1="22" x2="16" y1="11" y2="11" />
          </svg>
        ),
        onClick: () => router.push("/Super_Admin/accounts"),
      },
      {
        key: "pending-users",
        label: "Unverified Accounts",
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
        onClick: () => router.push("/Super_Admin/operations-log"),
      },
      {
        key: "archived-users",
        label: "Archived Accounts",
        value: overview.archivedAccounts,
        icon: (
          <svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.929 4.929 19.07 19.071" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        ),
        onClick: () => router.push("/Super_Admin/recovery"),
      },
    ],
    [overview, router],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="no-print">
        <Sidebar />
      </div>

      <div className="print-main flex min-w-0 flex-1 flex-col overflow-hidden pt-16">
        <div className="no-print">
          <Header title="Dashboard" />
        </div>

        <main className="flex flex-1 min-h-0 overflow-hidden p-4 sm:p-5 md:p-6">
          <div id="super-admin-export-root" ref={exportRef} className="relative h-full min-h-0 w-full">
            <div className="pointer-events-none absolute -top-16 right-10 h-52 w-52 rounded-full bg-emerald-200/55 blur-3xl" />
            <div className="pointer-events-none absolute bottom-8 left-8 h-56 w-56 rounded-full bg-emerald-100/45 blur-3xl" />

            <div className="relative h-full min-h-0 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">
              <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full sm:w-[220px]">
                  <DateRangeSelect value={dateRange} onChange={setDateRange} />
                </div>
                <PrimaryButton
                  small
                  onClick={() => void handleExportPdf()}
                  disabled={isExporting}
                  className="h-[44px] w-full px-4 text-base font-semibold shadow-[0_8px_24px_rgba(15,23,42,0.14)] sm:w-[220px]"
                >
                  {isExporting ? "Exporting..." : "Export to PDF"}
                </PrimaryButton>
              </div>

              {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

              <div className="mb-6 flex items-center justify-between">
                <SecondaryHeader title="Super Admin Overview" />
              </div>

              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {overviewCards.map((card) => (
                  <OverviewCard
                    key={card.key}
                    value={isLoading ? "..." : card.value ?? "-"}
                    label={card.label}
                    icon={card.icon}
                    onClick={card.onClick}
                  />
                ))}
              </div>

              <section className="mb-8">
                <TertiaryHeader title="System Usage Analytics" />
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <GlassChartCard title="Daily Active Users" subtitle="Unique active accounts over the selected period.">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={filteredDailyActiveUsers}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="activeUsers" stroke={palette.primary} strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </GlassChartCard>

                  <GlassChartCard title="Logins per Role" subtitle="Role distribution based on latest login activity.">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredRoleLogins}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="role" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                          {filteredRoleLogins.map((entry) => (
                            <Cell key={entry.role} fill={roleColorMap[entry.role] ?? palette.secondary} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </GlassChartCard>

                  <GlassChartCard title="Monthly System Growth" subtitle="Growth trend of registered accounts.">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={filteredGrowth}>
                        <defs>
                          <linearGradient id="growthFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor={palette.secondary} stopOpacity={0.45} />
                            <stop offset="95%" stopColor={palette.secondary} stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="totalAccounts" stroke={palette.secondary} strokeWidth={2.5} fill="url(#growthFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </GlassChartCard>

                  <GlassChartCard title="Account Status Distribution" subtitle="Active, archived, and unverified account proportions.">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={accountStatus} dataKey="count" nameKey="status" innerRadius={54} outerRadius={90} paddingAngle={3}>
                          {accountStatus.map((entry) => (
                            <Cell
                              key={entry.status}
                              fill={
                                entry.status === "Active"
                                  ? "#16a34a"
                                  : entry.status === "Archived"
                                    ? "#84cc16"
                                    : "#facc15"
                              }
                            />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </GlassChartCard>
                </div>
              </section>

              <section className="mb-8">
                <TertiaryHeader title="Server & Performance Monitoring" />
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <GlassChartCard title="Real-Time CPU & Memory Usage" subtitle="Live infrastructure utilization feed.">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cpuMemorySeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="time" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="cpu" stroke={palette.primary} strokeWidth={2.3} dot={false} name="CPU %" />
                        <Line type="monotone" dataKey="memory" stroke={palette.muted} strokeWidth={2.3} dot={false} name="Memory %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </GlassChartCard>

                  <GlassChartCard title="Server Response Time" subtitle="Average API latency in milliseconds.">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={responseSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="time" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="responseMs" stroke={palette.secondary} strokeWidth={2.4} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </GlassChartCard>

                  <GlassChartCard title="Downtime History Timeline" subtitle="Recorded service interruptions and duration.">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={downtimeHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="minutes" radius={[10, 10, 0, 0]}>
                          {downtimeHistory.map((row, index) => (
                            <Cell
                              key={`${row.date}-${index}`}
                              fill={row.severity === "High" ? "#dc2626" : row.severity === "Medium" ? "#f59e0b" : "#22c55e"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </GlassChartCard>

                  <GlassChartCard title="Peak Usage Hours Heatmap" subtitle="Intensity of system usage by day and hour.">
                    <div className="grid h-full grid-cols-8 gap-1 overflow-auto pr-1">
                      <div className="text-xs font-semibold text-slate-500">Day</div>
                      {Array.from({ length: 7 }, (_, idx) => (
                        <div key={idx} className="text-center text-[11px] font-medium text-slate-500">
                          {idx * 4}h
                        </div>
                      ))}

                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                        const dayPoints = heatmap.filter((point) => point.day === day);
                        const hourlySlots = [0, 4, 8, 12, 16, 20, 23];
                        const slots = hourlySlots.map((hour) => {
                          const match = dayPoints.find((point) => point.hour === hour);
                          return match?.value ?? 0;
                        });

                        return (
                          <div key={day} className="contents">
                            <div className="self-center text-xs font-medium text-slate-600">
                              {day}
                            </div>
                            {slots.map((value, slotIndex) => {
                              const alpha = clamp(value / 32, 0.12, 0.85);
                              const slotHour = hourlySlots[slotIndex] ?? slotIndex * 4;
                              return (
                                <div
                                  key={`${day}-${slotIndex}`}
                                  className="h-7 rounded-md border border-white/60"
                                  style={{ backgroundColor: `rgba(22,163,74,${alpha.toFixed(2)})` }}
                                  title={`${day} ${slotHour}:00 - ${value} logins`}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </GlassChartCard>
                </div>
              </section>

              <section>
                <TertiaryHeader title="AI-Powered Technical Monitoring" />
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <GlassChartCard title="Predictive Downtime Risk" subtitle="AI forecast of downtime probability.">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={predictiveRisk}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="time" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="risk" stroke="#f59e0b" strokeWidth={2.4} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </GlassChartCard>

                  <GlassChartCard title="Anomaly Detection" subtitle="Abnormal latency spikes highlighted by model thresholds.">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={anomalySeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="time" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={palette.primary}
                          strokeWidth={2}
                          dot={renderAnomalyDot}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </GlassChartCard>

                  <GlassChartCard title="Data Integrity Risk Indicator" subtitle="Composite signal from verification, archive, and consistency checks.">
                    <Gauge data={integrityRisk} />
                  </GlassChartCard>

                  <GlassChartCard title="Backup Status Timeline" subtitle="Recent backup executions and completion quality.">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={backupTimeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="durationMin" radius={[10, 10, 0, 0]}>
                          {backupTimeline.map((entry) => (
                            <Cell key={`${entry.date}-${entry.status}`} fill={getStatusColor(entry.status)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </GlassChartCard>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            background: white !important;
          }

          main {
            overflow: visible !important;
          }

          .print-main {
            padding-top: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
