"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Filter, Printer } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend as ReLegend,
  Cell,
} from "recharts";
import RemedialTeacherSidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import MasterTeacherHeader from "@/components/MasterTeacher/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

function DashboardMetricCard({
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
  const cardClassName =
    "cursor-pointer rounded-xl border border-white/70 bg-white/60 px-4 py-3 text-left shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)]";

  const content = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        <p className="text-sm font-medium text-slate-600">{label}</p>
      </div>
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-700 bg-emerald-100 text-emerald-700">
        {icon}
      </span>
    </div>
  );

  if (typeof onClick === "function") {
    return (
      <button type="button" onClick={onClick} className={cardClassName}>
        {content}
      </button>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}

const EnglishCardIcon = () => (
  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-[15px] font-bold leading-none text-emerald-700">
    E
  </span>
);

const FilipinoCardIcon = () => (
  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-[15px] font-bold leading-none text-emerald-700">
    F
  </span>
);

const MathCardIcon = () => (
  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-[15px] font-bold leading-none text-emerald-700">
    M
  </span>
);

type TeacherProfile = {
  fullName: string;
  role: string;
  gradeHandled: string;
  subjectAssigned: string;
};

type TeacherApiResponse = {
  success: boolean;
  profile?: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    grade?: string | null;
    gradeLabel?: string | null;
    subjectHandled?: string | null;
    role?: string | null;
  } | null;
  error?: string;
};

type RemedialCountsResponse = {
  success: boolean;
  counts?: {
    English?: number | null;
    Filipino?: number | null;
    Math?: number | null;
  };
  trends?: TrendPayload;
  metadata?: {
    hasGradeContext?: boolean;
  };
  error?: string;
};

type TrendSubjectData = {
  weekly: number[];
  monthly: number[];
  levelLabels: string[];
  levelDistributionByMonth: Record<string, number[]>;
};

type TrendPayload = {
  months: Array<{ key: string; label: string }>;
  weeks: string[];
  subjects: Record<keyof SubjectCountsState, TrendSubjectData>;
};

type SubjectCountsState = {
  English: number;
  Filipino: number;
  Math: number;
};

type SubjectKey = "english" | "filipino" | "math";
type SubjectFilter = "All Subjects" | "English" | "Filipino" | "Math";

type DashboardStudentRow = {
  studentId?: string | null;
  section?: string | null;
  english?: string | null;
  filipino?: string | null;
  math?: string | null;
};

const REMEDIAL_SUBJECTS = ["English", "Filipino", "Math"] as const;

const PHONEMIC_LEVELS: Record<SubjectKey, string[]> = {
  english: ["Non-Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],
  filipino: ["Non-Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],
  math: ["Not Proficient", "Low Proficient", "Nearly Proficient", "Proficient", "Highly Proficient"],
};

function normalizePhonemicLevel(level: string | null | undefined, subject: SubjectKey): string | null {
  const text = typeof level === "string" ? level.trim().toLowerCase() : "";
  if (!text) return null;

  if (subject === "math") {
    if (text.includes("not proficient") || text.includes("emerging - not")) return "Not Proficient";
    if (text.includes("low proficient") || text.includes("emerging - low")) return "Low Proficient";
    if (text.includes("nearly proficient") || text.includes("developing")) return "Nearly Proficient";
    if (text.includes("highly proficient") || text.includes("at grade level")) return "Highly Proficient";
    if (text.includes("proficient") || text.includes("transitioning")) return "Proficient";
    return null;
  }

  if (text.includes("non-reader") || text.includes("non reader")) return "Non-Reader";
  if (text.includes("syllable")) return "Syllable";
  if (text.includes("word")) return "Word";
  if (text.includes("phrase")) return "Phrase";
  if (text.includes("sentence")) return "Sentence";
  if (text.includes("paragraph")) return "Paragraph";

  return null;
}

const dashboardPrimary = "#1f5f46";
const dashboardSecondary = "#2f7d57";
const dashboardWarn = "#bc8b5b";
const chartMultiPalette = ["#0f766e", "#16a34a", "#65a30d", "#0ea5a4", "#84cc16", "#2f7d57"];

const ROLE_LABELS: Record<string, string> = {
  teacher: "Teacher",
  master_teacher: "Master Teacher",
  coordinator: "Coordinator",
};

function formatRoleLabel(role?: string | null): string {
  if (!role) return "Teacher";
  const key = role.toLowerCase().replace(/[\s-]+/g, "_");
  return ROLE_LABELS[key] ?? role;
}

function toSubjectKey(subject: string): SubjectKey {
  const normalized = subject.toLowerCase();
  if (normalized === "english") return "english";
  if (normalized === "filipino") return "filipino";
  return "math";
}

function normalizeSubjectList(raw?: string | null): Array<(typeof REMEDIAL_SUBJECTS)[number]> {
  if (!raw) return ["English", "Filipino", "Math"];
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const value = part.toLowerCase();
      if (value === "english") return "English";
      if (value === "filipino") return "Filipino";
      if (value === "math" || value === "mathematics") return "Math";
      return null;
    })
    .filter((part): part is (typeof REMEDIAL_SUBJECTS)[number] => part !== null);

  return parts.length > 0 ? Array.from(new Set(parts)) : ["English", "Filipino", "Math"];
}

export default function TeacherDashboard() {
  const router = useRouter();
  const handleNavigate = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [handledCounts, setHandledCounts] = useState<SubjectCountsState>({
    English: 0,
    Filipino: 0,
    Math: 0,
  });
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [countsError, setCountsError] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<TrendPayload | null>(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(true);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const [dashboardUserId, setDashboardUserId] = useState<string | number | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [monthRangeFrom, setMonthRangeFrom] = useState<string | null>(null);
  const [monthRangeTo, setMonthRangeTo] = useState<string | null>(null);
  const [monthFromMenuOpen, setMonthFromMenuOpen] = useState(false);
  const [monthToMenuOpen, setMonthToMenuOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>("English");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [studentRows, setStudentRows] = useState<DashboardStudentRow[]>([]);
  const [studentsLoadError, setStudentsLoadError] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;

    async function loadCounts(userId: string | number) {
      setIsLoadingCounts(true);
      setIsLoadingTrends(true);
      setCountsError(null);
      setTrendsError(null);
      try {
        const response = await fetch(`/api/master_teacher/remedialteacher/dashboard?userId=${encodeURIComponent(String(userId))}`, {
          cache: "no-store",
        });
        const payload: RemedialCountsResponse | null = await response.json().catch(() => null);

        if (cancelled) return;

        if (!response.ok || !payload?.success || !payload.counts) {
          const message = payload?.error ?? "Unable to load handled student counts.";
          throw new Error(message);
        }

        setHandledCounts({
          English: Number(payload.counts.English) || 0,
          Filipino: Number(payload.counts.Filipino) || 0,
          Math: Number(payload.counts.Math) || 0,
        });
        setTrendData(payload.trends ?? null);

        setCountsError(null);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load handled student counts.";
          setCountsError(message);
          setHandledCounts({ English: 0, Filipino: 0, Math: 0 });
          setTrendData(null);
          setTrendsError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCounts(false);
          setIsLoadingTrends(false);
        }
      }
    }

    async function loadTeacherProfile() {
      setIsLoadingProfile(true);
      setProfileError(null);
      try {
        const storedProfile = getStoredUserProfile();
        const userId = storedProfile?.userId;

        if (!userId) {
          throw new Error("Missing user information. Please log in again.");
        }

        const response = await fetch("/api/master_teacher/profile", { cache: "no-store" });

        const payload: TeacherApiResponse | null = await response.json().catch(() => null);

        if (cancelled) return;

        if (!response.ok || !payload?.success || !payload.profile) {
          const message = payload?.error ?? "Unable to load teacher profile.";
          throw new Error(message);
        }

        const nameParts = [payload.profile.firstName, payload.profile.middleName, payload.profile.lastName].filter(
          (part): part is string => typeof part === "string" && part.trim().length > 0
        );

        const teacherName = nameParts.length > 0 ? nameParts.join(" ") : "Teacher";
        setDashboardUserId(userId);
        setSelectedSubject("English");
        setSubjectFilter("English");

        setTeacherProfile({
          fullName: teacherName,
          role: "Teacher",
          gradeHandled: payload.profile.gradeLabel?.trim() || payload.profile.grade?.trim() || "Not assigned",
          subjectAssigned: "All Subjects",
        });

        await loadCounts(userId);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load profile.";
          setProfileError(message);
          setTeacherProfile(null);
          setIsLoadingCounts(false);
          setCountsError((prev) => prev ?? "Unable to load handled student counts.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    }

    loadTeacherProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const [selectedSubject, setSelectedSubject] = useState("English");
  const fallbackMonths = ["September", "October", "November", "December", "January", "February", "March"];
  const monthOptions = trendData?.months?.length ? trendData.months.map((item) => item.label) : fallbackMonths;
  const filterMonthOptions = useMemo(
    () =>
      trendData?.months?.length
        ? trendData.months.map((item) => ({ key: item.key, label: item.label }))
        : fallbackMonths.map((label, index) => ({ key: `fallback-${index}`, label })),
    [trendData?.months]
  );

  const selectedSubjectKey = useMemo<SubjectKey>(() => toSubjectKey(selectedSubject), [selectedSubject]);

  const sectionOptions = useMemo(() => {
    return Array.from(
      new Set(studentRows.map((row) => (typeof row.section === "string" ? row.section.trim() : "")).filter((section) => section.length > 0))
    ).sort((a, b) => a.localeCompare(b));
  }, [studentRows]);

  const monthRangeIndices = useMemo(() => {
    const resolveIndex = (key: string | null) => filterMonthOptions.findIndex((item) => item.key === key);
    return {
      from: resolveIndex(monthRangeFrom),
      to: resolveIndex(monthRangeTo),
    };
  }, [filterMonthOptions, monthRangeFrom, monthRangeTo]);

  const shouldIncludeByRange = useCallback(
    (index: number) => {
      const from = monthRangeIndices.from;
      const to = monthRangeIndices.to;
      if (from === -1 || to === -1) return true;
      if (from <= to) return index >= from && index <= to;
      return index >= from || index <= to;
    },
    [monthRangeIndices.from, monthRangeIndices.to]
  );

  const filteredMonthIndices = useMemo(() => {
    return filterMonthOptions.map((_, index) => index).filter((index) => shouldIncludeByRange(index));
  }, [filterMonthOptions, shouldIncludeByRange]);

  const fallbackLevelLabels =
    selectedSubject === "Math"
      ? [
          "Emerging - Not Proficient",
          "Emerging - Low Proficient",
          "Developing - Nearly Proficient",
          "Transitioning - Proficient",
          "At Grade Level - Highly Proficient",
        ]
      : ["Non-Reader", "Syllable Reader", "Word Reader", "Phrase Reader", "Sentence Reader", "Paragraph Reader"];

  const subjectTrend = trendData?.subjects?.[selectedSubject as keyof SubjectCountsState];
  const resolvedLevelLabels = subjectTrend?.levelLabels?.length ? subjectTrend.levelLabels : fallbackLevelLabels;
  const periodLabels = monthOptions;
  const periodValues = subjectTrend?.monthly;
  const normalizedPeriodValues = periodLabels.map((_, index) => periodValues?.[index] ?? 0);
  const filteredPeriodLabels = filteredMonthIndices.map((index) => periodLabels[index]).filter(Boolean);
  const filteredPeriodValues = filteredMonthIndices.map((index) => normalizedPeriodValues[index] ?? 0);

  const monthKey = (() => {
    if (!trendData?.months?.length) return null;
    const lastIncludedIndex = filteredMonthIndices.length
      ? filteredMonthIndices[filteredMonthIndices.length - 1]
      : trendData.months.length - 1;
    return trendData.months[lastIncludedIndex]?.key ?? null;
  })();
  const distributionValues = monthKey ? subjectTrend?.levelDistributionByMonth?.[monthKey] : undefined;
  const normalizedDistributionValues = resolvedLevelLabels.map((_, index) => distributionValues?.[index] ?? 0);

  const levelKeyByIndex = useMemo(
    () => resolvedLevelLabels.map((_, index) => `level_${index}`),
    [resolvedLevelLabels]
  );

  const monthlyLevelProgressData = useMemo(
    () =>
      filteredMonthIndices.map((index) => {
        const monthLabel = periodLabels[index] ?? "";
        const monthKey = trendData?.months?.[index]?.key;
        const values = monthKey ? subjectTrend?.levelDistributionByMonth?.[monthKey] : undefined;
        const row: Record<string, number | string> = { month: monthLabel.slice(0, 3) };
        levelKeyByIndex.forEach((key, levelIndex) => {
          row[key] = values?.[levelIndex] ?? 0;
        });
        return row;
      }),
    [filteredMonthIndices, levelKeyByIndex, periodLabels, subjectTrend?.levelDistributionByMonth, trendData?.months]
  );

  const interventionLevelData = useMemo(() => {
    const firstIndex = filteredMonthIndices.length ? filteredMonthIndices[0] : 0;
    const lastIndex = filteredMonthIndices.length ? filteredMonthIndices[filteredMonthIndices.length - 1] : firstIndex;
    const firstKey = trendData?.months?.[firstIndex]?.key;
    const lastKey = trendData?.months?.[lastIndex]?.key;
    const firstValues = firstKey ? subjectTrend?.levelDistributionByMonth?.[firstKey] : undefined;
    const lastValues = lastKey ? subjectTrend?.levelDistributionByMonth?.[lastKey] : undefined;

    return resolvedLevelLabels.map((level, index) => ({
      level,
      before: firstValues?.[index] ?? 0,
      after: lastValues?.[index] ?? 0,
      color: chartMultiPalette[index % chartMultiPalette.length],
    }));
  }, [filteredMonthIndices, resolvedLevelLabels, subjectTrend?.levelDistributionByMonth, trendData?.months]);

  useEffect(() => {
    let cancelled = false;

    const loadStudents = async () => {
      if (!dashboardUserId) return;
      try {
        setStudentsLoadError(null);
        const response = await fetch(
          `/api/master_teacher/remedialteacher/students?userId=${encodeURIComponent(String(dashboardUserId))}&subject=${encodeURIComponent(selectedSubject.toLowerCase())}`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          students?: DashboardStudentRow[];
          error?: string;
        } | null;

        if (cancelled) return;

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? "Failed to load student list for dashboard filters.");
        }

        setStudentRows(Array.isArray(payload.students) ? payload.students : []);
      } catch (error) {
        if (!cancelled) {
          setStudentsLoadError(error instanceof Error ? error.message : "Failed to load student list for dashboard filters.");
          setStudentRows([]);
        }
      }
    };

    void loadStudents();

    return () => {
      cancelled = true;
    };
  }, [dashboardUserId, selectedSubject]);

  useEffect(() => {
    setSelectedSections((prev) => prev.filter((section) => sectionOptions.includes(section)));
  }, [sectionOptions]);

  const filteredStudentRows = useMemo(() => {
    return studentRows.filter((row) => {
      const sectionMatch = selectedSections.length === 0 || (typeof row.section === "string" && selectedSections.includes(row.section));
      return sectionMatch;
    });
  }, [studentRows, selectedSections]);

  const filteredHandledCount = useMemo(() => filteredStudentRows.length, [filteredStudentRows]);

  const phonemicLevelPieData = useMemo(() => {
    const levelMap = new Map<string, number>();
    filteredStudentRows.forEach((row) => {
      const normalized = normalizePhonemicLevel(row[selectedSubjectKey], selectedSubjectKey);
      if (!normalized) return;
      levelMap.set(normalized, (levelMap.get(normalized) ?? 0) + 1);
    });
    return PHONEMIC_LEVELS[selectedSubjectKey]
      .map((name, index) => ({
        name,
        value: levelMap.get(name) ?? 0,
        color: chartMultiPalette[index % chartMultiPalette.length],
      }))
      .filter((item) => item.value > 0)
      .map((item) => ({ ...item }));
  }, [filteredStudentRows, selectedSubjectKey]);

  const toggleSection = useCallback((section: string) => {
    setSelectedSections((prev) => {
      if (prev.includes(section)) {
        return prev.filter((item) => item !== section);
      }
      return [...prev, section];
    });
  }, []);

  const clearFilters = useCallback(() => {
    setMonthRangeFrom(null);
    setMonthRangeTo(null);
    setMonthFromMenuOpen(false);
    setMonthToMenuOpen(false);
    setSubjectFilter("All Subjects");
    setSelectedSubject("English");
    setSelectedSections([]);
  }, []);

  const hasPhonemicLevelPieData = useMemo(() => phonemicLevelPieData.some((item) => item.value > 0), [phonemicLevelPieData]);

  const gradeNumberLabel = useMemo(() => {
    const raw = teacherProfile?.gradeHandled ?? "";
    const normalized = raw.replace(/^grade\s*/i, "").trim();
    return normalized.length > 0 ? `Grade ${normalized}` : "Grade";
  }, [teacherProfile?.gradeHandled]);

  const handlePrintDashboard = useCallback(() => {
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

  return (
    <div className="dashboard-page">
      <div className="dashboard-live relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      <div className="no-print">
        <RemedialTeacherSidebar />
      </div>

      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <div className="no-print">
          <MasterTeacherHeader title="Dashboard" />
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="relative p-4 h-full sm:p-5 md:p-6">
            <div className="relative h-full min-h-100 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">
              <div className="mb-3 flex flex-col md:flex-row md:items-center md:justify-between">
                <SecondaryHeader title="Teacher's Profile" />
              </div>

              <div className="mb-6 min-w-full rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg sm:mb-7 sm:p-5 md:mb-8 md:p-6">
                {isLoadingProfile ? (
                  <div className="flex h-full items-center justify-center">
                    <BodyText title="Loading profile..." />
                  </div>
                ) : profileError ? (
                  <div className="flex h-full items-center justify-center">
                    <BodyText title={profileError} />
                  </div>
                ) : teacherProfile ? (
                  <div className="grid grid-cols-1 gap-2 text-sm font-medium text-slate-700 sm:text-base md:grid-cols-4 md:gap-0">
                    <div className="md:border-r md:border-slate-200 md:pr-3">
                      <p className="font-semibold text-slate-900 md:text-center">{teacherProfile.fullName}</p>
                    </div>
                    <div className="md:border-r md:border-slate-200 md:px-3">
                      <p className="font-semibold text-slate-900 md:text-center">{teacherProfile.role}</p>
                    </div>
                    <div className="md:border-r md:border-slate-200 md:px-3">
                      <p className="font-semibold text-slate-900 md:text-center">{gradeNumberLabel}</p>
                    </div>
                    <div className="md:pl-3">
                      <p className="font-semibold text-slate-900 md:text-center">{teacherProfile.subjectAssigned}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BodyText title="No profile data available." />
                  </div>
                )}
              </div>

              <hr className="mb-4 border-gray-200 sm:mb-5 md:mb-6" />

              <div className="mb-5 flex items-start justify-between gap-3">
                <SecondaryHeader title="Remedial Overview" />

                <div className="flex shrink-0 items-center gap-2">
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
                      <Filter className="h-4.5 w-4.5" />
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
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject</p>
                            <div className="flex flex-wrap gap-2">
                              {(["All Subjects", ...REMEDIAL_SUBJECTS] as SubjectFilter[]).map((subject) => (
                                <button
                                  key={subject}
                                  type="button"
                                  onClick={() => {
                                    setSubjectFilter(subject);
                                    if (subject !== "All Subjects") {
                                      setSelectedSubject(subject);
                                    }
                                  }}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                    subjectFilter === subject
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
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date Range</p>
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
                                  <span>
                                    {monthRangeFrom
                                      ? (filterMonthOptions.find((item) => item.key === monthRangeFrom)?.label ?? "From month")
                                      : "From month"}
                                  </span>
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 text-slate-500"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
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
                                    {filterMonthOptions.map((option) => (
                                      <button
                                        key={`from-menu-${option.key}`}
                                        type="button"
                                        onClick={() => {
                                          setMonthRangeFrom(option.key);
                                          setMonthFromMenuOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
                                          monthRangeFrom === option.key
                                            ? "bg-emerald-50 text-emerald-800"
                                            : "text-slate-700 hover:bg-slate-100"
                                        }`}
                                      >
                                        <span>{option.label}</span>
                                        {monthRangeFrom === option.key && <span className="text-xs text-emerald-700">Active</span>}
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
                                  <span>
                                    {monthRangeTo
                                      ? (filterMonthOptions.find((item) => item.key === monthRangeTo)?.label ?? "To month")
                                      : "To month"}
                                  </span>
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 text-slate-500"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
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
                                    {filterMonthOptions.map((option) => (
                                      <button
                                        key={`to-menu-${option.key}`}
                                        type="button"
                                        onClick={() => {
                                          setMonthRangeTo(option.key);
                                          setMonthToMenuOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
                                          monthRangeTo === option.key
                                            ? "bg-emerald-50 text-emerald-800"
                                            : "text-slate-700 hover:bg-slate-100"
                                        }`}
                                      >
                                        <span>{option.label}</span>
                                        {monthRangeTo === option.key && <span className="text-xs text-emerald-700">Active</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sections</p>
                            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                              {sectionOptions.map((section) => (
                                <button
                                  key={section}
                                  type="button"
                                  onClick={() => toggleSection(section)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                    selectedSections.includes(section)
                                      ? "border-emerald-700 bg-emerald-700 text-white"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  {section}
                                </button>
                              ))}
                              {sectionOptions.length === 0 ? (
                                <span className="text-xs text-slate-500">No section options available.</span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-emerald-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-900"
                            onClick={clearFilters}
                          >
                            Clear All
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
                            onClick={() => {
                              setIsFilterModalOpen(false);
                              setMonthFromMenuOpen(false);
                              setMonthToMenuOpen(false);
                            }}
                          >
                            Apply Filters
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={handlePrintDashboard}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100"
                    aria-label="Print dashboard"
                    title="Print"
                  >
                    <Printer className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DashboardMetricCard
                  value={isLoadingCounts ? "..." : handledCounts.English.toLocaleString()}
                  label="English Students"
                  icon={<EnglishCardIcon />}
                  onClick={() => handleNavigate("/MasterTeacher/RemedialTeacher/students/subject/english")}
                />
                <DashboardMetricCard
                  value={isLoadingCounts ? "..." : handledCounts.Filipino.toLocaleString()}
                  label="Filipino Students"
                  icon={<FilipinoCardIcon />}
                  onClick={() => handleNavigate("/MasterTeacher/RemedialTeacher/students/subject/filipino")}
                />
                <DashboardMetricCard
                  value={isLoadingCounts ? "..." : handledCounts.Math.toLocaleString()}
                  label="Math Students"
                  icon={<MathCardIcon />}
                  onClick={() => handleNavigate("/MasterTeacher/RemedialTeacher/students/subject/math")}
                />
                <DashboardMetricCard value={todayDateLabel} label="Date Today" icon={<CalendarDays className="h-5.5 w-5.5" />} />
              </div>

              {countsError ? (
                <div className="mb-3 text-sm text-red-600" role="alert">
                  {countsError}
                </div>
              ) : null}
              {studentsLoadError ? (
                <div className="mb-6 text-sm text-red-600" role="alert">
                  {studentsLoadError}
                </div>
              ) : null}

              <div className="space-y-8">
                <div>
                  <SecondaryHeader title="Class Progress Overview" />
                  <div className="mt-3 grid grid-cols-1 gap-4">
                    <div className="rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg">
                      <p className="text-sm font-semibold text-slate-700">Monthly Student Progress by Level</p>
                      <div className="mt-3 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyLevelProgressData}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#d1fae5" />
                            <XAxis dataKey="month" />
                            <YAxis allowDecimals={false} />
                            <ReTooltip />
                            <ReLegend />
                            {levelKeyByIndex.map((key, index) => (
                              <Bar
                                key={key}
                                dataKey={key}
                                name={resolvedLevelLabels[index]}
                                stackId="levels"
                                fill={chartMultiPalette[index % chartMultiPalette.length]}
                                radius={index === levelKeyByIndex.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <SecondaryHeader title="Intervention Tracking" />
                  <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <div className="rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg xl:col-span-2">
                      <p className="text-sm font-semibold text-slate-700">Level Distribution Shift (Start vs End)</p>
                      <div className="mt-3 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={interventionLevelData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                            <XAxis dataKey="level" />
                            <YAxis allowDecimals={false} />
                            <ReTooltip />
                            <ReLegend />
                            <Bar dataKey="before" fill={dashboardWarn} radius={[8, 8, 0, 0]} />
                            <Bar dataKey="after" fill={dashboardSecondary} radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg xl:col-span-1">
                      <p className="text-sm font-semibold text-slate-700">Students per Phonemic Level ({selectedSubject})</p>
                      <div className="mt-3 h-64">
                        {hasPhonemicLevelPieData ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={phonemicLevelPieData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={48}
                                outerRadius={90}
                                paddingAngle={2}
                              >
                                {phonemicLevelPieData.map((entry) => (
                                  <Cell key={entry.name} fill={entry.color} />
                                ))}
                              </Pie>
                              <ReLegend />
                              <ReTooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 text-sm font-medium text-slate-500">
                            No phonemic level data available.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      </div>

      <div className="print-report-root" aria-hidden={!isPreparingPrint && !isPrintReady}>
        <div className="print-report-header">
          <div>
            <h1>Remedial Teacher Dashboard Report</h1>
            <p className="print-report-subtitle">Remedial intervention overview for assigned grade and subjects</p>
          </div>
          <p className="print-report-date">Generated: {todayDateLabel}</p>
        </div>

        <div className="print-report-kpis">
          <article className="print-report-card">
            <h3>English Students</h3>
            <p className="print-metric-value">{Number(handledCounts.English) || 0}</p>
          </article>
          <article className="print-report-card">
            <h3>Filipino Students</h3>
            <p className="print-metric-value">{Number(handledCounts.Filipino) || 0}</p>
          </article>
          <article className="print-report-card">
            <h3>Math Students</h3>
            <p className="print-metric-value">{Number(handledCounts.Math) || 0}</p>
          </article>
          <article className="print-report-card">
            <h3>Selected Scope</h3>
            <p className="print-metric-value">{`${selectedSubject} / ${gradeNumberLabel}`}</p>
          </article>
        </div>

        <section className="print-section-block">
          <h2>Teacher Profile</h2>
          <div className="print-report-card print-profile-grid">
            <div>
              <span className="print-label">Name</span>
              <p>{teacherProfile?.fullName ?? "N/A"}</p>
            </div>
            <div>
              <span className="print-label">Role</span>
              <p>{teacherProfile?.role ?? "N/A"}</p>
            </div>
            <div>
              <span className="print-label">Grade</span>
              <p>{gradeNumberLabel}</p>
            </div>
            <div>
              <span className="print-label">Subjects</span>
              <p>{teacherProfile?.subjectAssigned ?? "N/A"}</p>
            </div>
          </div>
        </section>

        <section className="print-section-block">
          <h2>Class Progress Overview</h2>
          <div className="print-chart-frame">
            {monthlyLevelProgressData.length > 0 ? (
              <BarChart width={980} height={240} data={monthlyLevelProgressData} margin={{ top: 6, right: 16, left: 0, bottom: 6 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#d1fae5" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <ReLegend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                {levelKeyByIndex.map((key, index) => (
                  <Bar
                    key={`print-monthly-${key}`}
                    dataKey={key}
                    name={resolvedLevelLabels[index]}
                    stackId="levels"
                    fill={chartMultiPalette[index % chartMultiPalette.length]}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            ) : (
              <p className="print-empty-state">No monthly progress data available for the selected scope.</p>
            )}
          </div>
        </section>

        <section className="print-section-block">
          <div className="print-two-col">
            <article className="print-report-card print-report-chart-card">
              <h3>Level Distribution Shift (Start vs End)</h3>
              {interventionLevelData.length > 0 ? (
                <BarChart width={420} height={210} data={interventionLevelData} margin={{ top: 6, right: 10, left: 0, bottom: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                  <XAxis dataKey="level" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <ReLegend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                  <Bar dataKey="before" fill={dashboardWarn} isAnimationActive={false} />
                  <Bar dataKey="after" fill={dashboardSecondary} isAnimationActive={false} />
                </BarChart>
              ) : (
                <p className="print-empty-state">No intervention shift data available.</p>
              )}
            </article>

            <article className="print-report-card print-report-chart-card">
              <h3>Students per Phonemic Level ({selectedSubject})</h3>
              {hasPhonemicLevelPieData ? (
                <PieChart width={420} height={210}>
                  <Pie
                    data={phonemicLevelPieData}
                    dataKey="value"
                    nameKey="name"
                    cx={210}
                    cy={100}
                    innerRadius={42}
                    outerRadius={76}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {phonemicLevelPieData.map((entry) => (
                      <Cell key={`print-phonemic-${entry.name}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ReLegend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconSize={8} />
                </PieChart>
              ) : (
                <p className="print-empty-state">No phonemic level data available.</p>
              )}
            </article>
          </div>
        </section>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 6mm;
          }

          .dashboard-live,
          .no-print {
            display: none !important;
          }

          .dashboard-page {
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .print-report-root {
            display: block !important;
            width: 100% !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
          }

          .print-report-header,
          .print-report-kpis,
          .print-section-block,
          .print-report-card,
          .print-chart-frame,
          .print-two-col {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .print-report-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: baseline !important;
            margin-bottom: 8px !important;
          }

          .print-report-header h1 {
            margin: 0 !important;
            font-size: 20px !important;
          }

          .print-report-subtitle,
          .print-report-date {
            margin: 0 !important;
            font-size: 11px !important;
            color: #64748b !important;
          }

          .print-report-kpis {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .print-section-block {
            margin-bottom: 10px !important;
          }

          .print-section-block h2 {
            margin: 0 0 6px 0 !important;
            font-size: 13px !important;
          }

          .print-report-card {
            border: 1px solid #d7e1e8 !important;
            border-radius: 6px !important;
            padding: 8px !important;
            background: #ffffff !important;
          }

          .print-report-card h3 {
            margin: 0 0 2px 0 !important;
            font-size: 10px !important;
            color: #64748b !important;
            text-transform: uppercase !important;
            letter-spacing: 0.04em !important;
          }

          .print-metric-value {
            margin: 0 !important;
            font-size: 18px !important;
            font-weight: 700 !important;
          }

          .print-profile-grid {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .print-label {
            display: block !important;
            margin-bottom: 2px !important;
            font-size: 10px !important;
            color: #64748b !important;
          }

          .print-chart-frame {
            border: 1px solid #d7e1e8 !important;
            border-radius: 6px !important;
            padding: 6px !important;
            background: #ffffff !important;
          }

          .print-two-col {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .print-report-chart-card {
            height: 238px !important;
          }

          .print-empty-state {
            margin: 0 !important;
            color: #64748b !important;
            font-size: 12px !important;
          }

          * {
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
