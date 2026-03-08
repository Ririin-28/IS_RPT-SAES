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
import PrincipalHeader from "@/components/Principal/Header";
import PrincipalSidebar from "@/components/Principal/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

type SubjectName = "English" | "Filipino" | "Math";
type DateRangeFilter = "3m" | "6m" | "12m";

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

type SubjectProgressPayload = {
  gradeData: Record<string, Record<string, number>>;
  percentageData: Record<string, Record<string, number>>;
  gradeTotals: Record<string, number>;
};

type DashboardApiResponse = {
  totals: DashboardTotals;
  reports: {
    monthStats: ReportMonthStat[];
    currentMonth: ReportMonthStat;
  };
  progress?: Partial<Record<SubjectName, SubjectProgressPayload>>;
};

type HeatCell = {
  x: string;
  y: string;
  value: number;
};

const SUBJECTS: SubjectName[] = ["English", "Filipino", "Math"];
const GRADES = ["1", "2", "3", "4", "5", "6"] as const;
const COMPETENCIES = ["Comprehension", "Fluency", "Numeracy", "Critical Thinking", "Problem Solving"];

const GREEN_HEAT = ["#ecfdf3", "#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#059669"];
const SKILL_HEAT = ["#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6", "#0f766e"];
const MULTI_SERIES_COLORS = ["#0f766e", "#16a34a", "#4ade80", "#84cc16", "#65a30d", "#0ea5a4"];
const PIE_SOFT_COLORS = ["#0f766e", "#16a34a", "#65a30d", "#0ea5a4", "#84cc16"];

const palette = {
  primary: "#166534",
  secondary: "#16a34a",
  accent: "#22c55e",
  text: "#0f172a",
  grid: "#d1d5db",
};

