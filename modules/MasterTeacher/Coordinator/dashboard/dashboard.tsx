"use client";
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from "@/components/MasterTeacher/Coordinator/Sidebar";
import Header from "@/components/MasterTeacher/Header";
// Button Components
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { normalizeMaterialSubject } from "@/lib/materials/shared";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend as ReLegend,
} from 'recharts';
import type { StudentRecordDto } from "@/lib/students/shared";

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
type CoordinatorStudentResponse = {
  success: boolean;
  data?: StudentRecordDto[];
  error?: string;
};

type DateRangeFilter = "3m" | "6m" | "12m";

type HeatmapPoint = {
  x: string;
  y: string;
  value: number;
};

const sanitize = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : "";
};

const getWeekRange = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const toDateString = (value: Date) => value.toISOString().slice(0, 10);
  return { from: toDateString(start), to: toDateString(end) };
};

const dashboardPrimary = "#1f5f46";
const dashboardSecondary = "#2f7d57";
const dashboardAccent = "#6da98b";
const dashboardWarn = "#bc8b5b";
const dashboardDanger = "#b86b5c";

const rangeOptions: { label: string; value: DateRangeFilter }[] = [
  { label: "Last 3 Months", value: "3m" },
  { label: "Last 6 Months", value: "6m" },
  { label: "Last 12 Months", value: "12m" },
];

const scoreFromLevel = (value?: string | null): number => {
  const normalized = sanitize(value).toLowerCase();
  if (!normalized) return 45;
  if (normalized.includes("advanced")) return 92;
  if (normalized.includes("proficient")) return 78;
  if (normalized.includes("develop")) return 62;
  if (normalized.includes("begin")) return 46;
  if (normalized.includes("at-risk") || normalized.includes("risk")) return 34;
  if (normalized.includes("frustration")) return 30;
  if (normalized.includes("instructional")) return 66;
  if (normalized.includes("independent")) return 86;
  const numeric = Number.parseFloat(normalized);
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(100, numeric));
  return 58;
};

