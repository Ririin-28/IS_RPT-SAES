"use client";
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

// Custom styled dropdown component
function CustomDropdown({ value, onChange, options, className = "" }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-white/65 bg-white/55 px-4 py-2.5 pr-10 text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.08)] backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-gray-200/80 focus:border-gray-300 appearance-none cursor-pointer transition-colors duration-150 hover:border-gray-200"
      >
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
  );
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
  const sanitizeContent = (content: any): React.ReactNode => {
    if (typeof content === 'string') {
      return content;
    }
    return content;
  };

    const baseClasses = `relative group rounded-2xl border border-white/70 bg-white/60 shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl
      flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px] 
      transition duration-200 hover:border-gray-200 hover:bg-white/70
      sm:p-6 sm:min-w-[180px] sm:min-h-30
      lg:p-7 ${className}`;

  const tooltipNode = tooltip ? (
    <span className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden w-56 -translate-x-1/2 -translate-y-full rounded-md bg-slate-700 px-3 py-2 text-center text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:block group-hover:opacity-100">
      {tooltip}
    </span>
  ) : null;

  const content = (
    <>
      {tooltipNode}
      <div className="flex flex-row items-center">
        <span className="text-4xl font-semibold text-slate-900 sm:text-5xl">
          {sanitizeContent(value)}
        </span>
        {icon && <span className="ml-1 sm:ml-2">{icon}</span>}
      </div>
      <div className="text-slate-600 text-sm font-medium mt-1 tracking-wide sm:text-base sm:mt-2">
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

type AiInsightsResponse = {
  success: boolean;
  data?: {
    weakSkills?: Array<{ skill: string; gap: number }>;
    metadata?: { sessions?: number; materials?: number };
  };
  error?: string;
};

type SubjectCountsState = {
  English: number;
  Filipino: number;
  Math: number;
};

const dashboardPrimary = "#1f5f46";
const dashboardSecondary = "#2f7d57";
const dashboardWarn = "#bc8b5b";
const chartMultiPalette = ["#5f8fa8", "#bc8b5b", "#2f7d57", "#6da98b", "#b86b5c", "#7c8caa"];

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

export default function TeacherDashboard() {
  const router = useRouter();
  const handleNavigate = useCallback((path: string) => {
    router.push(path);
  }, [router]);

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
  const [aiWeakSkills, setAiWeakSkills] = useState<Array<{ skill: string; gap: number }>>([]);
  const [aiMeta, setAiMeta] = useState<{ sessions?: number; materials?: number } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCounts(userId: string | number) {
      setIsLoadingCounts(true);
      setIsLoadingTrends(true);
      setCountsError(null);
      setTrendsError(null);
      try {
        const response = await fetch(
          `/api/master_teacher/remedialteacher/dashboard?userId=${encodeURIComponent(String(userId))}`,
          { cache: "no-store" },
        );
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

        const response = await fetch(
          `/api/master_teacher/profile?userId=${encodeURIComponent(String(userId))}`,
          { cache: "no-store" },
        );

        const payload: TeacherApiResponse | null = await response.json().catch(() => null);

        if (cancelled) return;

        if (!response.ok || !payload?.success || !payload.profile) {
          const message = payload?.error ?? "Unable to load teacher profile.";
          throw new Error(message);
        }

        const nameParts = [
          payload.profile.firstName,
          payload.profile.middleName,
          payload.profile.lastName,
        ].filter((part): part is string => typeof part === "string" && part.trim().length > 0);

        const teacherName = nameParts.length > 0 ? nameParts.join(" ") : "Teacher";

        setTeacherProfile({
          fullName: teacherName,
          role: formatRoleLabel(payload.profile.role ?? storedProfile?.role),
          gradeHandled: payload.profile.gradeLabel?.trim() || payload.profile.grade?.trim() || "Not assigned",
          subjectAssigned: "English, Filipino, Math",
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

  // Get today's date in simplified month format (same as Principal)
  const today = new Date();
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthShort = [
    'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.',
    'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
  ];
  const dateToday = `${dayShort[today.getDay()]}, ${monthShort[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
  const [selectedSubject, setSelectedSubject] = useState('Math');
  const fallbackMonths = ['September', 'October', 'November', 'December', 'January', 'February', 'March'];
  const monthOptions = trendData?.months?.length ? trendData.months.map((item) => item.label) : fallbackMonths;

  const fallbackLevelLabels = selectedSubject === 'Math'
    ? ['Emerging - Not Proficient', 'Emerging - Low Proficient', 'Developing - Nearly Proficient', 'Transitioning - Proficient', 'At Grade Level - Highly Proficient']
    : ['Non-Reader', 'Syllable Reader', 'Word Reader', 'Phrase Reader', 'Sentence Reader', 'Paragraph Reader'];

  const subjectTrend = trendData?.subjects?.[selectedSubject as keyof SubjectCountsState];
  const resolvedLevelLabels = subjectTrend?.levelLabels?.length ? subjectTrend.levelLabels : fallbackLevelLabels;
  const periodLabels = monthOptions;
  const periodValues = subjectTrend?.monthly;
  const normalizedPeriodValues = periodLabels.map((_, index) => (periodValues?.[index] ?? 0));

  const monthKey = trendData?.months?.[trendData.months.length - 1]?.key ?? null;
  const distributionValues = monthKey ? subjectTrend?.levelDistributionByMonth?.[monthKey] : undefined;
  const normalizedDistributionValues = resolvedLevelLabels.map((_, index) => distributionValues?.[index] ?? 0);

  const monthlyProgressData = useMemo(
    () => periodLabels.map((label, index) => ({ month: label.slice(0, 3), score: Math.max(0, Math.min(100, (normalizedPeriodValues[index] ?? 0) * 12)) })),
    [periodLabels, normalizedPeriodValues],
  );

  const masteryLevelData = useMemo(() => {
    const buckets = { "At-Risk": 0, Developing: 0, Proficient: 0, Advanced: 0 };
    resolvedLevelLabels.forEach((label, index) => {
      const value = normalizedDistributionValues[index] ?? 0;
      const key = label.toLowerCase();
      if (key.includes("non") || key.includes("emerging") || key.includes("low")) buckets["At-Risk"] += value;
      else if (key.includes("syllable") || key.includes("word") || key.includes("develop")) buckets.Developing += value;
      else if (key.includes("phrase") || key.includes("sentence") || key.includes("proficient")) buckets.Proficient += value;
      else buckets.Advanced += value;
    });
    return [
      { name: "At-Risk", value: buckets["At-Risk"], color: "#b86b5c" },
      { name: "Developing", value: buckets.Developing, color: "#bc8b5b" },
      { name: "Proficient", value: buckets.Proficient, color: "#2f7d57" },
      { name: "Advanced", value: buckets.Advanced, color: "#6da98b" },
    ];
  }, [normalizedDistributionValues, resolvedLevelLabels]);

  const beforeAfterData = useMemo(() => {
    const first = normalizedPeriodValues.find((value) => value > 0) ?? 0;
    const last = [...normalizedPeriodValues].reverse().find((value) => value > 0) ?? first;
    return [
      { group: "At-Risk", before: Math.max(20, first * 10), after: Math.max(28, last * 10 + 6) },
      { group: "Developing", before: Math.max(30, first * 11), after: Math.max(38, last * 11 + 6) },
      { group: "Proficient", before: Math.max(40, first * 12), after: Math.max(48, last * 12 + 6) },
    ];
  }, [normalizedPeriodValues]);

  useEffect(() => {
    let cancelled = false;
    const loadAi = async () => {
      try {
        setAiError(null);
        const userId = getStoredUserProfile()?.userId;
        if (!userId || !teacherProfile?.gradeHandled) return;
        const studentResponse = await fetch(
          `/api/master_teacher/remedialteacher/students?userId=${encodeURIComponent(String(userId))}&subject=${encodeURIComponent(selectedSubject.toLowerCase())}`,
          { cache: "no-store" },
        );
        const studentPayload = (await studentResponse.json().catch(() => null)) as { students?: Array<{ studentId?: string }> } | null;
        const studentIds = (studentPayload?.students ?? []).map((item) => item.studentId).filter((id): id is string => Boolean(id));
        if (!studentIds.length || cancelled) {
          setAiWeakSkills([]);
          return;
        }

        const now = new Date();
        const from = new Date(now);
        from.setMonth(now.getMonth() - 6);

        const aiResponse = await fetch("/api/master_teacher/coordinator/dashboard/ai-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: selectedSubject,
            grade: teacherProfile.gradeHandled,
            from: from.toISOString().slice(0, 10),
            to: now.toISOString().slice(0, 10),
            studentIds,
          }),
          cache: "no-store",
        });
        const aiPayload = (await aiResponse.json().catch(() => null)) as AiInsightsResponse | null;
        if (!aiResponse.ok || !aiPayload?.success) {
          throw new Error(aiPayload?.error ?? "Failed to load AI insights.");
        }
        if (!cancelled) {
          setAiWeakSkills(aiPayload.data?.weakSkills ?? []);
          setAiMeta(aiPayload.data?.metadata ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setAiError(error instanceof Error ? error.message : "Failed to load AI insights.");
          setAiWeakSkills([]);
        }
      }
    };

    void loadAi();
    return () => {
      cancelled = true;
    };
  }, [selectedSubject, teacherProfile?.gradeHandled]);

  const aiSuggestedCompetencies = useMemo(
    () => aiWeakSkills.map((entry) => ({ competency: entry.skill, priority: entry.gap })),
    [aiWeakSkills],
  );

  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      <RemedialTeacherSidebar />

      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <MasterTeacherHeader title="Dashboard" />

        <main className="flex-1 overflow-y-auto">
          <div className="relative p-4 h-full sm:p-5 md:p-6">
            <div className="relative h-full min-h-100 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">
              {/* Teacher Info Section */}
              <div className="flex flex-col mb-3 md:flex-row md:items-center md:justify-between">
                <SecondaryHeader title="Teacher Overview" />
              </div>

              <div className="mb-6 min-w-full min-h-30 rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg sm:mb-7 sm:p-5 md:mb-8 md:p-6">
                {isLoadingProfile ? (
                  <div className="flex h-full items-center justify-center">
                    <BodyText title="Loading profile..." />
                  </div>
                ) : profileError ? (
                  <div className="flex h-full items-center justify-center">
                    <BodyText title={profileError} />
                  </div>
                ) : teacherProfile ? (
                  <div className="flex flex-col w-full">
                    <div className="flex flex-col mb-2 md:flex-row md:items-start md:justify-between md:mb-0">
                      <div className="mb-3 md:mb-0 md:w-1/3">
                        <TertiaryHeader title="Full Name:" />
                        <BodyText title={teacherProfile.fullName} />
                      </div>
                      <div className="mb-3 md:mb-0 md:w-1/3">
                        <TertiaryHeader title="Position:" />
                        <BodyText title={teacherProfile.role} />
                      </div>
                      <div className="mb-3 md:mb-0 md:w-1/3">
                        <TertiaryHeader title="Grade Assigned:" />
                        <BodyText title={teacherProfile.gradeHandled} />
                      </div>
                    </div>
                    <div className="mt-3 md:mt-2">
                      <TertiaryHeader title="Subject Assigned:" />
                      <BodyText title={teacherProfile.subjectAssigned} />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BodyText title="No profile data available." />
                  </div>
                )}
              </div>

              <hr className="border-gray-200 mb-4 sm:mb-5 md:mb-6" />

              {/* Overview Cards Section */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <SecondaryHeader title="Remedial Overview" />
              </div>
              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 sm:gap-5 sm:mb-7 lg:grid-cols-4 lg:gap-6 lg:mb-8">
                <OverviewCard
                  value={isLoadingCounts ? "..." : handledCounts.English}
                  label="English Handled Students"
                  tooltip="Total English students."
                  icon={
                    <svg width="42" height="42" fill="none" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
                      <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/MasterTeacher/RemedialTeacher/students")}
                />
                <OverviewCard
                  value={isLoadingCounts ? "..." : handledCounts.Filipino}
                  label="Filipino Handled Students"
                  tooltip="Total Filipino students."
                  icon={
                    <svg width="42" height="42" fill="none" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
                      <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/MasterTeacher/RemedialTeacher/students")}
                />
                <OverviewCard
                  value={isLoadingCounts ? "..." : handledCounts.Math}
                  label="Math Handled Students"
                  tooltip="Total Math students."
                  icon={
                    <svg width="42" height="42" fill="none" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
                      <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/MasterTeacher/RemedialTeacher/students")}
                />
                <OverviewCard
                  value={<span className="text-xl">{dateToday}</span>}
                  label="Date Today"
                  onClick={() => handleNavigate("/MasterTeacher/RemedialTeacher/calendar")}
                />
              </div>

              {countsError && (
                <div className="text-sm text-red-600 mb-6" role="alert">
                  {countsError}
                </div>
              )}

              <hr className="border-gray-200 mb-4 sm:mb-5 md:mb-6" />

              <div className="mb-4 flex items-center justify-end">
                <div className="w-40">
                  <CustomDropdown
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    options={['Math', 'English', 'Filipino']}
                  />
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <TertiaryHeader title="Class Progress Overview" />
                  <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg">
                      <p className="text-sm font-semibold text-slate-700">Monthly Student Progress</p>
                      <div className="mt-3 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={monthlyProgressData}>
                            <defs>
                              <linearGradient id="progressFillRt" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={dashboardSecondary} stopOpacity={0.7} />
                                <stop offset="100%" stopColor={dashboardSecondary} stopOpacity={0.08} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 4" stroke="#d1fae5" />
                            <XAxis dataKey="month" />
                            <YAxis domain={[0, 100]} />
                            <ReTooltip />
                            <Area type="monotone" dataKey="score" stroke={dashboardPrimary} strokeWidth={3} fill="url(#progressFillRt)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg">
                      <p className="text-sm font-semibold text-slate-700">Mastery Level Distribution</p>
                      <div className="mt-3 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={masteryLevelData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <ReTooltip />
                            <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                              {masteryLevelData.map((item) => (
                                <Cell key={item.name} fill={item.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <TertiaryHeader title="Intervention Tracking" />
                  <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-1">
                    <div className="rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg">
                      <p className="text-sm font-semibold text-slate-700">Student Improvement (Before vs After)</p>
                      <div className="mt-3 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={beforeAfterData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                            <XAxis dataKey="group" />
                            <YAxis domain={[0, 100]} />
                            <ReTooltip />
                            <ReLegend />
                            <Bar dataKey="before" fill={dashboardWarn} radius={[8, 8, 0, 0]} />
                            <Bar dataKey="after" fill={dashboardSecondary} radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <TertiaryHeader title="Classroom Analytics" />
                  <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-1">
                    <div className="rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg">
                      <p className="text-sm font-semibold text-slate-700">Suggested Competency Focus (Based on AI Summary)</p>
                      <p className="mt-1 text-xs text-slate-500">Prioritized competencies suggested by session AI summaries and remedial content signals.</p>
                      <div className="mt-3 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={aiSuggestedCompetencies}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                            <XAxis dataKey="competency" />
                            <YAxis domain={[0, 100]} />
                            <ReTooltip />
                            <Bar dataKey="priority" radius={[10, 10, 0, 0]}>
                              {aiSuggestedCompetencies.map((entry, idx) => (
                                <Cell key={entry.competency} fill={chartMultiPalette[idx % chartMultiPalette.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <TertiaryHeader title="AI Teaching Assistant Insights" />
                  <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-1">
                    <div className="rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg">
                      <p className="text-sm font-semibold text-slate-700">AI-Detected Weak Skills</p>
                      {aiMeta ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Based on {aiMeta.sessions ?? 0} session AI summaries and {aiMeta.materials ?? 0} remedial content packs.
                        </p>
                      ) : null}
                      <div className="mt-3 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={aiWeakSkills} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                            <XAxis type="number" domain={[0, 100]} />
                            <YAxis type="category" dataKey="skill" width={130} />
                            <ReTooltip />
                            <Bar dataKey="gap" radius={[0, 10, 10, 0]}>
                              {aiWeakSkills.map((entry, idx) => (
                                <Cell key={entry.skill} fill={chartMultiPalette[idx % chartMultiPalette.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {aiError ? <p className="mt-2 text-xs text-red-600">{aiError}</p> : null}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
