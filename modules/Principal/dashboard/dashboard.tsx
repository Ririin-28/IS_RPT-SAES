"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Printer, Users } from "lucide-react";
import { FaChalkboardTeacher } from "react-icons/fa";
import {
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
import PrincipalHeader from "@/components/Principal/Header";
import PrincipalSidebar from "@/components/Principal/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

type SubjectName = "English" | "Filipino" | "Math";
type TrendSubjectFilter = "All Subjects" | SubjectName;

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
  performanceTrend: Array<{
    period: string;
    allSubjects: number;
    english: number;
    filipino: number;
    math: number;
  }>;
  averageStudentsPerSubject: Array<{ subject: SubjectName; students: number; percentage: number }>;
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

const SUBJECTS: SubjectName[] = ["English", "Filipino", "Math"];
const GRADES = ["1", "2", "3", "4", "5", "6"] as const;
const HEATMAP_SCORE_COLORS = ["#fee2e2", "#fecaca", "#fde68a", "#bef264", "#86efac", "#4ade80", "#22c55e"];
const PIE_SOFT_COLORS = ["#0f766e", "#16a34a", "#65a30d", "#0ea5a4", "#84cc16"];

const palette = {
  primary: "#166534",
  secondary: "#16a34a",
  accent: "#22c55e",
  text: "#0f172a",
  grid: "#d1d5db",
};

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

const GRADE_LABELS = GRADES.map((grade) => `Grade ${grade}`);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getMonthLabel(value: number | null): string {
  if (!value) return "";
  return MONTH_OPTIONS.find((month) => month.value === value)?.label ?? "";
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

  const getColor = (value: number) => {
    const bucket = clamp(Math.round((value / 100) * (colors.length - 1)), 0, colors.length - 1);
    return colors[bucket] ?? colors[0];
  };

  return (
    <section className="rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg sm:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>

      <div className="overflow-auto">
        <div className="inline-grid min-w-full gap-2" style={{ gridTemplateColumns: `110px repeat(${xLabels.length}, minmax(74px, 1fr))` }}>
          <div className="text-xs font-semibold text-slate-500">Category</div>
          {xLabels.map((label) => (
            <div key={label} className="text-center text-xs font-semibold text-slate-600">
              {label}
            </div>
          ))}

          {yLabels.map((row) => (
            <div key={`row-group-${row}`} className="contents">
              <div className="self-center text-xs font-medium text-slate-600">{row}</div>
              {xLabels.map((column) => {
                const value = cellMap.get(`${row}-${column}`) ?? 0;
                return (
                  <div
                    key={`${row}-${column}`}
                    className="flex h-9 items-center justify-center rounded-md border border-white/70 text-[11px] font-semibold text-emerald-900"
                    style={{ backgroundColor: getColor(value) }}
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
    <section className="rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg sm:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="h-64 sm:h-72">{children}</div>
    </section>
  );
}

export default function PrincipalDashboard() {
  const router = useRouter();
  const exportRef = useRef<HTMLDivElement>(null);

  const [trendSubjectFilter, setTrendSubjectFilter] = useState<TrendSubjectFilter>("All Subjects");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<"all" | "1st" | "2nd">("all");
  const [monthRangeFrom, setMonthRangeFrom] = useState<number | null>(null);
  const [monthRangeTo, setMonthRangeTo] = useState<number | null>(null);
  const [monthFromMenuOpen, setMonthFromMenuOpen] = useState(false);
  const [monthToMenuOpen, setMonthToMenuOpen] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectName[]>([...SUBJECTS]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([...GRADE_LABELS]);

  const [overviewTotals, setOverviewTotals] = useState<DashboardTotals | null>(null);
  const [reportStats, setReportStats] = useState<{ currentMonth: ReportMonthStat | null; monthStats: ReportMonthStat[] }>({
    currentMonth: null,
    monthStats: [],
  });
  const [analytics, setAnalytics] = useState<DashboardAnalyticsPayload>({
    remedialAverageHeatmap: [],
    performanceTrend: [],
    averageStudentsPerSubject: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
      setAnalytics(
        payload.analytics ?? {
          remedialAverageHeatmap: [],
          performanceTrend: [],
          averageStudentsPerSubject: [],
        },
      );
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
      analytics.remedialAverageHeatmap.filter(
        (entry) => selectedSubjects.includes(entry.subject) && selectedGrades.includes(entry.grade),
      ),
    [analytics.remedialAverageHeatmap, selectedSubjects, selectedGrades],
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

  const monthInRange = useCallback((monthValue: number, start: number, end: number) => {
    if (start <= end) return monthValue >= start && monthValue <= end;
    return monthValue >= start || monthValue <= end;
  }, []);

  const filteredPerformanceTrend = useMemo(() => {
    const resolveMonthFromPeriod = (period: string): number | null => {
      const parsed = new Date(`1 ${period}`);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.getMonth() + 1;
    };

    const source = [...analytics.performanceTrend];
    const quarterScoped =
      selectedQuarter === "all"
        ? source
        : selectedQuarter === "1st"
          ? source.slice(0, Math.ceil(source.length / 2))
          : source.slice(Math.ceil(source.length / 2));

    if (!monthRangeFrom || !monthRangeTo) {
      return quarterScoped;
    }

    return quarterScoped.filter((item) => {
      const monthValue = resolveMonthFromPeriod(item.period);
      if (!monthValue) return false;
      return monthInRange(monthValue, monthRangeFrom, monthRangeTo);
    });
  }, [analytics.performanceTrend, selectedQuarter, monthRangeFrom, monthRangeTo, monthInRange]);

  const visibleTrendSubjects = useMemo(
    () => ["All Subjects", ...selectedSubjects] as TrendSubjectFilter[],
    [selectedSubjects],
  );

  useEffect(() => {
    if (trendSubjectFilter === "All Subjects") return;
    if (!selectedSubjects.includes(trendSubjectFilter)) {
      setTrendSubjectFilter("All Subjects");
    }
  }, [selectedSubjects, trendSubjectFilter]);

  const performanceTrendSeries = useMemo(() => {
    const pickValue = (item: DashboardAnalyticsPayload["performanceTrend"][number]): number => {
      const selectedSet = new Set<SubjectName>(selectedSubjects);
      if (trendSubjectFilter === "English") return item.english;
      if (trendSubjectFilter === "Filipino") return item.filipino;
      if (trendSubjectFilter === "Math") return item.math;

      const values: number[] = [];
      if (selectedSet.has("English")) values.push(item.english);
      if (selectedSet.has("Filipino")) values.push(item.filipino);
      if (selectedSet.has("Math")) values.push(item.math);
      if (values.length === 0) return 0;
      return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    };

    return filteredPerformanceTrend.map((item) => ({
      period: item.period,
      value: pickValue(item),
    }));
  }, [filteredPerformanceTrend, trendSubjectFilter, selectedSubjects]);

  const hasPerformanceTrendData = useMemo(() => performanceTrendSeries.some((item) => item.value > 0), [performanceTrendSeries]);

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
    [averageStudentsPerSubject],
  );

  const clearFilters = useCallback(() => {
    setSelectedQuarter("all");
    setMonthRangeFrom(null);
    setMonthRangeTo(null);
    setMonthFromMenuOpen(false);
    setMonthToMenuOpen(false);
    setSelectedSubjects([...SUBJECTS]);
    setSelectedGrades([...GRADE_LABELS]);
    setTrendSubjectFilter("All Subjects");
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
    window.print();
  }, []);

  const totalTeachers = overviewTotals?.teachers ?? 0;
  const totalStudents = overviewTotals?.students ?? 0;
  const reportRate = reportStats.currentMonth && reportStats.currentMonth.total > 0
    ? Math.round((reportStats.currentMonth.submitted / reportStats.currentMonth.total) * 100)
    : 0;

  return (
    <div className="dashboard-page flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
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
                  <SecondaryHeader title="Remedial Progress" />
                </div>

                <div className="no-print flex shrink-0 items-center gap-2">
                  <div className="relative">
                    {isFilterModalOpen && (
                      <button
                        type="button"
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => {
                          setIsFilterModalOpen(false);
                          setMonthFromMenuOpen(false);
                          setMonthToMenuOpen(false);
                        }}
                        aria-label="Close filter panel"
                      />
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
                      <div className="absolute right-0 z-20 mt-2 w-[min(56rem,92vw)] rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_24px_48px_rgba(15,23,42,0.22)]">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-base font-semibold text-slate-900">Filter Dashboard</p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsFilterModalOpen(false);
                              setMonthFromMenuOpen(false);
                              setMonthToMenuOpen(false);
                            }}
                            className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900"
                          >
                            Close
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quarter Range</p>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { label: "All", value: "all" },
                                { label: "1st Quarter", value: "1st" },
                                { label: "2nd Quarter", value: "2nd" },
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => setSelectedQuarter(option.value as "all" | "1st" | "2nd")}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                    selectedQuarter === option.value
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
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Month Range</p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                              <div className="relative">
                                {monthFromMenuOpen && (
                                  <button
                                    type="button"
                                    className="fixed inset-0 z-10 cursor-default"
                                    onClick={() => setMonthFromMenuOpen(false)}
                                    aria-label="Close from month menu"
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMonthFromMenuOpen((prev) => !prev);
                                    setMonthToMenuOpen(false);
                                  }}
                                  className="relative z-20 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
                                >
                                  <span>{monthRangeFrom ? getMonthLabel(monthRangeFrom) : "From month"}</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9" />
                                  </svg>
                                </button>
                                {monthFromMenuOpen && (
                                  <div className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMonthRangeFrom(null);
                                        setMonthFromMenuOpen(false);
                                      }}
                                      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
                                        monthRangeFrom === null ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-100"
                                      }`}
                                    >
                                      <span>Any month</span>
                                      {monthRangeFrom === null && <span className="text-xs text-emerald-700">Active</span>}
                                    </button>
                                    {MONTH_OPTIONS.map((option) => (
                                      <button
                                        key={`from-menu-${option.value}`}
                                        type="button"
                                        onClick={() => {
                                          setMonthRangeFrom(option.value);
                                          setMonthFromMenuOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
                                          monthRangeFrom === option.value
                                            ? "bg-emerald-50 text-emerald-800"
                                            : "text-slate-700 hover:bg-slate-100"
                                        }`}
                                      >
                                        <span>{option.label}</span>
                                        {monthRangeFrom === option.value && <span className="text-xs text-emerald-700">Active</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span className="justify-self-center text-sm font-semibold text-slate-500">to</span>
                              <div className="relative">
                                {monthToMenuOpen && (
                                  <button
                                    type="button"
                                    className="fixed inset-0 z-10 cursor-default"
                                    onClick={() => setMonthToMenuOpen(false)}
                                    aria-label="Close to month menu"
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMonthToMenuOpen((prev) => !prev);
                                    setMonthFromMenuOpen(false);
                                  }}
                                  className="relative z-20 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
                                >
                                  <span>{monthRangeTo ? getMonthLabel(monthRangeTo) : "To month"}</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9" />
                                  </svg>
                                </button>
                                {monthToMenuOpen && (
                                  <div className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMonthRangeTo(null);
                                        setMonthToMenuOpen(false);
                                      }}
                                      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
                                        monthRangeTo === null ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-100"
                                      }`}
                                    >
                                      <span>Any month</span>
                                      {monthRangeTo === null && <span className="text-xs text-emerald-700">Active</span>}
                                    </button>
                                    {MONTH_OPTIONS.map((option) => (
                                      <button
                                        key={`to-menu-${option.value}`}
                                        type="button"
                                        onClick={() => {
                                          setMonthRangeTo(option.value);
                                          setMonthToMenuOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
                                          monthRangeTo === option.value
                                            ? "bg-emerald-50 text-emerald-800"
                                            : "text-slate-700 hover:bg-slate-100"
                                        }`}
                                      >
                                        <span>{option.label}</span>
                                        {monthRangeTo === option.value && <span className="text-xs text-emerald-700">Active</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
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
                              setMonthFromMenuOpen(false);
                              setMonthToMenuOpen(false);
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

              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
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
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <Users className="h-4.5 w-4.5" />
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
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <FaChalkboardTeacher className="h-4.5 w-4.5" />
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
                      <p className="text-sm font-medium text-slate-600">Current Report Submission Rate</p>
                    </div>
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <BarChart3 className="h-4.5 w-4.5" />
                    </span>
                  </div>
                </button>
              </div>

              <section className="mb-8">
                <div className="mt-3 grid grid-cols-1 gap-4">
                  <GlassChartCard title="Performance Trend" subtitle="Average remedial score trend over time.">
                    <div className="mb-3 flex items-center justify-end gap-2">
                    </div>
                    {hasPerformanceTrendData ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={performanceTrendSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                          <XAxis dataKey="period" tick={{ fill: palette.text, fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fill: palette.text, fontSize: 11 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke={palette.primary} strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 text-sm font-medium text-slate-500">
                        No performance trend data available.
                      </div>
                    )}
                  </GlassChartCard>
                </div>
              </section>

              <section className="mb-8">
                <div className="mt-3 grid grid-cols-1 gap-4">
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
                    <GlassChartCard title="Remedial Average Heatmap" subtitle="Average remedial performance score per subject and grade level.">
                      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 text-sm font-medium text-slate-500">
                        No remedial average data available.
                      </div>
                    </GlassChartCard>
                  )}
                </div>
              </section>

              <section>
                <div className="mt-3 grid grid-cols-1 gap-4">
                  <GlassChartCard title="Students per Subject Ratio" subtitle="Distinct students participating in remedial sessions by subject.">
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
                          <Tooltip formatter={(value: number, name: string, item: { payload?: { percentage?: number } }) => [`${value} (${item?.payload?.percentage ?? 0}%)`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 text-sm font-medium text-slate-500">
                        No student participation data available.
                      </div>
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
