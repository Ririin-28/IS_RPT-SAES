"use client";
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from "@/components/MasterTeacher/Coordinator/Sidebar";
import Header from "@/components/MasterTeacher/Header";
// Button Components
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { normalizeMaterialSubject } from "@/lib/materials/shared";

// Import Chart components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import type { RemedialStudentRecord, RemedialStudentResponse } from "../../RemedialTeacher/report/types";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

type CoordinatorProfile = {
  fullName: string;
  role: string;
  gradeHandled: string;
  subjectAssigned: string;
};

type CoordinatorApiResponse = {
  success: boolean;
  coordinator?: {
    userId?: number | null;
    name?: string | null;
    gradeLevel?: string | null;
    coordinatorSubject?: string | null;
    subjectsHandled?: string | null;
    section?: string | null;
    email?: string | null;
    contactNumber?: string | null;
  } | null;
  activities?: Array<Record<string, unknown>> | null;
  metadata?: Record<string, unknown> | null;
  error?: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "IT Admin",
  it_admin: "IT Admin",
  master_teacher: "Master Teacher",
  masterteacher: "Master Teacher",
  coordinator: "Coordinator",
  teacher: "Teacher",
};

function formatRoleLabel(role?: string | null): string {
  if (!role) {
    return "Master Teacher";
  }
  const key = role.toLowerCase().replace(/[\s-]+/g, "_");
  return ROLE_LABELS[key] ?? role;
}

const formatGradeDescriptor = (value?: string | null): string => {
  if (!value) {
    return "their assigned grade";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "their assigned grade";
  }
  if (trimmed.toLowerCase() === "not assigned") {
    return "their assigned grade";
  }
  const digitMatch = trimmed.match(/(\d+)/);
  if (digitMatch) {
    return `Grade ${digitMatch[1]}`;
  }
  return trimmed;
};

const formatSubjectDescriptor = (value?: string | null): string => {
  if (!value) {
    return "their subject focus";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "their subject focus";
  }
  if (trimmed.toLowerCase() === "not assigned") {
    return "their subject focus";
  }
  return trimmed;
};

type CoordinatorSubject = "Math" | "English" | "Filipino";
type ProgressMonthKey = "starting" | "sept" | "oct" | "dec" | "feb";

const PROGRESS_MONTHS: Array<{ key: ProgressMonthKey; label: string }> = [
  { key: "starting", label: "Starting" },
  { key: "sept", label: "September" },
  { key: "oct", label: "October" },
  { key: "dec", label: "December" },
  { key: "feb", label: "February" },
];

const SUBJECT_PROGRESS_FIELDS: Record<CoordinatorSubject, Record<ProgressMonthKey, keyof RemedialStudentRecord>> = {
  English: {
    starting: "englishStartingLevel",
    sept: "englishSeptLevel",
    oct: "englishOctLevel",
    dec: "englishDecLevel",
    feb: "englishFebLevel",
  },
  Filipino: {
    starting: "filipinoStartingLevel",
    sept: "filipinoSeptLevel",
    oct: "filipinoOctLevel",
    dec: "filipinoDecLevel",
    feb: "filipinoFebLevel",
  },
  Math: {
    starting: "mathStartingLevel",
    sept: "mathSeptLevel",
    oct: "mathOctLevel",
    dec: "mathDecLevel",
    feb: "mathFebLevel",
  },
};

const LEVEL_COLOR_PALETTE = [
  "rgba(239, 68, 68, 0.85)",
  "rgba(249, 115, 22, 0.85)",
  "rgba(234, 179, 8, 0.85)",
  "rgba(34, 197, 94, 0.85)",
  "rgba(59, 130, 246, 0.85)",
  "rgba(99, 102, 241, 0.85)",
  "rgba(139, 92, 246, 0.85)",
  "rgba(236, 72, 153, 0.85)",
];

const sanitize = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : "";
};

type LevelDistributionResult = {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string;
    stack: string;
  }>;
  summary: string;
};