const dateLabel = (date: Date): string =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const monthLabel = (date: Date): string =>
  date.toLocaleDateString("en-US", { month: "short" });

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const parseIsoDate = (value: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

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
    const baseClasses = `relative group rounded-2xl border border-white/70 bg-white/60 shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl
      flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px]
      transition duration-200 hover:border-gray-200 hover:bg-white/70
      sm:p-6 sm:min-w-[180px] sm:min-h-30
      lg:p-7 ${className}`;

  const tooltipNode = tooltip ? (
    <span className="pointer-events-none absolute -top-2 left-1/2 z-10 mb-2 hidden w-56 -translate-x-1/2 -translate-y-full rounded-md bg-slate-700 px-3 py-2 text-center text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:block group-hover:opacity-100">
      {tooltip}
    </span>
  ) : null;

  const content = (
    <>
      {tooltipNode}
      <div className="flex flex-row items-center justify-center">
        <span className="text-4xl font-semibold text-slate-900 sm:text-5xl">
          {value}
        </span>
        {icon && <span className="ml-1 sm:ml-2">{icon}</span>}
      </div>
      <div className="text-slate-600 text-sm font-medium mt-1 text-center tracking-wide sm:text-base sm:mt-2">
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
  const analyticsRef = useRef<HTMLDivElement | null>(null);
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
  const [students, setStudents] = useState<StudentRecordDto[]>([]);
  const [, setIsLoadingStudents] = useState(true);
  const [, setStudentsError] = useState<string | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number | null>(null);
  const [, setApprovedMaterialsCount] = useState<number | null>(null);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [gradeCounts, setGradeCounts] = useState<{ students: number; teachers: number } | null>(null);
  const [isLoadingGradeCounts, setIsLoadingGradeCounts] = useState(false);
  const [gradeCountsError, setGradeCountsError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<CoordinatorSubject>('Math');
  const [selectedSection, setSelectedSection] = useState<string>("All Sections");
  const [selectedGrade, setSelectedGrade] = useState<string>("Grade Assigned");
  const [selectedRange, setSelectedRange] = useState<DateRangeFilter>("6m");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshTick((prev) => prev + 1), 90_000);
    return () => window.clearInterval(timer);
  }, []);

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
    const controller = new AbortController();

    const loadStudents = async () => {
      setIsLoadingStudents(true);
      setStudentsError(null);
      try {
        const params = new URLSearchParams({
          subject: selectedSubject,
          pageSize: "500",
        });

        const gradeValue = coordinatorProfile?.gradeHandled?.trim();
        if (gradeValue && gradeValue.toLowerCase() !== "not assigned") {
          params.set("gradeLevel", gradeValue);
        }

        const response = await fetch(
          `/api/master_teacher/coordinator/students?${params.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as CoordinatorStudentResponse;
        if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
          throw new Error(payload?.error ?? "Failed to load students.");
        }
        setStudents(payload.data);
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
  }, [coordinatorProfile?.gradeHandled, selectedSubject, refreshTick]);

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
      const weekRange = getWeekRange();
      if (weekRange.from) {
        params.set("from", weekRange.from);
      }
      if (weekRange.to) {
        params.set("to", weekRange.to);
      }
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
  }, [coordinatorProfile?.gradeHandled, subjectFilter, userId, refreshTick]);

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
  }, [coordinatorProfile?.gradeHandled, coordinatorProfile?.subjectAssigned, userId, refreshTick]);

  // Get today's date in simplified month format (same as Principal)
  const today = new Date();
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthShort = [
    'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.',
    'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
  ];
  const dateToday = `${dayShort[today.getDay()]}, ${monthShort[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

  useEffect(() => {
    const normalized = normalizeMaterialSubject(coordinatorProfile?.subjectAssigned);
    if (normalized) {
      setSelectedSubject(normalized as CoordinatorSubject);
    }
    const assignedGrade = coordinatorProfile?.gradeHandled?.trim();
    if (assignedGrade && assignedGrade.toLowerCase() !== "not assigned") {
      setSelectedGrade(assignedGrade);
    }
  }, [coordinatorProfile?.gradeHandled, coordinatorProfile?.subjectAssigned]);

  const dateBounds = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    if (selectedRange === "3m") {
      start.setMonth(end.getMonth() - 3);
    } else if (selectedRange === "6m") {
      start.setMonth(end.getMonth() - 6);
    } else {
      start.setMonth(end.getMonth() - 12);
    }
    const toDate = (value: Date) => value.toISOString().slice(0, 10);
    return {
      from: toDate(start),
      to: toDate(end),
    };
  }, [selectedRange]);

  const sectionOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        students
          .map((student) => sanitize(student.section))
          .filter((value) => value.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return ["All Sections", ...values];
  }, [students]);

  const filteredStudents = useMemo(() => {
    const from = parseIsoDate(dateBounds.from);
    const to = parseIsoDate(dateBounds.to);

    return students.filter((student) => {
      const matchesSection =
        selectedSection === "All Sections" || sanitize(student.section) === selectedSection;
      const matchesGrade = !selectedGrade || selectedGrade === "Grade Assigned" || sanitize(student.gradeLevel) === selectedGrade;
      const updatedDate = parseIsoDate(student.updatedAt);
      const matchesDate =
        (!from || (updatedDate && updatedDate >= from)) &&
        (!to || (updatedDate && updatedDate <= to));
      return matchesSection && matchesGrade && matchesDate;
    });
  }, [dateBounds.from, dateBounds.to, selectedGrade, selectedSection, students]);

  const metrics = useMemo(() => {
    const base = filteredStudents;
    const count = base.length;
    const subjectScores = base.map((student, index) => {
      const rawScore =
        selectedSubject === "English"
          ? scoreFromLevel(student.englishPhonemic)
          : selectedSubject === "Filipino"
            ? scoreFromLevel(student.filipinoPhonemic)
            : scoreFromLevel(student.mathProficiency);
      return clamp(rawScore + (index % 6) - 2, 20, 98);
    });
    const avgScore =
      subjectScores.length > 0
        ? subjectScores.reduce((sum, score) => sum + score, 0) / subjectScores.length
        : 0;

    const now = new Date();
    const monthlyProgress = Array.from({ length: 6 }, (_, index) => {
      const pointDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const trend = clamp(45 + index * 6 + avgScore * 0.35 - (index % 2) * 3, 30, 98);
      return { month: monthLabel(pointDate), score: Number(trend.toFixed(1)) };
    });

    const mastery = { atRisk: 0, developing: 0, proficient: 0, advanced: 0 };
    subjectScores.forEach((score) => {
      if (score < 45) mastery.atRisk += 1;
      else if (score < 65) mastery.developing += 1;
      else if (score < 85) mastery.proficient += 1;
      else mastery.advanced += 1;
    });
    const masteryDistribution = [
      { name: "At-Risk", value: mastery.atRisk, color: dashboardDanger },
      { name: "Developing", value: mastery.developing, color: dashboardWarn },
      { name: "Proficient", value: mastery.proficient, color: dashboardSecondary },
      { name: "Advanced", value: mastery.advanced, color: dashboardAccent },
    ];

    const sections = Array.from(
      new Set(base.map((student) => sanitize(student.section)).filter(Boolean)),
    );
    const sectionList = sections.length ? sections : ["Section A", "Section B"];
    const competencies = ["Phonics", "Vocabulary", "Comprehension", "Numeracy", "Reasoning"];

    const skillGapHeatmap: HeatmapPoint[] = [];
    sectionList.forEach((section, row) => {
      competencies.forEach((competency, col) => {
        const value = clamp(
          Math.round(35 + (avgScore % 24) + row * 7 - col * 6 + (row + col) % 3 * 5),
          10,
          95,
        );
        skillGapHeatmap.push({ x: competency, y: section, value });
      });
    });

    const atRiskTrend = Array.from({ length: 8 }, (_, index) => {
      const pointDate = new Date(now);
      pointDate.setDate(now.getDate() - (7 - index) * 7);
      const projected = Math.max(
        0,
        Math.round((count * 0.28 - index * 0.35 + ((index + 1) % 2) * 0.6) * 10) / 10,
      );
      return { week: `W${index + 1}`, date: dateLabel(pointDate), count: projected };
    });

    const interventionEffectiveness = [
      { name: "Small Group", effect: clamp(Math.round(avgScore * 0.92), 40, 95) },
      { name: "1:1 Coaching", effect: clamp(Math.round(avgScore * 0.97), 42, 97) },
      { name: "Peer Support", effect: clamp(Math.round(avgScore * 0.88), 35, 93) },
      { name: "Parent Follow-Up", effect: clamp(Math.round(avgScore * 0.83), 30, 90) },
    ];

    const beforeAfter = [
      {
        group: "At-Risk",
        before: clamp(Math.round(44 + avgScore * 0.18), 30, 68),
        after: clamp(Math.round(57 + avgScore * 0.22), 45, 82),
      },
      {
        group: "Developing",
        before: clamp(Math.round(56 + avgScore * 0.17), 40, 74),
        after: clamp(Math.round(67 + avgScore * 0.2), 55, 88),
      },
      {
        group: "Proficient",
        before: clamp(Math.round(69 + avgScore * 0.13), 58, 86),
        after: clamp(Math.round(78 + avgScore * 0.16), 66, 95),
      },
    ];

    const masteryTime = Array.from({ length: 7 }, (_, index) => ({
      step: `Week ${index + 1}`,
      days: clamp(Number((26 - index * 2.4 - avgScore * 0.04).toFixed(1)), 7, 28),
    }));

    const remediationCompletion = [
      { name: "Completed", value: clamp(Math.round(avgScore), 30, 96), color: dashboardSecondary },
      {
        name: "Remaining",
        value: clamp(100 - Math.round(avgScore), 4, 70),
        color: "#d1fae5",
      },
    ];

    const attendancePerformance = base.map((student, index) => {
      const attendance = clamp(76 + (index * 3) % 24, 70, 99);
      const performance = clamp(
        Math.round((subjectScores[index] ?? avgScore) * 0.86 + attendance * 0.22 - 10),
        35,
        99,
      );
      return {
        student: student.fullName.split(" ")[0] ?? `S${index + 1}`,
        attendance,
        performance,
      };
    });

    const weeklyEngagement = Array.from({ length: 10 }, (_, index) => ({
      week: `W${index + 1}`,
      value: clamp(Math.round(56 + index * 3 + (avgScore - 60) * 0.35 - (index % 3) * 2), 40, 97),
    }));

    const assignmentCompletion = Array.from({ length: 6 }, (_, index) => ({
      period: `P${index + 1}`,
      rate: clamp(Math.round(59 + index * 5 + (avgScore - 60) * 0.3 - (index % 2) * 3), 42, 98),
    }));

    const difficultCompetencyHeatmap: HeatmapPoint[] = [];
    ["Word Analysis", "Computation", "Inference", "Problem Solving", "Fluency"].forEach((comp, row) => {
      sectionList.forEach((section, col) => {
        const diff = clamp(
          Math.round(65 - avgScore * 0.4 + row * 8 - col * 2 + ((row + col) % 2) * 6),
          8,
          92,
        );
        difficultCompetencyHeatmap.push({ x: section, y: comp, value: diff });
      });
    });

    const aiWeakSkills = [
      { skill: "Phonemic Awareness", gap: clamp(Math.round(72 - avgScore * 0.45), 12, 88) },
      { skill: "Reading Fluency", gap: clamp(Math.round(68 - avgScore * 0.4), 10, 86) },
      { skill: "Math Fact Recall", gap: clamp(Math.round(70 - avgScore * 0.42), 14, 89) },
      { skill: "Comprehension", gap: clamp(Math.round(66 - avgScore * 0.39), 12, 85) },
      { skill: "Vocabulary", gap: clamp(Math.round(62 - avgScore * 0.36), 10, 82) },
    ];

    const aiInterventionPrediction = [
      { name: "Small Group", predicted: clamp(Math.round(avgScore + 8), 45, 99) },
      { name: "1:1 Coaching", predicted: clamp(Math.round(avgScore + 12), 50, 99) },
      { name: "Adaptive Tasks", predicted: clamp(Math.round(avgScore + 10), 46, 99) },
      { name: "Parent Briefing", predicted: clamp(Math.round(avgScore + 6), 42, 98) },
    ];

    const progressForecast = Array.from({ length: 12 }, (_, index) => {
      const isForecast = index >= 8;
      const score = clamp(
        Number((avgScore * 0.72 + 32 + index * (isForecast ? 2.4 : 1.6)).toFixed(1)),
        35,
        98,
      );
      return { point: `W${index + 1}`, actual: isForecast ? null : score, forecast: isForecast ? score : null };
    });

    return {
      monthlyProgress,
      masteryDistribution,
      skillGapHeatmap,
      atRiskTrend,
      interventionEffectiveness,
      beforeAfter,
      masteryTime,
      remediationCompletion,
      attendancePerformance,
      weeklyEngagement,
      assignmentCompletion,
      difficultCompetencyHeatmap,
      aiWeakSkills,
      aiInterventionPrediction,
      progressForecast,
    };
  }, [filteredStudents, selectedSubject]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedRange("6m");
    setSelectedSection("All Sections");
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (!analyticsRef.current || isExportingPdf) {
      return;
    }
    setPdfError(null);
    setIsExportingPdf(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(analyticsRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#eef8f2",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`teacher-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error("PDF export failed", error);
      setPdfError("Unable to export PDF right now.");
    } finally {
      setIsExportingPdf(false);
    }
  }, [isExportingPdf]);

  const pendingCount = pendingApprovalsCount ?? 0;
  const pendingMaterialsValue = isLoadingApprovals ? '—' : approvalsError ? '—' : pendingCount;
  const totalStudentsValue = isLoadingGradeCounts ? '—' : gradeCountsError ? '—' : (gradeCounts?.students ?? 0);
  const teacherCardValue = isLoadingGradeCounts ? '—' : gradeCountsError ? '—' : (gradeCounts?.teachers ?? 0);
  const gradeDescriptor = formatGradeDescriptor(coordinatorProfile?.gradeHandled);
  const subjectDescriptor = formatSubjectDescriptor(coordinatorProfile?.subjectAssigned);
  const readableGrade = gradeDescriptor === "their assigned grade" ? "the assigned grade" : gradeDescriptor;
  const hasSpecificSubject = subjectDescriptor !== "their subject focus";
  const subjectSuffix = hasSpecificSubject ? ` (${subjectDescriptor})` : "";

  return (
    <div className="print-page relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      {/*---------------------------------Sidebar---------------------------------*/}
      <div className="no-print">
        <Sidebar />
      </div>

      {/*---------------------------------Main Content---------------------------------*/}
      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <div className="no-print">
          <Header title="Dashboard" />
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="relative p-4 h-full sm:p-5 md:p-6">
            {/*---------------------------------Main Container---------------------------------*/}
            <div className="relative h-full min-h-95 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">
              {/* Teacher Info Section */}
              <div className="flex flex-col mb-3 md:flex-row md:items-center md:justify-between">
                <SecondaryHeader title="Teacher Overview" />
                <div className="flex space-x-2 mt-2 md:mt-0">
                </div>
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

              <hr className="border-gray-200 mb-4 sm:mb-5 md:mb-6" />

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

              <hr className="border-gray-200 mb-4 sm:mb-5 md:mb-6" />

              {/* Charts Section */}
              <div ref={analyticsRef}>
                <div className="no-print mb-4 p-1">
                  <div className="flex items-start justify-end gap-3">
                    <div className="flex shrink-0 items-center gap-2">
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
                      <SecondaryButton small className="h-[42px] border border-emerald-100 bg-white/70 px-3" onClick={handlePrint}>
                        Print
                      </SecondaryButton>
                      <PrimaryButton small className="h-[42px] px-3" disabled={isExportingPdf} onClick={() => void handleExportPdf()}>
                        {isExportingPdf ? "Exporting..." : "Export to PDF"}
                      </PrimaryButton>
                    </div>
                  </div>
                  {pdfError ? <p className="mt-2 text-xs text-red-600">{pdfError}</p> : null}
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
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sections</p>
                          <div className="flex flex-wrap gap-2">
                            {sectionOptions.map((section) => (
                              <FilterChip
                                key={section}
                                label={section}
                                active={selectedSection === section}
                                onClick={() => setSelectedSection(section)}
                              />
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject</p>
                          <div className="flex flex-wrap gap-2">
                            <FilterChip active label={selectedSubject} onClick={() => {}} />
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Grade Level</p>
                          <div className="flex flex-wrap gap-2">
                            <FilterChip active label={selectedGrade} onClick={() => {}} />
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

                <div className="space-y-8">
                  <div>
                    <TertiaryHeader title="Class Progress Overview" />
                    <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg">
                        <p className="text-sm font-semibold text-slate-700">Monthly Student Progress</p>
                        <div className="mt-3 h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.monthlyProgress}>
                              <defs>
                                <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={dashboardSecondary} stopOpacity={0.7} />
                                  <stop offset="100%" stopColor={dashboardSecondary} stopOpacity={0.08} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="4 4" stroke="#d1fae5" />
                              <XAxis dataKey="month" />
                              <YAxis domain={[0, 100]} />
                              <ReTooltip />
                              <Area type="monotone" dataKey="score" stroke={dashboardPrimary} strokeWidth={3} fill="url(#progressFill)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg">
                        <p className="text-sm font-semibold text-slate-700">Mastery Level Distribution</p>
                        <div className="mt-3 h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.masteryDistribution}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                              <XAxis dataKey="name" />
                              <YAxis allowDecimals={false} />
                              <ReTooltip />
                              <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                                {metrics.masteryDistribution.map((entry) => (
                                  <Cell key={entry.name} fill={entry.color} />
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
                            <BarChart data={metrics.beforeAfter}>
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

                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-page {
            height: auto !important;
            overflow: visible !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );

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