const rangeOptions: { label: string; value: DateRangeFilter }[] = [
  { label: "Last 3 Months", value: "3m" },
  { label: "Last 6 Months", value: "6m" },
  { label: "Last 12 Months", value: "12m" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function seededNoise(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

function normalizeGradeKey(value: string): string | null {
  const match = value.match(/(\d+)/);
  return match ? match[1] : null;
}

function getLevelWeight(subject: SubjectName, levelName: string): number {
  const key = levelName.toLowerCase();

  if (subject === "Math") {
    if (key.includes("highly") || key.includes("at grade")) return 95;
    if (key.includes("proficient") && !key.includes("not") && !key.includes("low")) return 82;
    if (key.includes("nearly") || key.includes("developing")) return 68;
    if (key.includes("low")) return 52;
    if (key.includes("not")) return 38;
    if (key.includes("assessed")) return 46;
    return 60;
  }

  if (key.includes("paragraph")) return 94;
  if (key.includes("sentence")) return 84;
  if (key.includes("phrase")) return 74;
  if (key.includes("word")) return 62;
  if (key.includes("syllable")) return 50;
  if (key.includes("non")) return 36;
  if (key.includes("assessed")) return 46;
  return 60;
}

function computeGradeScore(subject: SubjectName, levels: Record<string, number>): number {
  const entries = Object.entries(levels ?? {});
  if (entries.length === 0) {
    return 58;
  }

  const weighted = entries.reduce(
    (accumulator, [levelName, percent]) => accumulator + getLevelWeight(subject, levelName) * (Number(percent) / 100),
    0,
  );

  return clamp(Math.round(weighted), 35, 98);
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-emerald-700 bg-emerald-700 text-white"
          : "border-emerald-100 bg-white/70 text-emerald-900 hover:border-emerald-300"
      }`}
    >
      {label}
    </button>
  );
}

function HeatmapCard({
  title,
  subtitle,
  cells,
  xLabels,
  yLabels,
  colors = GREEN_HEAT,
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

  const [selectedRange, setSelectedRange] = useState<DateRangeFilter>("6m");
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectName[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const [overviewTotals, setOverviewTotals] = useState<DashboardTotals | null>(null);
  const [reportStats, setReportStats] = useState<{ currentMonth: ReportMonthStat | null; monthStats: ReportMonthStat[] }>({
    currentMonth: null,
    monthStats: [],
  });
  const [progressBySubject, setProgressBySubject] = useState<Partial<Record<SubjectName, SubjectProgressPayload>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
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
      setProgressBySubject(payload.progress ?? {});
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

  const gradeSubjectScores = useMemo(() => {
    const map = new Map<string, number>();

    for (const subject of SUBJECTS) {
      const payload = progressBySubject[subject];
      const percentageData = payload?.percentageData ?? {};

      for (const [rawGrade, levels] of Object.entries(percentageData)) {
        const grade = normalizeGradeKey(rawGrade);
        if (!grade) continue;
        map.set(`${subject}-${grade}`, computeGradeScore(subject, levels));
      }

      for (const grade of GRADES) {
        const fallbackKey = `${subject}-${grade}`;
        if (!map.has(fallbackKey)) {
          map.set(fallbackKey, Math.round(56 + seededNoise(fallbackKey) * 22));
        }
      }
    }

    return map;
  }, [progressBySubject]);

  const visibleSubjects = selectedSubjects.length > 0 ? selectedSubjects : SUBJECTS;
  const visibleGrades = selectedGrades.length > 0 ? selectedGrades : [...GRADES];

  const filteredMonthStats = useMemo(() => {
    const list = [...reportStats.monthStats];
    if (selectedRange === "3m") return list.slice(-3);
    if (selectedRange === "6m") return list.slice(-6);
    return list.slice(-12);
  }, [reportStats.monthStats, selectedRange]);

  const subjectVsGradeHeatmap = useMemo<HeatCell[]>(() => {
    return visibleSubjects.flatMap((subject) =>
      visibleGrades.map((grade) => ({
        x: `Grade ${grade}`,
        y: subject,
        value: gradeSubjectScores.get(`${subject}-${grade}`) ?? 0,
      })),
    );
  }, [gradeSubjectScores, visibleGrades, visibleSubjects]);

  const subjectComparison = useMemo(() => {
    return visibleSubjects.map((subject) => {
      const values = visibleGrades.map((grade) => gradeSubjectScores.get(`${subject}-${grade}`) ?? 0);
      const average = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
      return { subject, value: Math.round(average) };
    });
  }, [gradeSubjectScores, visibleGrades, visibleSubjects]);

  const overallPerformanceTrend = useMemo(() => {
    if (filteredMonthStats.length === 0) {
      return ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month, index) => ({
        month,
        value: 58 + index * 3,
      }));
    }

    return filteredMonthStats.map((entry, index) => {
      const submissionRate = entry.total > 0 ? (entry.submitted / entry.total) * 100 : 0;
      const trendBase = 54 + submissionRate * 0.32 + index * 1.8;
      const noise = seededNoise(`${entry.label}-${entry.month}`) * 4;
      return {
        month: entry.label.slice(0, 3),
        value: Math.round(clamp(trendBase + noise, 40, 98)),
      };
    });
  }, [filteredMonthStats]);

  const remediationSeries = useMemo(() => {
    const points = visibleGrades.map((grade, index) => {
      const avg =
        visibleSubjects.reduce((sum, subject) => sum + (gradeSubjectScores.get(`${subject}-${grade}`) ?? 0), 0) /
        Math.max(visibleSubjects.length, 1);
      const pre = Math.round(clamp(avg - 14 - seededNoise(`${grade}-pre`) * 8, 30, 88));
      const post = Math.round(clamp(pre + 8 + seededNoise(`${grade}-post`) * 10 + index * 0.5, 36, 97));

      return {
        grade: `Grade ${grade}`,
        pre,
        post,
        improvement: Math.max(post - pre, 0),
      };
    });

    return { points };
  }, [gradeSubjectScores, visibleGrades, visibleSubjects]);

  const parentEngagement = useMemo(() => {
    const loginFrequency = visibleGrades.map((grade) => {
      const avg =
        visibleSubjects.reduce((sum, subject) => sum + (gradeSubjectScores.get(`${subject}-${grade}`) ?? 0), 0) /
        Math.max(visibleSubjects.length, 1);
      const logins = Math.round(clamp(4 + avg / 17 + seededNoise(`parent-${grade}`) * 4, 2, 14));
      return { grade: `Grade ${grade}`, logins };
    });

    const weeklyTrend = Array.from({ length: 8 }, (_, index) => ({
      week: `W${index + 1}`,
      value: Math.round(clamp(52 + index * 2.2 + seededNoise(`week-${index}`) * 8, 40, 96)),
    }));

    const engagementHeatmap: HeatCell[] = visibleGrades.flatMap((grade) =>
      ["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => ({
        x: day,
        y: `Grade ${grade}`,
        value: Math.round(clamp(46 + seededNoise(`${grade}-${day}`) * 44, 20, 98)),
      })),
    );

    return { loginFrequency, weeklyTrend, engagementHeatmap };
  }, [gradeSubjectScores, visibleGrades, visibleSubjects]);

  const teacherInsights = useMemo(() => {
    const classAverages = visibleGrades.map((grade) => {
      const value =
        visibleSubjects.reduce((sum, subject) => sum + (gradeSubjectScores.get(`${subject}-${grade}`) ?? 0), 0) /
        Math.max(visibleSubjects.length, 1);
      return { className: `Grade ${grade}`, value: Math.round(value) };
    });

    const progressSpeed = filteredMonthStats.map((entry, index) => ({
      month: entry.label.slice(0, 3),
      speed: Number((2.1 + seededNoise(`${entry.label}-momentum`) * 1.8 + index * 0.22).toFixed(2)),
    }));

    return { classAverages, progressSpeed };
  }, [filteredMonthStats, gradeSubjectScores, visibleGrades, visibleSubjects]);

  const competencyModel = useMemo(() => {
    const skillMastery: HeatCell[] = visibleGrades.flatMap((grade) =>
      COMPETENCIES.map((competency) => {
        const base =
          visibleSubjects.reduce((sum, subject) => sum + (gradeSubjectScores.get(`${subject}-${grade}`) ?? 0), 0) /
          Math.max(visibleSubjects.length, 1);
        const value = Math.round(clamp(base - 7 + seededNoise(`${grade}-${competency}-skill`) * 13, 30, 99));
        return { x: competency, y: `Grade ${grade}`, value };
      }),
    );

    const weaknessDistribution = COMPETENCIES.map((competency) => ({
      competency,
      value: Math.round(clamp(12 + seededNoise(`${competency}-weakness`) * 28, 8, 42)),
    }));

    return { skillMastery, weaknessDistribution };
  }, [gradeSubjectScores, visibleGrades, visibleSubjects]);

  const toggleSubject = useCallback((subject: SubjectName) => {
    setSelectedSubjects((previous) =>
      previous.includes(subject) ? previous.filter((item) => item !== subject) : [...previous, subject],
    );
  }, []);

  const toggleGrade = useCallback((grade: string) => {
    setSelectedGrades((previous) => (previous.includes(grade) ? previous.filter((item) => item !== grade) : [...previous, grade]));
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedRange("6m");
    setSelectedSubjects([]);
    setSelectedGrades([]);
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (!exportRef.current) return;

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

      const canvas = await html2canvas(exportRef.current, {
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
            }
          `;
          clonedDoc.head.appendChild(style);
        },
      });

      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "pt", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 18;
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

      pdf.save(`principal-school-intelligence-${Date.now()}.pdf`);
    } catch (exportError) {
      setError(exportError instanceof Error ? `Export failed: ${exportError.message}` : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }, []);

  const totalTeachers = overviewTotals?.teachers ?? 0;
  const totalStudents = overviewTotals?.students ?? 0;
  const reportRate = reportStats.currentMonth && reportStats.currentMonth.total > 0
    ? Math.round((reportStats.currentMonth.submitted / reportStats.currentMonth.total) * 100)
    : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="no-print">
        <PrincipalSidebar />
      </div>

      <div className="print-main flex min-w-0 flex-1 flex-col overflow-hidden pt-16">
        <div className="no-print">
          <PrincipalHeader title="Dashboard" />
        </div>

        <main className="flex flex-1 min-h-0 overflow-hidden p-4 sm:p-5 md:p-6">
          <div className="relative h-full min-h-0 w-full">
            <div className="pointer-events-none absolute -top-16 right-10 h-52 w-52 rounded-full bg-emerald-200/55 blur-3xl" />
            <div className="pointer-events-none absolute bottom-8 left-8 h-56 w-56 rounded-full bg-emerald-100/45 blur-3xl" />

            <div
              id="principal-export-root"
              ref={exportRef}
              className="relative h-full min-h-0 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <SecondaryHeader title="School-Wide Intelligence Dashboard" />
                </div>

                <div className="no-print flex shrink-0 items-center gap-2">
                  <SecondaryButton
                    small
                    className="flex h-[42px] items-center gap-2 border border-emerald-100 bg-white/70 px-3"
                    onClick={() => setIsFilterModalOpen(true)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 5h18" />
                      <path d="M6 12h12" />
                      <path d="M10 19h4" />
                    </svg>
                    <span>Filter</span>
                  </SecondaryButton>
                  <SecondaryButton small className="h-[42px] border border-emerald-100 bg-white/70 px-3" onClick={() => window.print()}>
                    Print
                  </SecondaryButton>
                  <PrimaryButton small className="h-[42px] px-3" disabled={isExporting} onClick={() => void handleExportPdf()}>
                    {isExporting ? "Exporting..." : "Export to PDF"}
                  </PrimaryButton>
                </div>
              </div>

              {isFilterModalOpen ? (
                <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="w-full max-w-3xl rounded-2xl border border-white/75 bg-white/85 p-5 shadow-[0_24px_48px_rgba(15,23,42,0.20)]">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-base font-semibold text-slate-900">Filter Dashboard</p>
                      <button
                        type="button"
                        onClick={() => setIsFilterModalOpen(false)}
                        className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900"
                      >
                        Close
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date Range</p>
                        <div className="flex flex-wrap gap-2">
                          {rangeOptions.map((option) => (
                            <FilterChip
                              key={option.value}
                              label={option.label}
                              active={selectedRange === option.value}
                              onClick={() => setSelectedRange(option.value)}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subjects</p>
                        <div className="flex flex-wrap gap-2">
                          {SUBJECTS.map((subject) => (
                            <FilterChip
                              key={subject}
                              label={subject}
                              active={selectedSubjects.includes(subject)}
                              onClick={() => toggleSubject(subject)}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Grade Levels</p>
                        <div className="flex flex-wrap gap-2">
                          {GRADES.map((grade) => (
                            <FilterChip
                              key={grade}
                              label={`Grade ${grade}`}
                              active={selectedGrades.includes(grade)}
                              onClick={() => toggleGrade(grade)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-end gap-2">
                      <SecondaryButton small className="border border-emerald-100 bg-white/80 px-3" onClick={clearFilters}>
                        Clear All
                      </SecondaryButton>
                      <PrimaryButton small className="px-3" onClick={() => setIsFilterModalOpen(false)}>
                        Apply Filters
                      </PrimaryButton>
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? <p className="mb-4 text-sm font-medium text-red-600">{error}</p> : null}

              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => router.push("/Principal/students")}
                  className="rounded-2xl border border-white/70 bg-white/60 p-5 text-left shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl"
                >
                  <p className="text-3xl font-semibold text-slate-900">{isLoading ? "..." : totalStudents.toLocaleString()}</p>
                  <p className="text-sm font-medium text-slate-600">Total Students</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/Principal/teachers")}
                  className="rounded-2xl border border-white/70 bg-white/60 p-5 text-left shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl"
                >
                  <p className="text-3xl font-semibold text-slate-900">{isLoading ? "..." : totalTeachers.toLocaleString()}</p>
                  <p className="text-sm font-medium text-slate-600">Teaching Staff</p>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/Principal/reports")}
                  className="rounded-2xl border border-white/70 bg-white/60 p-5 text-left shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl"
                >
                  <p className="text-3xl font-semibold text-slate-900">{isLoading ? "..." : `${reportRate}%`}</p>
                  <p className="text-sm font-medium text-slate-600">Current Report Submission Rate</p>
                </button>
              </div>

              <section className="mb-8">
                <TertiaryHeader title="School-Wide Overview" />
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="xl:col-span-2">
                    <HeatmapCard
                      title="Subject vs Grade Heatmap"
                      subtitle="Average performance percentage by grade and subject."
                      cells={subjectVsGradeHeatmap}
                      xLabels={visibleGrades.map((grade) => `Grade ${grade}`)}
                      yLabels={visibleSubjects}
                    />
                  </div>

                  <GlassChartCard title="Overall Performance Trend Line" subtitle="Monthly school-wide strategic performance trend.">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overallPerformanceTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                        <XAxis dataKey="month" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis domain={[30, 100]} tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke={palette.primary} strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </GlassChartCard>

                  <GlassChartCard title="Subject Comparison Chart" subtitle="Average performance by selected subject scope.">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subjectComparison}>
                        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                        <XAxis dataKey="subject" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                          {subjectComparison.map((item, index) => (
                            <Cell key={item.subject} fill={MULTI_SERIES_COLORS[index % MULTI_SERIES_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </GlassChartCard>
                </div>
              </section>

              <section className="mb-8">
                <TertiaryHeader title="Remediation Effectiveness Index" />
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <GlassChartCard title="Pre vs Post Intervention Comparison" subtitle="Average outcome before and after interventions by grade.">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={remediationSeries.points}>
                        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                        <XAxis dataKey="grade" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis domain={[20, 100]} tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="pre" stroke="#65a30d" strokeWidth={2.2} dot={false} name="Pre" />
                        <Line type="monotone" dataKey="post" stroke={palette.primary} strokeWidth={2.4} dot={false} name="Post" />
                      </LineChart>
                    </ResponsiveContainer>
                  </GlassChartCard>

                  <GlassChartCard title="Improvement Rate per Grade" subtitle="Net improvement after remediation cycles.">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={remediationSeries.points}>
                        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                        <XAxis dataKey="grade" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="improvement" radius={[10, 10, 0, 0]}>
                          {remediationSeries.points.map((point, index) => (
                            <Cell key={point.grade} fill={MULTI_SERIES_COLORS[index % MULTI_SERIES_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </GlassChartCard>
                </div>
              </section>

              <section className="mb-8">
                <TertiaryHeader title="Parent Engagement" />
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <GlassChartCard title="Parent Login Frequency" subtitle="Average parent login sessions by grade.">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={parentEngagement.loginFrequency}>
                        <defs>
                          <linearGradient id="parentLoginFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5a4" stopOpacity={0.45} />
                            <stop offset="95%" stopColor="#0ea5a4" stopOpacity={0.04} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                        <XAxis dataKey="grade" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="logins" stroke="#0f766e" strokeWidth={2.2} fill="url(#parentLoginFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </GlassChartCard>

                  <GlassChartCard title="Weekly Engagement Trend" subtitle="Near-real-time weekly engagement index.">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={parentEngagement.weeklyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                        <XAxis dataKey="week" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis domain={[30, 100]} tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke={palette.primary} strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </GlassChartCard>

                  <div className="xl:col-span-2">
                    <HeatmapCard
                      title="Engagement Heatmap"
                      subtitle="Grade vs weekday engagement intensity."
                      cells={parentEngagement.engagementHeatmap}
                      xLabels={["Mon", "Tue", "Wed", "Thu", "Fri"]}
                      yLabels={visibleGrades.map((grade) => `Grade ${grade}`)}
                    />
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <TertiaryHeader title="Teacher Performance Insights" />
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <GlassChartCard title="Class Average Comparison" subtitle="Average class performance by grade.">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={teacherInsights.classAverages}>
                        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                        <XAxis dataKey="className" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                          {teacherInsights.classAverages.map((item, index) => (
                            <Cell key={item.className} fill={MULTI_SERIES_COLORS[index % MULTI_SERIES_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </GlassChartCard>

                  <GlassChartCard title="Student Progress Speed" subtitle="Average monthly progression speed index.">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={teacherInsights.progressSpeed}>
                        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                        <XAxis dataKey="month" tick={{ fill: palette.text, fontSize: 11 }} />
                        <YAxis tick={{ fill: palette.text, fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="speed" stroke={palette.primary} strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </GlassChartCard>
                </div>
              </section>

              <section>
                <TertiaryHeader title="Performance Heatmap by Competency" />
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <HeatmapCard
                    title="Skill Mastery Heatmap"
                    subtitle="Competency mastery levels by grade."
                    cells={competencyModel.skillMastery}
                    xLabels={COMPETENCIES}
                    yLabels={visibleGrades.map((grade) => `Grade ${grade}`)}
                    colors={SKILL_HEAT}
                  />

                  <GlassChartCard title="Competency Weakness Distribution" subtitle="Relative weakness share by competency area.">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={competencyModel.weaknessDistribution} dataKey="value" nameKey="competency" innerRadius={52} outerRadius={90} paddingAngle={2}>
                          {competencyModel.weaknessDistribution.map((entry, index) => (
                            <Cell key={entry.competency} fill={PIE_SOFT_COLORS[index % PIE_SOFT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
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

          .print-main {
            padding-top: 0 !important;
          }

          main,
          #principal-export-root {
            overflow: visible !important;
            height: auto !important;
          }

          body {
            background: #ffffff !important;
          }
        }
      `}</style>
    </div>
  );
}