const buildLevelDistribution = (
  students: RemedialStudentRecord[],
  subject: CoordinatorSubject,
): LevelDistributionResult => {
  if (!students.length) {
    return {
      labels: PROGRESS_MONTHS.map((month) => month.label),
      datasets: [],
      summary: "No students assigned yet.",
    };
  }

  const fieldMap = SUBJECT_PROGRESS_FIELDS[subject];
  const levelSet = new Set<string>();
  const countsByMonth = new Map<ProgressMonthKey, Map<string, number>>();

  PROGRESS_MONTHS.forEach(({ key }) => {
    countsByMonth.set(key, new Map<string, number>());
  });

  students.forEach((student) => {
    PROGRESS_MONTHS.forEach(({ key }) => {
      const field = fieldMap[key];
      const value = sanitize(student[field]);
      if (!value) {
        return;
      }
      levelSet.add(value);
      const monthCounts = countsByMonth.get(key);
      if (!monthCounts) {
        return;
      }
      monthCounts.set(value, (monthCounts.get(value) ?? 0) + 1);
    });
  });

  const levels = Array.from(levelSet).sort((a, b) => a.localeCompare(b));
  const labels = PROGRESS_MONTHS.map((month) => month.label);

  const datasets = levels.map((level, index) => {
    const color = LEVEL_COLOR_PALETTE[index % LEVEL_COLOR_PALETTE.length];
    const data = PROGRESS_MONTHS.map(({ key }) => countsByMonth.get(key)?.get(level) ?? 0);
    return {
      label: level,
      data,
      backgroundColor: color,
      stack: "levels",
    };
  });

  const latestMonthWithData = [...PROGRESS_MONTHS].reverse().find(({ key }) => {
    const monthCounts = countsByMonth.get(key);
    if (!monthCounts) {
      return false;
    }
    let total = 0;
    monthCounts.forEach((count) => {
      total += count;
    });
    return total > 0;
  });

  let summary = "No progress records available yet.";
  if (latestMonthWithData) {
    const monthCounts = countsByMonth.get(latestMonthWithData.key);
    if (monthCounts && monthCounts.size > 0) {
      let topLevel = "";
      let topCount = 0;
      monthCounts.forEach((count, level) => {
        if (count > topCount) {
          topLevel = level;
          topCount = count;
        }
      });
      summary = `${topLevel || "No level"} is the most common level in ${latestMonthWithData.label}.`;
    }
  }

  return { labels, datasets, summary };
};

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
        className="w-full px-4 py-2.5 bg-white text-green-900 rounded-lg shadow-sm focus:outline-none focus:ring-1 appearance-none pr-10 cursor-pointer transition-colors duration-150 hover:border-[#013300]"
      >
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-green-700">
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
  const baseClasses = `relative group bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg
      flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px]
      transition-transform duration-200 hover:scale-105
      sm:p-6 sm:min-w-[180px] sm:min-h-[120px]
      lg:p-7 ${className}`;

  const tooltipNode = tooltip ? (
    <span className="pointer-events-none absolute -top-2 left-1/2 z-10 mb-2 hidden w-56 -translate-x-1/2 -translate-y-full rounded-md bg-[#013300] px-3 py-2 text-center text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:block group-hover:opacity-100">
      {tooltip}
    </span>
  ) : null;

  const content = (
    <>
      {tooltipNode}
      <div className="flex flex-row items-center justify-center">
        <span className="text-4xl font-extrabold text-[#013300] drop-shadow sm:text-5xl">
          {value}
        </span>
        {icon && <span className="ml-1 sm:ml-2">{icon}</span>}
      </div>
      <div className="text-green-900 text-sm font-semibold mt-1 text-center tracking-wide sm:text-base sm:mt-2">
        {label}
      </div>
    </>
  );

  if (typeof onClick === "function") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClasses} focus:outline-none cursor-pointer`}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

export default function MasterTeacherDashboard() {
  const router = useRouter();
  const handleNavigate = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  const storedProfile = useMemo(() => getStoredUserProfile(), []);

  const userId = useMemo(() => {
    if (!storedProfile) {
      return null;
    }
    const rawId = storedProfile.userId;
    if (typeof rawId === "number" && Number.isFinite(rawId)) {
      return rawId;
    }
    if (typeof rawId === "string") {
      const parsed = Number.parseInt(rawId, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }, [storedProfile]);

  const [coordinatorProfile, setCoordinatorProfile] = useState<CoordinatorProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [students, setStudents] = useState<RemedialStudentRecord[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number | null>(null);
  const [approvedMaterialsCount, setApprovedMaterialsCount] = useState<number | null>(null);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [gradeCounts, setGradeCounts] = useState<{ students: number; teachers: number } | null>(null);
  const [isLoadingGradeCounts, setIsLoadingGradeCounts] = useState(false);
  const [gradeCountsError, setGradeCountsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCoordinatorProfile() {
      setIsLoadingProfile(true);
      setProfileError(null);
      try {
        if (!userId) {
          throw new Error("Missing user information. Please log in again.");
        }

        const response = await fetch(
          `/api/master_teacher/coordinator/profile?userId=${encodeURIComponent(String(userId))}`,
          { cache: "no-store" },
        );

        const payload: CoordinatorApiResponse | null = await response.json().catch(() => null);

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload?.success || !payload.coordinator) {
          const message = payload?.error ?? "Unable to load coordinator profile.";
          throw new Error(message);
        }

        const coordinatorName = payload.coordinator.name?.trim() || "Master Teacher";

        setCoordinatorProfile({
          fullName: coordinatorName,
          role: formatRoleLabel(storedProfile?.role),
          gradeHandled: payload.coordinator.gradeLevel?.trim() || "Not assigned",
          subjectAssigned: payload.coordinator.coordinatorSubject?.trim() || "Not assigned",
        });
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load profile.";
          setProfileError(message);
          setCoordinatorProfile(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    }

    loadCoordinatorProfile();

    return () => {
      cancelled = true;
    };
  }, [storedProfile, userId]);

  useEffect(() => {
    if (userId === null) {
      setStudents([]);
      setIsLoadingStudents(false);
      setStudentsError("Unable to identify the current user. Please sign in again.");
      return;
    }

    const controller = new AbortController();

    const loadStudents = async () => {
      setIsLoadingStudents(true);
      setStudentsError(null);
      try {
        const response = await fetch(
          `/api/master_teacher/remedialteacher/students?userId=${encodeURIComponent(String(userId))}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as RemedialStudentResponse;
        if (!response.ok || !payload.success || !Array.isArray(payload.students)) {
          throw new Error(payload.error ?? "Failed to load students.");
        }
        setStudents(payload.students);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to load coordinator student data", error);
        setStudents([]);
        setStudentsError(error instanceof Error ? error.message : "Failed to load students.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingStudents(false);
        }
      }
    };

    loadStudents();

    return () => {
      controller.abort();
    };
  }, [userId]);

  const subjectFilter = useMemo(() => {
    const rawSubject = coordinatorProfile?.subjectAssigned?.trim();
    if (!rawSubject || rawSubject.toLowerCase() === "not assigned") {
      return null;
    }
    return normalizeMaterialSubject(rawSubject) ?? null;
  }, [coordinatorProfile?.subjectAssigned]);

  useEffect(() => {
    let cancelled = false;
    const fetchMaterialCount = async (status: "pending" | "approved"): Promise<number> => {
      const params = new URLSearchParams({ status, pageSize: "1" });
      const gradeValue = coordinatorProfile?.gradeHandled?.trim();
      if (gradeValue && gradeValue.toLowerCase() !== "not assigned") {
        params.set("grade", gradeValue);
      }
      if (!subjectFilter) {
        throw new Error("Subject is required (English, Filipino, or Math).");
      }
      params.set("subject", subjectFilter);
      const response = await fetch(`/api/master_teacher/coordinator/materials?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? `Failed to load ${status} materials`);
      }
      const totalValue = payload?.pagination?.total;
      const parsedTotal = typeof totalValue === "string" ? Number.parseInt(totalValue, 10) : Number(totalValue ?? 0);
      if (Number.isFinite(parsedTotal) && parsedTotal >= 0) {
        return parsedTotal;
      }
      const fallbackTotal = Array.isArray(payload?.data) ? payload.data.length : 0;
      return Number.isFinite(fallbackTotal) ? fallbackTotal : 0;
    };

    const loadApprovals = async () => {
      if (!userId) {
        setPendingApprovalsCount(0);
        setApprovedMaterialsCount(0);
        return;
      }

      if (!subjectFilter) {
        setApprovalsError("Subject assignment is required before loading materials (English, Filipino, or Math).");
        setPendingApprovalsCount(0);
        setApprovedMaterialsCount(0);
        setIsLoadingApprovals(false);
        return;
      }

      setIsLoadingApprovals(true);
      setApprovalsError(null);
      setPendingApprovalsCount(null);
      setApprovedMaterialsCount(null);

      try {
        const [pendingTotal, approvedTotal] = await Promise.all([
          fetchMaterialCount("pending"),
          fetchMaterialCount("approved"),
        ]);

        if (!cancelled) {
          setPendingApprovalsCount(pendingTotal);
          setApprovedMaterialsCount(approvedTotal);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load material approval stats", error);
          setApprovalsError(error instanceof Error ? error.message : "Failed to load approval statistics.");
          setPendingApprovalsCount(0);
          setApprovedMaterialsCount(0);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingApprovals(false);
        }
      }
    };

    loadApprovals();

    return () => {
      cancelled = true;
    };
  }, [coordinatorProfile?.gradeHandled, subjectFilter, userId]);

  useEffect(() => {
    if (!coordinatorProfile) {
      setGradeCounts(null);
      setGradeCountsError(null);
      setIsLoadingGradeCounts(false);
      return;
    }

    const gradeValue = coordinatorProfile.gradeHandled?.trim();
    if (!gradeValue || gradeValue.toLowerCase() === "not assigned") {
      setGradeCounts(null);
      setGradeCountsError("Grade assignment unavailable.");
      setIsLoadingGradeCounts(false);
      return;
    }

    const controller = new AbortController();

    const loadGradeCounts = async () => {
      setIsLoadingGradeCounts(true);
      setGradeCountsError(null);
      try {
        const params = new URLSearchParams({ grade: gradeValue });
        if (userId !== null) {
          params.set("userId", String(userId));
        }
        const subjectValue = coordinatorProfile?.subjectAssigned?.trim();
        if (subjectValue && subjectValue.toLowerCase() !== "not assigned") {
          params.set("subject", subjectValue);
        }
        const response = await fetch(`/api/master_teacher/coordinator/dashboard?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? "Failed to load grade counts.");
        }

        const studentsTotal = Number(payload?.data?.students);
        const teachersTotal = Number(payload?.data?.teachers);

        setGradeCounts({
          students: Number.isFinite(studentsTotal) ? studentsTotal : 0,
          teachers: Number.isFinite(teachersTotal) ? teachersTotal : 0,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to load grade counts", error);
        setGradeCounts({ students: 0, teachers: 0 });
        setGradeCountsError(error instanceof Error ? error.message : "Failed to load grade counts.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingGradeCounts(false);
        }
      }
    };

    loadGradeCounts();

    return () => controller.abort();
  }, [coordinatorProfile?.gradeHandled, coordinatorProfile?.subjectAssigned, userId]);

  // Get today's date in simplified month format (same as Principal)
  const today = new Date();
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthShort = [
    'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.',
    'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
  ];
  const dateToday = `${dayShort[today.getDay()]}, ${monthShort[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
  const [selectedSubject, setSelectedSubject] = useState<CoordinatorSubject>('Math');

  // Sample data for the teacher's own students
  const levelDistribution = useMemo(
    () => buildLevelDistribution(students, selectedSubject),
    [selectedSubject, students],
  );

  const pendingCount = pendingApprovalsCount ?? 0;
  const approvedCount = approvedMaterialsCount ?? 0;
  const pendingMaterialsValue = isLoadingApprovals ? '—' : approvalsError ? '—' : pendingCount;
  const totalStudentsValue = isLoadingGradeCounts ? '—' : gradeCountsError ? '—' : (gradeCounts?.students ?? 0);
  const teacherCardValue = isLoadingGradeCounts ? '—' : gradeCountsError ? '—' : (gradeCounts?.teachers ?? 0);
  const gradeDescriptor = formatGradeDescriptor(coordinatorProfile?.gradeHandled);
  const subjectDescriptor = formatSubjectDescriptor(coordinatorProfile?.subjectAssigned);
  const readableGrade = gradeDescriptor === "their assigned grade" ? "the assigned grade" : gradeDescriptor;
  const hasSpecificSubject = subjectDescriptor !== "their subject focus";
  const subjectSuffix = hasSpecificSubject ? ` (${subjectDescriptor})` : "";

  // Pending approvals data
  const approvalsData = {
    labels: ['Pending', 'Approved'],
    datasets: [
      {
        data: [pendingCount, approvedCount],
        backgroundColor: [
          'rgba(234, 179, 8, 0.8)',
          'rgba(34, 197, 94, 0.8)',
        ],
        borderColor: [
          'rgba(234, 179, 8, 1)',
          'rgba(34, 197, 94, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Chart options
  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    maintainAspectRatio: false,
  };

  const stackedBarOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: `${selectedSubject} Levels by Month`,
          font: {
            size: 16,
            weight: 'bold' as const,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0,
          },
        },
      },
      maintainAspectRatio: false,
    }),
    [selectedSubject],
  );

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/*---------------------------------Sidebar---------------------------------*/}
      <Sidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Dashboard" />

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            {/*---------------------------------Main Container---------------------------------*/}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[380px] overflow-y-auto p-4 sm:p-5 md:p-6">
              {/* Teacher Info Section */}
              <div className="flex flex-col mb-3 md:flex-row md:items-center md:justify-between">
                <SecondaryHeader title="Teacher Overview" />
                <div className="flex space-x-2 mt-2 md:mt-0">
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-4 mb-6 min-w-full min-h-[120px] sm:p-5 sm:mb-7 md:p-6 md:mb-8">
                {isLoadingProfile ? (
                  <div className="flex h-full items-center justify-center">
                    <BodyText title="Loading profile..." />
                  </div>
                ) : profileError ? (
                  <div className="flex h-full items-center justify-center">
                    <BodyText title={profileError} />
                  </div>
                ) : coordinatorProfile ? (
                  <div className="flex flex-col w-full">
                    <div className="flex flex-col mb-2 md:flex-row md:items-start md:justify-between md:mb-0">
                      <div className="mb-3 md:mb-0 md:w-1/3">
                        <TertiaryHeader title="Full Name:" />
                        <BodyText title={coordinatorProfile.fullName} />
                      </div>
                      <div className="mb-3 md:mb-0 md:w-1/3">
                        <TertiaryHeader title="Position:" />
                        <BodyText title={coordinatorProfile.role} />
                      </div>
                      <div className="mb-3 md:mb-0 md:w-1/3">
                        <TertiaryHeader title="Grade Assigned:" />
                        <BodyText title={coordinatorProfile.gradeHandled} />
                      </div>
                    </div>
                    <div className="mt-3 md:mt-2">
                      <TertiaryHeader title="Subject Assigned:" />
                      <BodyText title={coordinatorProfile.subjectAssigned} />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BodyText title="No profile data available." />
                  </div>
                )}
              </div>

              <hr className="border-gray-300 mb-4 sm:mb-5 md:mb-6" />

              {/* Overview Cards Section */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <SecondaryHeader title="Coordinator Overview" />
              </div>
              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 sm:gap-5 sm:mb-7 lg:grid-cols-4 lg:gap-6 lg:mb-8">
                <OverviewCard
                  value={totalStudentsValue}
                  label="Total Students"
                  tooltip={`Total students in ${readableGrade}.`}
                  icon={
                    <svg width="38" height="38" fill="none" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
                      <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/MasterTeacher/RemedialTeacher/students")}
                />
                <OverviewCard
                  value={teacherCardValue}
                  label="Total Teachers"
                  tooltip={`Total teachers in ${readableGrade}.`}
                  icon={
                    <svg width="38" height="38" fill="none" viewBox="0 0 24 24">
                      <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/MasterTeacher/Coordinator/teachers")}
                />
                <OverviewCard
                  value={pendingMaterialsValue}
                  label="Pending Materials"
                  tooltip={`Pending materials awaiting review for ${readableGrade}${subjectSuffix}.`}
                  icon={
                    <svg width="38" height="38" fill="none" viewBox="0 0 24 24">
                      <rect x="3" y="7" width="18" height="14" rx="2" stroke="#013300" strokeWidth="2" />
                      <rect x="7" y="3" width="10" height="4" rx="1" stroke="#013300" strokeWidth="2" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/MasterTeacher/Coordinator/materials?view=pending")}
                />
                <OverviewCard
                  value={<span className="text-xl">{dateToday}</span>}
                  label="Date Today"
                  onClick={() => handleNavigate("/MasterTeacher/Coordinator/calendar")}
                />
              </div>

              <hr className="border-gray-300 mb-4 sm:mb-5 md:mb-6" />

              {/* Charts Section */}
              <div className="space-y-8">
                {/* Pending Approvals */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                  <TertiaryHeader title="Pending Approvals this Week" />
                  <div className="h-64 mt-2">
                    {isLoadingApprovals ? (
                      <div className="flex h-full items-center justify-center text-sm text-gray-500">Loading approvals...</div>
                    ) : approvalsError ? (
                      <div className="flex h-full items-center justify-center text-sm text-red-600">{approvalsError}</div>
                    ) : pendingCount === 0 && approvedCount === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-gray-500">No materials found.</div>
                    ) : (
                      <Pie options={pieOptions} data={approvalsData} />
                    )}
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <p className="font-medium">
                      {approvalsError
                        ? approvalsError
                        : isLoadingApprovals
                          ? "Loading pending approvals..."
                          : `${pendingCount} approvals awaiting your review`}
                    </p>
                  </div>
                  <div className="mt-3">
                    <UtilityButton 
                      onClick={() => {}} 
                      className="w-full text-center justify-center"
                    >
                      Review Approvals
                    </UtilityButton>
                  </div>
                </div>

                {/* Student Distribution by Level */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <TertiaryHeader title="Student Distribution by Level" />
                    <div className="flex space-x-2 mt-2 md:mt-0">
                      <div className="w-32">
                        <CustomDropdown
                          value={selectedSubject}
                          onChange={(e) => setSelectedSubject(e.target.value as CoordinatorSubject)}
                          options={['Math', 'English', 'Filipino']}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="h-96 mt-4">
                    {isLoadingStudents ? (
                      <div className="flex h-full items-center justify-center text-sm text-gray-500">Loading distribution...</div>
                    ) : studentsError ? (
                      <div className="flex h-full items-center justify-center text-sm text-red-600">{studentsError}</div>
                    ) : levelDistribution.datasets.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-gray-500">No progress data available yet.</div>
                    ) : (
                      <Bar 
                        options={stackedBarOptions}
                        data={{
                          labels: levelDistribution.labels,
                          datasets: levelDistribution.datasets,
                        }} 
                      />
                    )}
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <p className="font-medium">{studentsError ? 'Unable to summarize progress data.' : levelDistribution.summary}</p>
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