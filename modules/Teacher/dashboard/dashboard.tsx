"use client";
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import TeacherSidebar from "@/components/Teacher/Sidebar";
import TeacherHeader from "@/components/Teacher/Header";
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
        className="w-full rounded-xl border border-white/65 bg-white/55 px-3.5 py-2.5 pr-10 text-sm text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.08)] backdrop-blur-md transition-colors duration-150 hover:border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200/80 focus:border-gray-300 appearance-none cursor-pointer"
      >
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-emerald-700/70">
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
  );
}

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// OverviewCard component with responsive styles
function OverviewCard({
  value,
  label,
  icon,
  className = "",
  onClick,
}: {
  value: React.ReactNode;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const sanitizeContent = (content: any): React.ReactNode => {
    if (typeof content === 'string') {
      return content;
    }
    return content;
  };

    const baseClasses = `rounded-2xl border border-white/70 bg-white/60 shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl
      flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px]
      transition duration-200 hover:border-gray-200 hover:bg-white/70
      sm:p-6 sm:min-w-[180px] sm:min-h-[120px]
      lg:p-7 ${className}`;

  const content = (
    <>
      <div className="flex flex-row items-center">
        <span className="text-4xl font-semibold text-emerald-950 sm:text-5xl">
          {sanitizeContent(value)}
        </span>
        {icon && <span className="ml-1 text-emerald-900/80 sm:ml-2">{icon}</span>}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-600 sm:mt-2 sm:text-base">
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

type SubjectCounts = Record<"English" | "Filipino" | "Math", number>;

type HandledCountsResponse = {
  success: boolean;
  counts?: SubjectCounts;
  trends?: TrendPayload;
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
  subjects: Record<keyof SubjectCounts, TrendSubjectData>;
};

const DEFAULT_SUBJECT_COUNTS: SubjectCounts = {
  English: 0,
  Filipino: 0,
  Math: 0,
};

const ROLE_LABELS: Record<string, string> = {
  teacher: "Teacher",
  master_teacher: "Master Teacher",
  coordinator: "Coordinator",
};

const formatGradeValue = (value?: string | null): string => {
  if (!value) return "Not assigned";
  const trimmed = value.trim();
  if (!trimmed) return "Not assigned";

  const gradeMatch = trimmed.match(/grade\s*(\d+)/i);
  if (gradeMatch) {
    return gradeMatch[1];
  }

  return trimmed;
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
  const [handledCounts, setHandledCounts] = useState<SubjectCounts>(() => ({ ...DEFAULT_SUBJECT_COUNTS }));
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [countsError, setCountsError] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<TrendPayload | null>(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(true);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

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
          `/api/teacher/profile?userId=${encodeURIComponent(String(userId))}`,
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
          gradeHandled: formatGradeValue(payload.profile.gradeLabel ?? payload.profile.grade ?? ""),
          subjectAssigned: payload.profile.subjectHandled?.trim() || "English, Filipino, Math",
        });
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load profile.";
          setProfileError(message);
          setTeacherProfile(null);
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

  useEffect(() => {
    let cancelled = false;

    async function loadHandledStudents() {
      setIsLoadingCounts(true);
      setIsLoadingTrends(true);
      setCountsError(null);
      setTrendsError(null);
      try {
        const storedProfile = getStoredUserProfile();
        const userId = storedProfile?.userId;

        if (!userId) {
          throw new Error("Missing user information. Please log in again.");
        }

        const response = await fetch(
          `/api/teacher/dashboard?userId=${encodeURIComponent(String(userId))}`,
          { cache: "no-store" },
        );

        const payload: HandledCountsResponse | null = await response.json().catch(() => null);

        if (cancelled) return;

        if (!response.ok || !payload?.success || !payload.counts) {
          const message = payload?.error ?? "Unable to load handled students.";
          throw new Error(message);
        }

        setHandledCounts({
          English: Number(payload.counts.English) || 0,
          Filipino: Number(payload.counts.Filipino) || 0,
          Math: Number(payload.counts.Math) || 0,
        });
        setTrendData(payload.trends ?? null);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load handled students.";
          setCountsError(message);
          setHandledCounts({ ...DEFAULT_SUBJECT_COUNTS });
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

    loadHandledStudents();

    return () => {
      cancelled = true;
    };
  }, []);

  const getHandledValue = (subject: keyof SubjectCounts) => {
    if (isLoadingCounts) {
      return "...";
    }
    if (countsError) {
      return "--";
    }
    return handledCounts[subject];
  };

  // Get today's date in simplified month format (same as Principal)
  const today = new Date();
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthShort = [
    'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.',
    'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
  ];
  const dateToday = `${dayShort[today.getDay()]}, ${monthShort[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [selectedSubject, setSelectedSubject] = useState('Math');
  const [selectedMonth, setSelectedMonth] = useState('March');
  const fallbackMonths = ['September', 'October', 'November', 'December', 'January', 'February', 'March'];
  const monthOptions = trendData?.months?.length ? trendData.months.map((item) => item.label) : fallbackMonths;

  useEffect(() => {
    if (!trendData?.months?.length) {
      return;
    }
    const latest = trendData.months[trendData.months.length - 1]?.label;
    if (latest && !monthOptions.includes(selectedMonth)) {
      setSelectedMonth(latest);
    }
  }, [monthOptions, selectedMonth, trendData?.months]);

  const fallbackLevelLabels = selectedSubject === 'Math'
    ? ['Emerging - Not Proficient', 'Emerging - Low Proficient', 'Developing - Nearly Proficient', 'Transitioning - Proficient', 'At Grade Level - Highly Proficient']
    : ['Non-Reader', 'Syllable Reader', 'Word Reader', 'Phrase Reader', 'Sentence Reader', 'Paragraph Reader'];

  const subjectTrend = trendData?.subjects?.[selectedSubject as keyof SubjectCounts];
  const resolvedLevelLabels = subjectTrend?.levelLabels?.length ? subjectTrend.levelLabels : fallbackLevelLabels;
  const weekLabels = trendData?.weeks?.length ? trendData.weeks : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const periodLabels = selectedPeriod === 'weekly' ? weekLabels : monthOptions;
  const periodValues = selectedPeriod === 'weekly' ? subjectTrend?.weekly : subjectTrend?.monthly;
  const normalizedPeriodValues = periodLabels.map((_, index) => (periodValues?.[index] ?? 0));

  const monthKey = trendData?.months?.find((item) => item.label === selectedMonth)?.key ?? null;
  const distributionValues = monthKey ? subjectTrend?.levelDistributionByMonth?.[monthKey] : undefined;
  const normalizedDistributionValues = resolvedLevelLabels.map((_, index) => distributionValues?.[index] ?? 0);

  const subjectColorMap = {
    Math: { border: 'rgba(79, 70, 229, 1)', fill: 'rgba(79, 70, 229, 0.2)' },
    English: { border: 'rgba(220, 38, 38, 1)', fill: 'rgba(220, 38, 38, 0.2)' },
    Filipino: { border: 'rgba(234, 88, 12, 1)', fill: 'rgba(234, 88, 12, 0.2)' },
  };

  const activeColor = subjectColorMap[selectedSubject as keyof typeof subjectColorMap];
  const performanceLineData = {
    labels: periodLabels,
    datasets: [
      {
        label: 'Average Proficiency Level',
        data: normalizedPeriodValues,
        borderColor: activeColor.border,
        backgroundColor: activeColor.fill,
        tension: 0.4,
        pointBackgroundColor: activeColor.border,
        pointBorderColor: '#fff',
        pointHoverRadius: 6,
        pointRadius: 4,
      },
    ],
  };

  const monthlyLevelData = {
    labels: resolvedLevelLabels,
    datasets: [
      {
        label: 'Students',
        data: normalizedDistributionValues,
        backgroundColor: resolvedLevelLabels.map(() => 'rgba(22, 163, 74, 0.25)'),
        borderColor: resolvedLevelLabels.map(() => 'rgba(22, 163, 74, 0.8)'),
        borderWidth: 1,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: Math.max(resolvedLevelLabels.length, 1),
        ticks: {
          stepSize: 1,
          callback: function (value: any) {
            const index = Number(value) - 1;
            return resolvedLevelLabels[index] || '';
          }
        }
      },
    },
    maintainAspectRatio: false,
  };

  const monthlyBarOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
    maintainAspectRatio: false,
  };

  const monthlySeries = subjectTrend?.monthly ?? [];
  const firstValue = monthlySeries.find((value) => value > 0);
  const lastValue = [...monthlySeries].reverse().find((value) => value > 0);
  const improvementValue = firstValue != null && lastValue != null
    ? Number((lastValue - firstValue).toFixed(2))
    : null;
  const improvementLabel = improvementValue == null
    ? "No trend data yet."
    : `Overall improvement: ${improvementValue >= 0 ? "+" : ""}${improvementValue} levels since ${monthOptions[0] ?? "start"}`;

  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      <TeacherSidebar />

      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <TeacherHeader title="Dashboard" />

        <main className="flex-1 overflow-y-auto">
          <div className="relative p-4 h-full sm:p-5 md:p-6">
            <div className="relative h-full min-h-100 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">
              {/* Teacher Info Section */}
              <div className="flex flex-col mb-3 md:flex-row md:items-center md:justify-between">
                <SecondaryHeader title="Teacher Overview" />
              </div>

              <div className="mb-6 min-h-30 min-w-full rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg sm:mb-7 sm:p-5 md:mb-8 md:p-6">
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

              <hr className="mb-4 border-gray-200 sm:mb-5 md:mb-6" />

              {/* Overview Cards Section */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <SecondaryHeader title="Remedial Overview" />
              </div>
              {countsError && (
                <div className="mb-4 rounded-xl border border-red-100/80 bg-red-50/80 p-3 text-sm text-red-700">
                  {countsError}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 sm:gap-5 sm:mb-7 lg:grid-cols-4 lg:gap-6 lg:mb-8">
                <OverviewCard
                  value={getHandledValue("English")}
                  label="English Handled Students"
                  icon={
                    <svg width="42" height="42" fill="none" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
                      <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/Teacher/students")}
                />
                <OverviewCard
                  value={getHandledValue("Filipino")}
                  label="Filipino Handled Students"
                  icon={
                    <svg width="42" height="42" fill="none" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
                      <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/Teacher/students")}
                />
                <OverviewCard
                  value={getHandledValue("Math")}
                  label="Math Handled Students"
                  icon={
                    <svg width="42" height="42" fill="none" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
                      <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/Teacher/students")}
                />
                <OverviewCard
                  value={<span className="text-xl">{dateToday}</span>}
                  label="Date Today"
                  onClick={() => handleNavigate("/Teacher/calendar")}
                />
              </div>

              <hr className="mb-4 border-gray-200 sm:mb-5 md:mb-6" />

              {/* Student Performance */}
              <div className="mb-8 rounded-2xl border border-white/75 bg-white/55 p-6 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                  <TertiaryHeader title="Student Performance" />
                  <div className="flex space-x-2 mt-2 md:mt-0">
                    <div className="w-32">
                      <CustomDropdown
                        value={selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}
                        onChange={(e) => setSelectedPeriod(e.target.value.toLowerCase())}
                        options={['Monthly', 'Weekly']}
                      />
                    </div>
                    <div className="w-32">
                      <CustomDropdown
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        options={['Math', 'English', 'Filipino']}
                      />
                    </div>
                    {selectedPeriod === 'monthly' && (
                      <div className="w-36">
                        <CustomDropdown
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          options={monthOptions}
                        />
                      </div>
                    )}
                  </div>
                </div>
                {isLoadingTrends && (
                  <p className="text-sm text-slate-600">Loading trend data...</p>
                )}
                {!isLoadingTrends && trendsError && (
                  <p className="text-sm text-red-600">{trendsError}</p>
                )}
                <div className="h-96 mt-4">
                  <Line
                    options={{
                      ...lineOptions,
                      plugins: {
                        ...lineOptions.plugins,
                        title: {
                          display: true,
                          text: `Average ${selectedSubject} Proficiency`,
                          font: {
                            size: 16,
                            weight: 'bold' as const,
                          }
                        },
                      }
                    }}
                    data={performanceLineData}
                  />
                </div>
                <div className="mt-4 text-sm text-slate-600">
                  <p className="font-medium">{improvementLabel}</p>
                </div>
              </div>

              {/* Student Distribution by Level */}
              <div className="rounded-2xl border border-white/75 bg-white/55 p-6 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                  <TertiaryHeader title="Student Distribution by Level" />
                  <div className="flex space-x-2 mt-2 md:mt-0">
                    <div className="w-32">
                      <CustomDropdown
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        options={['Math', 'English', 'Filipino']}
                      />
                    </div>
                    <div className="w-36">
                      <CustomDropdown
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        options={monthOptions}
                      />
                    </div>
                  </div>
                </div>
                {isLoadingTrends && (
                  <p className="text-sm text-slate-600">Loading trend data...</p>
                )}
                {!isLoadingTrends && trendsError && (
                  <p className="text-sm text-red-600">{trendsError}</p>
                )}
                <div className="h-96 mt-4">
                  <Bar
                    options={{
                      ...monthlyBarOptions,
                      plugins: {
                        ...monthlyBarOptions.plugins,
                        title: {
                          display: true,
                          text: `${selectedSubject} Levels for ${selectedMonth}`,
                          font: {
                            size: 16,
                            weight: 'bold' as const,
                          }
                        },
                      }
                    }}
                    data={monthlyLevelData}
                  />
                </div>
                <div className="mt-4 text-sm text-slate-600">
                  <p className="font-medium">Most students are at {selectedSubject === 'Math' ? 'Transitioning - Proficient' : 'Phrase Reader'} level</p>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
