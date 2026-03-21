"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarDays, GraduationCap, Printer } from "lucide-react";
import { FaChalkboardTeacher } from "react-icons/fa";
import { CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PrincipalHeader from "@/components/Principal/Header";
import PrincipalSidebar from "@/components/Principal/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

type SubjectName = "English" | "Filipino" | "Math";
type StaffRoleName = "Teacher" | "Master Teacher";

type DashboardTotals = {
  students: number;
  teachers: number;
  breakdown: {
    teachers: number;
    masterTeachers: number;
  };
};

type ReportMonthStat = {
  label: string;
  month: number;
  year: number | null;
  total: number;
  submitted: number;
  pending: number;
};

type DashboardAnalyticsPayload = {
  remedialAverageHeatmap: Array<{ grade: string; subject: SubjectName; averageScore: number }>;
  performanceTrend: {
    monthly: Array<{
      period: string;
      allSubjects: number;
      english: number;
      filipino: number;
      math: number;
    }>;
    weekly: Array<{
      period: string;
      allSubjects: number;
      english: number;
      filipino: number;
      math: number;
    }>;
  };
  averageStudentsPerSubject: Array<{ subject: SubjectName; students: number; percentage: number }>;
  staffRoleDistribution: {
    overall: Array<{ role: StaffRoleName; count: number }>;
    bySubject: Record<SubjectName, Array<{ role: StaffRoleName; count: number }>>;
  };
};

type DashboardApiResponse = {
  totals: DashboardTotals;
  reports: {
    monthStats: ReportMonthStat[];
    currentMonth: ReportMonthStat;
  };
  analytics?: DashboardAnalyticsPayload;
};

type HeatCell = {
  x: string;
  y: string;
  value: number;
};

type TrendPoint = {
  period: string;
  allSubjects: number;
  english: number;
  filipino: number;
  math: number;
};

const SUBJECTS: SubjectName[] = ["English", "Filipino", "Math"];
const GRADES = ["1", "2", "3", "4", "5", "6"] as const;
const HEATMAP_SCORE_COLORS = ["#fee2e2", "#fecaca", "#fde68a", "#bef264", "#86efac", "#4ade80", "#22c55e"];
const PIE_SOFT_COLORS = ["#0f766e", "#16a34a", "#65a30d", "#0ea5a4", "#84cc16"];
const TREND_LINE_COLORS: Record<SubjectName, string> = {
  English: "#166534",
  Filipino: "#0f766e",
  Math: "#b45309",
};

const palette = {
  primary: "#166534",
  secondary: "#16a34a",
  accent: "#22c55e",
  text: "#0f172a",
  grid: "#d1d5db",
};

const GRADE_LABELS = GRADES.map((grade) => `Grade ${grade}`);

const EMPTY_ANALYTICS: DashboardAnalyticsPayload = {
  remedialAverageHeatmap: [],
  performanceTrend: {
    monthly: [],
    weekly: [],
  },
  averageStudentsPerSubject: [],
  staffRoleDistribution: {
    overall: [
      { role: "Teacher", count: 0 },
      { role: "Master Teacher", count: 0 },
    ],
    bySubject: {
      English: [
        { role: "Teacher", count: 0 },
        { role: "Master Teacher", count: 0 },
      ],
      Filipino: [
        { role: "Teacher", count: 0 },
        { role: "Master Teacher", count: 0 },
      ],
      Math: [
        { role: "Teacher", count: 0 },
        { role: "Master Teacher", count: 0 },
      ],
    },
  },
};

const normalizeTrendPoint = (item: unknown): TrendPoint | null => {
  if (!item || typeof item !== "object") return null;
  const source = item as Record<string, unknown>;
  const period = String(source.period ?? "").trim();
  if (!period) return null;
  return {
    period,
    allSubjects: Number(source.allSubjects ?? 0) || 0,
    english: Number(source.english ?? 0) || 0,
    filipino: Number(source.filipino ?? 0) || 0,
    math: Number(source.math ?? 0) || 0,
  };
};

const normalizeAnalytics = (input: unknown): DashboardAnalyticsPayload => {
  if (!input || typeof input !== "object") return EMPTY_ANALYTICS;
  const source = input as Record<string, unknown>;

  const legacyOrModernTrend = source.performanceTrend;
  let monthly: TrendPoint[] = [];
  let weekly: TrendPoint[] = [];

  if (Array.isArray(legacyOrModernTrend)) {
    monthly = legacyOrModernTrend.map(normalizeTrendPoint).filter((entry): entry is TrendPoint => Boolean(entry));
  } else if (legacyOrModernTrend && typeof legacyOrModernTrend === "object") {
    const trendObject = legacyOrModernTrend as Record<string, unknown>;
    monthly = Array.isArray(trendObject.monthly)
      ? trendObject.monthly.map(normalizeTrendPoint).filter((entry): entry is TrendPoint => Boolean(entry))
      : [];
    weekly = Array.isArray(trendObject.weekly)
      ? trendObject.weekly.map(normalizeTrendPoint).filter((entry): entry is TrendPoint => Boolean(entry))
      : [];
  }

  return {
    ...EMPTY_ANALYTICS,
    ...source,
    performanceTrend: {
      monthly,
      weekly,
    },
    remedialAverageHeatmap: Array.isArray(source.remedialAverageHeatmap)
      ? (source.remedialAverageHeatmap as DashboardAnalyticsPayload["remedialAverageHeatmap"])
      : [],
    averageStudentsPerSubject: Array.isArray(source.averageStudentsPerSubject)
      ? (source.averageStudentsPerSubject as DashboardAnalyticsPayload["averageStudentsPerSubject"])
      : [],
    staffRoleDistribution:
      source.staffRoleDistribution && typeof source.staffRoleDistribution === "object"
        ? ({
            ...EMPTY_ANALYTICS.staffRoleDistribution,
            ...(source.staffRoleDistribution as DashboardAnalyticsPayload["staffRoleDistribution"]),
          } as DashboardAnalyticsPayload["staffRoleDistribution"])
        : EMPTY_ANALYTICS.staffRoleDistribution,
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function HeatmapCard({
  title,
  subtitle,
  cells,
  xLabels,
  yLabels,
  colors = HEATMAP_SCORE_COLORS,
}: {
  title: string;
  subtitle?: string;
  cells: HeatCell[];
  xLabels: string[];
  yLabels: string[];
  colors?: string[];
}) {
  const cellMap = new Map(cells.map((cell) => [`${cell.y}-${cell.x}`, cell.value]));
  const bodyHeightPx = 304;
  const headerOffsetPx = 28;
  const rowCount = Math.max(yLabels.length, 1);
  const cellHeightPx = clamp(Math.floor((bodyHeightPx - headerOffsetPx) / rowCount), 26, 72);

  const getColor = (value: number) => {
    const bucket = clamp(Math.round((value / 100) * (colors.length - 1)), 0, colors.length - 1);
    return colors[bucket] ?? colors[0];
  };

  return (
    <section className="print-chart-card h-full rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg sm:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>

      <div className="chart-body h-72 overflow-auto sm:h-80">
        <div className="inline-grid min-w-full gap-2" style={{ gridTemplateColumns: `110px repeat(${xLabels.length}, minmax(92px, 1fr))` }}>
          <div className="text-xs font-semibold text-slate-500">Category</div>
          {xLabels.map((label) => (
            <div key={label} className="text-center text-xs font-semibold text-slate-600">
              {label}
            </div>
          ))}

          {yLabels.map((row) => (
            <div key={`row-group-${row}`} className="contents">
              <div className="flex items-center text-xs font-medium text-slate-600" style={{ minHeight: `${cellHeightPx}px` }}>
                {row}
              </div>
              {xLabels.map((column) => {
                const value = cellMap.get(`${row}-${column}`) ?? 0;
                return (
                  <div
                    key={`${row}-${column}`}
                    className="flex items-center justify-center rounded-md border border-white/70 text-[11px] font-semibold text-emerald-900"
                    style={{ minHeight: `${cellHeightPx}px`, backgroundColor: getColor(value) }}
                    title={`${row} / ${column}: ${value}%`}
                  >
                    {value}%
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GlassChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="print-chart-card h-full rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg sm:p-5">
      <div className="mb-3 min-h-14">
        <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="chart-body h-72 sm:h-80">{children}</div>
    </section>
  );
}

export default function PrincipalDashboard() {
  const router = useRouter();
  const exportRef = useRef<HTMLDivElement>(null);

  const [trendTimeFilter, setTrendTimeFilter] = useState<"monthly" | "weekly">("monthly");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectName[]>([...SUBJECTS]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([...GRADE_LABELS]);

  const [overviewTotals, setOverviewTotals] = useState<DashboardTotals | null>(null);
  const [reportStats, setReportStats] = useState<{ currentMonth: ReportMonthStat | null; monthStats: ReportMonthStat[] }>({
    currentMonth: null,
    monthStats: [],
  });
  const [analytics, setAnalytics] = useState<DashboardAnalyticsPayload>(EMPTY_ANALYTICS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [isPrintReady, setIsPrintReady] = useState(false);
  const todayDateLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    []
  );

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/principal/dashboard", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as DashboardApiResponse;
      setOverviewTotals(payload.totals ?? null);
      setReportStats({
        currentMonth: payload.reports?.currentMonth ?? null,
        monthStats: payload.reports?.monthStats ?? [],
      });
      setAnalytics(normalizeAnalytics(payload.analytics));
      setLastUpdated(new Date());
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load principal dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const refreshId = window.setInterval(() => {
      void loadDashboard();
    }, 60000);

    return () => window.clearInterval(refreshId);
  }, [loadDashboard]);

  const filteredHeatmapSource = useMemo(
    () =>
      analytics.remedialAverageHeatmap.filter((entry) => selectedSubjects.includes(entry.subject) && selectedGrades.includes(entry.grade)),
    [analytics.remedialAverageHeatmap, selectedSubjects, selectedGrades]
  );

  const remedialAverageHeatmap = useMemo<HeatCell[]>(() => {
    return filteredHeatmapSource.map((entry) => ({
      x: entry.subject,
      y: entry.grade,
      value: entry.averageScore,
    }));
  }, [filteredHeatmapSource]);

  const heatmapGrades = useMemo(() => {
    const grades = Array.from(new Set(filteredHeatmapSource.map((entry) => entry.grade)));
    return grades.length > 0 ? grades : GRADES.map((grade) => `Grade ${grade}`);
  }, [filteredHeatmapSource]);

  const performanceTrendSeries = useMemo(() => {
    const source = trendTimeFilter === "weekly" ? analytics.performanceTrend.weekly : analytics.performanceTrend.monthly;
    return source.map((item) => ({
      period: item.period,
      english: item.english,
      filipino: item.filipino,
      math: item.math,
    }));
  }, [analytics.performanceTrend.monthly, analytics.performanceTrend.weekly, trendTimeFilter]);

  const hasPerformanceTrendData = useMemo(
    () =>
      performanceTrendSeries.some(
        (item) =>
          (selectedSubjects.includes("English") && item.english > 0) ||
          (selectedSubjects.includes("Filipino") && item.filipino > 0) ||
          (selectedSubjects.includes("Math") && item.math > 0)
      ),
    [performanceTrendSeries, selectedSubjects]
  );

  const hasHeatmapData = filteredHeatmapSource.length > 0;

  const averageStudentsPerSubject = useMemo(() => {
    const source = analytics.averageStudentsPerSubject.filter((entry) => selectedSubjects.includes(entry.subject));
    if (source.length === 0) {
      return selectedSubjects.map((subject) => ({ subject, students: 0, percentage: 0 }));
    }
    const total = source.reduce((sum, entry) => sum + entry.students, 0);
    return source.map((entry) => ({
      ...entry,
      percentage: total > 0 ? Math.round((entry.students / total) * 100) : 0,
    }));
  }, [analytics.averageStudentsPerSubject, selectedSubjects]);

  const hasStudentsPerSubjectData = useMemo(
    () => averageStudentsPerSubject.some((entry) => entry.students > 0),
    [averageStudentsPerSubject]
  );

  const staffRoleDistribution = useMemo(() => {
    const allSubjectsSelected = selectedSubjects.length === SUBJECTS.length;
    const defaultOverall =
      analytics.staffRoleDistribution?.overall?.length > 0
        ? analytics.staffRoleDistribution.overall
        : [
            { role: "Teacher" as const, count: overviewTotals?.breakdown.teachers ?? 0 },
            { role: "Master Teacher" as const, count: overviewTotals?.breakdown.masterTeachers ?? 0 },
          ];

    if (allSubjectsSelected) {
      return defaultOverall;
    }

    const roleCounts = new Map<StaffRoleName, number>([
      ["Teacher", 0],
      ["Master Teacher", 0],
    ]);

    for (const subject of selectedSubjects) {
      const entries = analytics.staffRoleDistribution?.bySubject?.[subject] ?? [];
      for (const entry of entries) {
        roleCounts.set(entry.role, (roleCounts.get(entry.role) ?? 0) + entry.count);
      }
    }

    const filtered = Array.from(roleCounts.entries()).map(([role, count]) => ({ role, count }));
    const hasFilteredData = filtered.some((entry) => entry.count > 0);
    return hasFilteredData ? filtered : defaultOverall;
  }, [analytics.staffRoleDistribution, selectedSubjects, overviewTotals?.breakdown.masterTeachers, overviewTotals?.breakdown.teachers]);

  const hasStaffRoleDistributionData = useMemo(
    () => staffRoleDistribution.some((entry) => entry.count > 0),
    [staffRoleDistribution]
  );

  const clearFilters = useCallback(() => {
    setSelectedSubjects([...SUBJECTS]);
    setSelectedGrades([...GRADE_LABELS]);
    setTrendTimeFilter("monthly");
  }, []);

  const toggleSubject = useCallback((subject: SubjectName) => {
    setSelectedSubjects((prev) => {
      if (prev.includes(subject)) {
        if (prev.length === 1) return prev;
        return prev.filter((entry) => entry !== subject);
      }
      return [...prev, subject];
    });
  }, []);

  const toggleGrade = useCallback((gradeLabel: string) => {
    setSelectedGrades((prev) => {
      if (prev.includes(gradeLabel)) {
        if (prev.length === 1) return prev;
        return prev.filter((entry) => entry !== gradeLabel);
      }
      return [...prev, gradeLabel];
    });
  }, []);

  const handlePrintExport = useCallback(() => {
    setIsPreparingPrint(true);
    setIsPrintReady(false);
  }, []);

  useEffect(() => {
    if (!isPreparingPrint) return;

    let timeoutId: number | null = null;
    let raf1 = 0;
    let raf2 = 0;

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setIsPrintReady(true);
        timeoutId = window.setTimeout(() => {
          window.print();
        }, 120);
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isPreparingPrint]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPreparingPrint(false);
      setIsPrintReady(false);
    };

    const handleBeforePrint = () => {
      setIsPrintReady(true);
    };

    window.addEventListener("afterprint", handleAfterPrint);
    window.addEventListener("beforeprint", handleBeforePrint);

    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      window.removeEventListener("beforeprint", handleBeforePrint);
    };
  }, []);

  const totalTeachers = overviewTotals?.teachers ?? 0;
  const totalStudents = overviewTotals?.students ?? 0;
  const reportRate =
    reportStats.currentMonth && reportStats.currentMonth.total > 0
      ? Math.round((reportStats.currentMonth.submitted / reportStats.currentMonth.total) * 100)
      : 0;

  return (
    <div className="dashboard-page">
      <div className="dashboard-live flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
        <div className="no-print">
          <PrincipalSidebar />
        </div>

        <div className="print-main flex min-w-0 flex-1 flex-col overflow-hidden pt-16">
        <div className="no-print">
          <PrincipalHeader title="Dashboard" />
        </div>

        <main className="print-stage flex flex-1 min-h-0 overflow-hidden p-4 sm:p-5 md:p-6">
          <div className="relative h-full min-h-0 w-full">
            <div className="no-print pointer-events-none absolute -top-16 right-10 h-52 w-52 rounded-full bg-emerald-200/55 blur-3xl" />
            <div className="no-print pointer-events-none absolute bottom-8 left-8 h-56 w-56 rounded-full bg-emerald-100/45 blur-3xl" />

            <div
              id="principal-export-root"
              ref={exportRef}
              className="relative h-full min-h-0 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <SecondaryHeader title="Principal Overview" />
                </div>

                <div className="no-print flex shrink-0 items-center gap-2">
                  <div className="relative">
                    {isFilterModalOpen && (
                      <button
                        type="button"
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => {
                          setIsFilterModalOpen(false);
                        }}
                        aria-label="Close filter panel"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsFilterModalOpen((prev) => !prev);
                      }}
                      className="relative z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100"
                      aria-label="Filter dashboard"
                      title="Filter"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4.5 w-4.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="3 4 21 4 14 12 14 19 10 21 10 12 3 4" />
                      </svg>
                    </button>

                    {isFilterModalOpen ? (
                      <div className="absolute right-0 z-20 mt-2 w-[min(56rem,92vw)] rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_24px_48px_rgba(15,23,42,0.22)]">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-base font-semibold text-slate-900">Filter Dashboard</p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsFilterModalOpen(false);
                            }}
                            className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900"
                          >
                            Close
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Performance Trend View</p>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { label: "Per month", value: "monthly" },
                                { label: "Per week", value: "weekly" },
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => setTrendTimeFilter(option.value as "monthly" | "weekly")}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                    trendTimeFilter === option.value
                                      ? "border-emerald-700 bg-emerald-700 text-white"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs font-medium text-emerald-900">
                              Fixed trend range: September 2025 to March 2026.
                            </p>
                          </div>

                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subjects</p>
                            <div className="flex flex-wrap gap-2">
                              {SUBJECTS.map((subject) => (
                                <button
                                  key={subject}
                                  type="button"
                                  onClick={() => toggleSubject(subject)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                    selectedSubjects.includes(subject)
                                      ? "border-emerald-700 bg-emerald-700 text-white"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  {subject}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Grade Levels</p>
                            <div className="flex flex-wrap gap-2">
                              {GRADE_LABELS.map((gradeLabel) => (
                                <button
                                  key={gradeLabel}
                                  type="button"
                                  onClick={() => toggleGrade(gradeLabel)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                    selectedGrades.includes(gradeLabel)
                                      ? "border-emerald-700 bg-emerald-700 text-white"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  {gradeLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                          <SecondaryButton small className="border border-emerald-100 bg-white/80 px-3" onClick={clearFilters}>
                            Clear All
                          </SecondaryButton>
                          <PrimaryButton
                            small
                            className="px-3"
                            onClick={() => {
                              setIsFilterModalOpen(false);
                            }}
                          >
                            Apply Filters
                          </PrimaryButton>
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

              {error ? <p className="mb-4 text-sm font-medium text-red-600">{error}</p> : null}

              <div className="print-kpi-grid mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => router.push("/Principal/students")}
                  className="cursor-pointer rounded-xl border border-white/70 bg-white/60 px-4 py-3 text-left shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-3xl font-semibold text-slate-900">{isLoading ? "..." : totalStudents.toLocaleString()}</p>
                      <p className="text-sm font-medium text-slate-600">Total Students</p>
                    </div>
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <GraduationCap className="h-5.5 w-5.5" />
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/Principal/teachers")}
                  className="cursor-pointer rounded-xl border border-white/70 bg-white/60 px-4 py-3 text-left shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-3xl font-semibold text-slate-900">{isLoading ? "..." : totalTeachers.toLocaleString()}</p>
                      <p className="text-sm font-medium text-slate-600">Teaching Staff</p>
                    </div>
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <FaChalkboardTeacher className="h-5.5 w-5.5" />
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/Principal/reports")}
                  className="cursor-pointer rounded-xl border border-white/70 bg-white/60 px-4 py-3 text-left shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-3xl font-semibold text-slate-900">{isLoading ? "..." : `${reportRate}%`}</p>
                      <p className="text-sm font-medium text-slate-600">Report Submission</p>
                    </div>
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <BarChart3 className="h-5.5 w-5.5" />
                    </span>
                  </div>
                </button>

                <div className="cursor-pointer rounded-xl border border-white/70 bg-white/60 px-4 py-3 text-left shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold text-slate-900">{todayDateLabel}</p>
                      <p className="text-sm font-medium text-slate-600">Date Today</p>
                    </div>
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <CalendarDays className="h-5.5 w-5.5" />
                    </span>
                  </div>
                </div>
              </div>

              <section className="print-section print-section-trend mb-8">
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="xl:col-span-2">
                    <GlassChartCard
                      title="Performance Trend"
                      subtitle={`Average remedial score (${trendTimeFilter === "weekly" ? "per week" : "per month"}) from Sep 2025 to Mar 2026.`}
                    >
                      <div className="mb-3 flex items-center justify-end gap-2"></div>
                      {hasPerformanceTrendData ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={performanceTrendSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                            <XAxis
                              dataKey="period"
                              tick={{ fill: palette.text, fontSize: 11 }}
                              interval={trendTimeFilter === "weekly" ? 2 : 0}
                              minTickGap={trendTimeFilter === "weekly" ? 20 : 8}
                            />
                            <YAxis domain={[0, 100]} tick={{ fill: palette.text, fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            {selectedSubjects.includes("English") ? (
                              <Line type="monotone" dataKey="english" name="English" stroke={TREND_LINE_COLORS.English} strokeWidth={2.5} dot={false} />
                            ) : null}
                            {selectedSubjects.includes("Filipino") ? (
                              <Line
                                type="monotone"
                                dataKey="filipino"
                                name="Filipino"
                                stroke={TREND_LINE_COLORS.Filipino}
                                strokeWidth={2.5}
                                dot={false}
                              />
                            ) : null}
                            {selectedSubjects.includes("Math") ? (
                              <Line type="monotone" dataKey="math" name="Math" stroke={TREND_LINE_COLORS.Math} strokeWidth={2.5} dot={false} />
                            ) : null}
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 text-sm font-medium text-slate-500">
                          No performance trend data available.
                        </div>
                      )}
                    </GlassChartCard>
                  </div>

                  <div className="xl:col-span-1">
                    <GlassChartCard
                      title="Students per Subject Ratio"
                      subtitle="Distinct students participating in remedial sessions by subject."
                    >
                      {hasStudentsPerSubjectData ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={averageStudentsPerSubject}
                              dataKey="students"
                              nameKey="subject"
                              innerRadius={52}
                              outerRadius={90}
                              paddingAngle={2}
                            >
                              {averageStudentsPerSubject.map((entry, index) => (
                                <Cell key={entry.subject} fill={PIE_SOFT_COLORS[index % PIE_SOFT_COLORS.length]} />
                              ))}
                            </Pie>
                            <Legend />
                            <Tooltip
                              formatter={(value: number, name: string, item: { payload?: { percentage?: number } }) => [
                                `${value} (${item?.payload?.percentage ?? 0}%)`,
                                name,
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 text-sm font-medium text-slate-500">
                          No student participation data available.
                        </div>
                      )}
                    </GlassChartCard>
                  </div>
                </div>
              </section>

              <section className="print-section print-section-heat mb-8">
                <div className="mt-3 grid grid-cols-1 gap-4 xl:auto-rows-fr xl:grid-cols-2">
                  <div className="h-full">
                    {hasHeatmapData ? (
                      <HeatmapCard
                        title="Remedial Average Heatmap"
                        subtitle="Average remedial performance score per subject and grade level."
                        cells={remedialAverageHeatmap}
                        xLabels={selectedSubjects}
                        yLabels={heatmapGrades}
                        colors={HEATMAP_SCORE_COLORS}
                      />
                    ) : (
                      <GlassChartCard
                        title="Remedial Average Heatmap"
                        subtitle="Average remedial performance score per subject and grade level."
                      >
                        <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 text-sm font-medium text-slate-500">
                          No remedial average data available.
                        </div>
                      </GlassChartCard>
                    )}
                  </div>

                  <div className="h-full">
                    <GlassChartCard
                      title="Staff Role Distribution"
                      subtitle="Teacher vs Master Teacher count based on selected subject filters."
                    >
                      {hasStaffRoleDistributionData ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={staffRoleDistribution}
                              dataKey="count"
                              nameKey="role"
                              innerRadius={52}
                              outerRadius={90}
                              paddingAngle={2}
                            >
                              {staffRoleDistribution.map((entry, index) => (
                                <Cell key={entry.role} fill={PIE_SOFT_COLORS[index % PIE_SOFT_COLORS.length]} />
                              ))}
                            </Pie>
                            <Legend />
                            <Tooltip formatter={(value: number, name: string) => [`${value}`, name]} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 text-sm font-medium text-slate-500">
                          No staff role data available.
                        </div>
                      )}
                    </GlassChartCard>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
        </div>
      </div>

      <div className="print-report-root" aria-hidden={!isPreparingPrint && !isPrintReady}>
        <div className="print-report-header">
          <div>
            <h1>Principal Dashboard Report</h1>
            <p className="print-report-subtitle">Academic performance and staffing summary</p>
          </div>
          <p className="print-report-date">Generated: {todayDateLabel}</p>
        </div>

        <div className="print-report-kpis">
          <article className="print-report-card">
            <h3>Total Students</h3>
            <p className="print-metric-value">{totalStudents.toLocaleString()}</p>
          </article>
          <article className="print-report-card">
            <h3>Teaching Staff</h3>
            <p className="print-metric-value">{totalTeachers.toLocaleString()}</p>
          </article>
          <article className="print-report-card">
            <h3>Report Submission</h3>
            <p className="print-metric-value">{`${reportRate}%`}</p>
          </article>
          <article className="print-report-card">
            <h3>Trend View</h3>
            <p className="print-metric-value">{trendTimeFilter === "weekly" ? "Per week" : "Per month"}</p>
          </article>
        </div>

        <section className="print-section-block">
          <h2>Performance Trend</h2>
          <div className="print-chart-frame">
            {hasPerformanceTrendData ? (
              <LineChart width={980} height={236} data={performanceTrendSeries} margin={{ top: 6, right: 16, left: 0, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                <XAxis dataKey="period" tick={{ fill: palette.text, fontSize: 11 }} interval={trendTimeFilter === "weekly" ? 2 : 0} minTickGap={24} />
                <YAxis domain={[0, 100]} tick={{ fill: palette.text, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} iconSize={8} />
                {selectedSubjects.includes("English") ? (
                  <Line
                    type="monotone"
                    dataKey="english"
                    name="English"
                    stroke={TREND_LINE_COLORS.English}
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                ) : null}
                {selectedSubjects.includes("Filipino") ? (
                  <Line
                    type="monotone"
                    dataKey="filipino"
                    name="Filipino"
                    stroke={TREND_LINE_COLORS.Filipino}
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                ) : null}
                {selectedSubjects.includes("Math") ? (
                  <Line
                    type="monotone"
                    dataKey="math"
                    name="Math"
                    stroke={TREND_LINE_COLORS.Math}
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                ) : null}
              </LineChart>
            ) : (
              <p className="print-empty-state">No performance trend data available.</p>
            )}
          </div>
        </section>

        <section className="print-section-block">
          <div className="print-two-col">
            <article className="print-report-card print-report-chart-card">
              <h3>Students per Subject Ratio</h3>
              {hasStudentsPerSubjectData ? (
                <PieChart width={420} height={210}>
                  <Pie
                    data={averageStudentsPerSubject}
                    dataKey="students"
                    nameKey="subject"
                    cx={210}
                    cy={100}
                    innerRadius={42}
                    outerRadius={76}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {averageStudentsPerSubject.map((entry, index) => (
                      <Cell key={`print-student-${entry.subject}`} fill={PIE_SOFT_COLORS[index % PIE_SOFT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconSize={8} />
                </PieChart>
              ) : (
                <p className="print-empty-state">No student participation data available.</p>
              )}
            </article>

            <article className="print-report-card print-report-chart-card">
              <h3>Staff Role Distribution</h3>
              {hasStaffRoleDistributionData ? (
                <PieChart width={420} height={210}>
                  <Pie
                    data={staffRoleDistribution}
                    dataKey="count"
                    nameKey="role"
                    cx={210}
                    cy={100}
                    innerRadius={42}
                    outerRadius={76}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {staffRoleDistribution.map((entry, index) => (
                      <Cell key={`print-role-${entry.role}`} fill={PIE_SOFT_COLORS[index % PIE_SOFT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconSize={8} />
                </PieChart>
              ) : (
                <p className="print-empty-state">No staff role data available.</p>
              )}
            </article>
          </div>
        </section>

        <section className="print-section-block print-section-heatmap">
          <h2>Remedial Average Heatmap</h2>
          <div className="print-report-card">
            <table className="print-heatmap-table">
              <thead>
                <tr>
                  <th>Grade</th>
                  {selectedSubjects.map((subject) => (
                    <th key={`print-heat-subject-${subject}`}>{subject}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapGrades.map((grade) => (
                  <tr key={`print-heat-grade-${grade}`}>
                    <td>{grade}</td>
                    {selectedSubjects.map((subject) => {
                      const match = remedialAverageHeatmap.find((cell) => cell.x === subject && cell.y === grade);
                      const value = match?.value ?? 0;
                      return <td key={`print-heat-cell-${grade}-${subject}`}>{value}%</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="print-report-footer">Generated by RPT-SAES</footer>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 5mm;
          }

          .dashboard-live,
          .no-print {
            display: none !important;
          }

          .print-report-root {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            position: static !important;
            transform: none !important;
            background: #ffffff !important;
            padding: 0 !important;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
            color: #0f172a !important;
          }

          .print-report-root * {
            position: static !important;
            transform: none !important;
          }

          .print-report-header,
          .print-report-kpis,
          .print-section-block,
          .print-report-card,
          .print-chart-frame,
          .print-two-col,
          .print-heatmap-table {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .print-report-header {
            display: flex !important;
            align-items: baseline !important;
            justify-content: space-between !important;
            margin-bottom: 6px !important;
          }

          .print-report-header h1 {
            margin: 0 !important;
            font-size: 20px !important;
            color: #0f172a !important;
            font-weight: 700 !important;
          }

          .print-report-header p,
          .print-report-subtitle,
          .print-report-date {
            margin: 0 !important;
            font-size: 11px !important;
            color: #475569 !important;
          }

          .print-report-subtitle {
            margin-top: 2px !important;
            color: #64748b !important;
          }

          .print-report-date {
            font-weight: 600 !important;
          }

          .print-report-kpis {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 6px !important;
            margin-bottom: 10px !important;
          }

          .print-section-block {
            margin-bottom: 10px !important;
            break-before: auto !important;
            orphans: 3;
            widows: 3;
          }

          .print-section-block h2 {
            margin: 2px 0 7px 0 !important;
            font-size: 13px !important;
            color: #0f172a !important;
            font-weight: 700 !important;
            line-height: 1.25 !important;
          }

          .print-two-col {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .print-report-card {
            border: 1px solid #d7e1e8 !important;
            border-radius: 6px !important;
            padding: 7px !important;
            background: #ffffff !important;
          }

          .print-report-card h3 {
            margin: 0 0 2px 0 !important;
            font-size: 10px !important;
            color: #64748b !important;
            text-transform: uppercase !important;
            letter-spacing: 0.04em !important;
            font-weight: 700 !important;
            line-height: 1.25 !important;
          }

          .print-metric-value {
            margin: 0 !important;
            font-size: 18px !important;
            color: #0f172a !important;
            font-weight: 700 !important;
            line-height: 1.15 !important;
          }

          .print-report-chart-card {
            height: 238px !important;
          }

          .print-chart-frame {
            width: 100% !important;
            height: 256px !important;
            border: 1px solid #d7e1e8 !important;
            border-radius: 6px !important;
            padding: 6px 6px 8px 6px !important;
          }

          .print-empty-state {
            font-size: 12px !important;
            color: #64748b !important;
            margin: 0 !important;
            line-height: 1.35 !important;
          }

          .print-section-heatmap {
            margin-top: 2px !important;
            margin-bottom: 12px !important;
          }

          .print-section-heatmap .print-report-card {
            margin-top: 2px !important;
            padding-top: 8px !important;
            padding-bottom: 8px !important;
          }

          .print-heatmap-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          .print-heatmap-table th,
          .print-heatmap-table td {
            border: 1px solid #d7e1e8 !important;
            padding: 4px 6px !important;
            text-align: center !important;
            font-size: 10px !important;
            line-height: 1.3 !important;
          }

          .print-heatmap-table th {
            background: #f8fafc !important;
            color: #334155 !important;
          }

          .print-report-footer {
            margin-top: 8px !important;
            padding-bottom: 4px !important;
            text-align: right !important;
            font-size: 9px !important;
            color: #94a3b8 !important;
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

          .dashboard-page .h-screen,
          .dashboard-page .h-full,
          .dashboard-page .min-h-0,
          .dashboard-page .flex-1 {
            height: auto !important;
            min-height: 0 !important;
          }

          .dashboard-page .overflow-hidden,
          .dashboard-page .overflow-y-auto,
          .dashboard-page .overflow-auto {
            overflow: visible !important;
          }

          .dashboard-page .print-main {
            padding-top: 0 !important;
          }

          .dashboard-page .print-stage {
            padding: 0 !important;
          }

          .dashboard-page .print-stage > div {
            height: auto !important;
            min-height: 0 !important;
          }

          .dashboard-page #principal-export-root {
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: #ffffff !important;
            overflow: visible !important;
            height: auto !important;
            padding: 0 !important;
            max-height: none !important;
          }

          .dashboard-page .print-section {
            margin-bottom: 10px !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .dashboard-page .print-chart-card {
            background: #ffffff !important;
            border: 1px solid #d7e1e8 !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        @media screen {
          .print-report-root {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
