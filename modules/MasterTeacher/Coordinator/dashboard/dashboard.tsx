"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/MasterTeacher/Coordinator/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { normalizeMaterialSubject } from "@/lib/materials/shared";
import { CalendarDays, Filter, FolderOpen, GraduationCap, Printer } from "lucide-react";
import { FaChalkboardTeacher } from "react-icons/fa";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend as ReLegend,
} from "recharts";
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
type SubjectKey = "english" | "filipino" | "math";
type CoordinatorStudentResponse = {
  success: boolean;
  data?: StudentRecordDto[];
  error?: string;
};

type CoordinatorHandledScope = {
  gradeId: number;
  gradeLabel: string;
  subjectId: number;
  subjectName: string;
};

type CoordinatorAnalyticsResponse = {
  success: boolean;
  data?: {
    handledScopes: CoordinatorHandledScope[];
    sections: string[];
    overview: {
      students: number;
      teachers: number;
      pendingMaterials: number;
    };
    levelLabels: string[];
    monthSeries: Array<{ key: string; label: string }>;
    monthlyLevelCounts: Record<string, number[]>;
    levelShift: {
      before: number[];
      after: number[];
    };
    phonemicDistribution: number[];
  };
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
const chartMultiPalette = ["#0f766e", "#16a34a", "#65a30d", "#0ea5a4", "#84cc16", "#2f7d57"];

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

const dateLabel = (date: Date): string => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const monthLabel = (date: Date): string => date.toLocaleDateString("en-US", { month: "short" });

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const parseIsoDate = (value: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

function toSubjectKey(subject: CoordinatorSubject): SubjectKey {
  if (subject === "English") return "english";
  if (subject === "Filipino") return "filipino";
  return "math";
}

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
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">{icon}</span>
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

export default function MasterTeacherDashboard() {
  const router = useRouter();
  const handleNavigate = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

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
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number | null>(null);
  const [approvedMaterialsCount, setApprovedMaterialsCount] = useState<number | null>(null);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [gradeCounts, setGradeCounts] = useState<{ students: number; teachers: number } | null>(null);
  const [isLoadingGradeCounts, setIsLoadingGradeCounts] = useState(false);
  const [gradeCountsError, setGradeCountsError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<CoordinatorAnalyticsResponse["data"] | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<CoordinatorSubject>("Math");
  const [selectedSection, setSelectedSection] = useState<string>("All Sections");
  const [selectedGrade, setSelectedGrade] = useState<string>("Grade Assigned");
  const [selectedRange, setSelectedRange] = useState<DateRangeFilter>("6m");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
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

        const response = await fetch(`/api/master_teacher/coordinator/profile?userId=${encodeURIComponent(String(userId))}`, {
          cache: "no-store",
        });

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
          role: "Master Teacher",
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

        const response = await fetch(`/api/master_teacher/coordinator/students?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
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
      if (status === "approved" && userId !== null) {
        params.set("userId", String(userId));
      }
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
        const [pendingTotal, approvedTotal] = await Promise.all([fetchMaterialCount("pending"), fetchMaterialCount("approved")]);

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

  useEffect(() => {
    const controller = new AbortController();

    const loadAnalytics = async () => {
      if (userId === null) {
        setAnalyticsData(null);
        setAnalyticsError("Missing user information. Please log in again.");
        setIsLoadingAnalytics(false);
        return;
      }

      setIsLoadingAnalytics(true);
      setAnalyticsError(null);

      try {
        const params = new URLSearchParams({
          userId: String(userId),
          subject: selectedSubject,
          range: selectedRange,
          section: selectedSection,
        });

        const response = await fetch(`/api/master_teacher/coordinator/dashboard/analytics?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as CoordinatorAnalyticsResponse | null;

        if (!response.ok || !payload?.success || !payload.data) {
          throw new Error(payload?.error ?? "Failed to load coordinator analytics.");
        }

        setAnalyticsData(payload.data);
        setGradeCounts({
          students: Number(payload.data.overview.students) || 0,
          teachers: Number(payload.data.overview.teachers) || 0,
        });
        setPendingApprovalsCount(Number(payload.data.overview.pendingMaterials) || 0);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to load coordinator analytics.";
        setAnalyticsError(message);
        setAnalyticsData(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingAnalytics(false);
        }
      }
    };

    loadAnalytics();

    return () => controller.abort();
  }, [userId, selectedRange, selectedSection, selectedSubject, refreshTick]);

  const sectionOptions = useMemo(() => {
    const values = Array.from(new Set((analyticsData?.sections ?? []).filter((value) => value.length > 0))).sort((a, b) =>
      a.localeCompare(b)
    );
    return ["All Sections", ...values];
  }, [analyticsData?.sections]);

  const handledSubjectOptions = useMemo<CoordinatorSubject[]>(() => {
    const found = new Set<CoordinatorSubject>();
    (analyticsData?.handledScopes ?? []).forEach((scope) => {
      const normalized = normalizeMaterialSubject(scope.subjectName);
      if (normalized === "English" || normalized === "Filipino" || normalized === "Math") {
        found.add(normalized);
      }
    });

    if (!found.size) {
      found.add(selectedSubject);
    }

    return Array.from(found);
  }, [analyticsData?.handledScopes, selectedSubject]);

  useEffect(() => {
    if (!handledSubjectOptions.length) return;
    if (!handledSubjectOptions.includes(selectedSubject)) {
      setSelectedSubject(handledSubjectOptions[0]);
    }
  }, [handledSubjectOptions, selectedSubject]);

  const handlePrint = useCallback(() => {
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

  const clearFilters = useCallback(() => {
    setSelectedRange("6m");
    setSelectedSection("All Sections");
  }, []);

  const pendingReviewsCount = pendingApprovalsCount ?? 0;
  const pendingReviewsValue = isLoadingApprovals ? "—" : approvalsError ? "—" : pendingReviewsCount;
  const totalStudentsValue = isLoadingGradeCounts ? "—" : gradeCountsError ? "—" : (gradeCounts?.students ?? 0);
  const teacherCardValue = isLoadingGradeCounts ? "—" : gradeCountsError ? "—" : (gradeCounts?.teachers ?? 0);
  const gradeDescriptor = formatGradeDescriptor(coordinatorProfile?.gradeHandled);
  const subjectDescriptor = formatSubjectDescriptor(coordinatorProfile?.subjectAssigned);
  const readableGrade = gradeDescriptor === "their assigned grade" ? "the assigned grade" : gradeDescriptor;
  const hasSpecificSubject = subjectDescriptor !== "their subject focus";
  const subjectSuffix = hasSpecificSubject ? ` (${subjectDescriptor})` : "";
  const gradeNumberLabel = useMemo(() => {
    const raw = coordinatorProfile?.gradeHandled ?? "";
    const normalized = raw.replace(/^grade\s*/i, "").trim();
    return normalized.length > 0 ? `Grade ${normalized}` : "Grade";
  }, [coordinatorProfile?.gradeHandled]);
  const coordinatorLabel = useMemo(() => {
    const subject = coordinatorProfile?.subjectAssigned?.trim();
    if (!subject || subject.toLowerCase() === "not assigned") return "Coordinator";
    return `${subject} Coordinator`;
  }, [coordinatorProfile?.subjectAssigned]);
  const selectedSubjectKey = useMemo<SubjectKey>(() => toSubjectKey(selectedSubject), [selectedSubject]);
  const resolvedLevelLabels = useMemo(() => {
    const labels = analyticsData?.levelLabels ?? [];
    if (labels.length > 0) {
      return labels;
    }
    return PHONEMIC_LEVELS[selectedSubjectKey];
  }, [analyticsData?.levelLabels, selectedSubjectKey]);

  const levelKeyByIndex = useMemo(() => resolvedLevelLabels.map((_, index) => `level_${index}`), [resolvedLevelLabels]);

  const monthlyLevelProgressData = useMemo(() => {
    const monthSeries = analyticsData?.monthSeries ?? [];
    const countsByMonth = analyticsData?.monthlyLevelCounts ?? {};

    return monthSeries.map((month) => {
      const values = countsByMonth[month.key] ?? [];
      const row: Record<string, string | number> = { month: month.label.slice(0, 3) };
      levelKeyByIndex.forEach((key, index) => {
        row[key] = Number(values[index] ?? 0) || 0;
      });
      return row;
    });
  }, [analyticsData?.monthSeries, analyticsData?.monthlyLevelCounts, levelKeyByIndex]);

  const interventionLevelData = useMemo(() => {
    const before = analyticsData?.levelShift.before ?? [];
    const after = analyticsData?.levelShift.after ?? [];

    return resolvedLevelLabels.map((level, index) => ({
      level,
      before: Number(before[index] ?? 0) || 0,
      after: Number(after[index] ?? 0) || 0,
      color: chartMultiPalette[index % chartMultiPalette.length],
    }));
  }, [analyticsData?.levelShift.after, analyticsData?.levelShift.before, resolvedLevelLabels]);

  const phonemicLevelPieData = useMemo(() => {
    const distribution = analyticsData?.phonemicDistribution ?? [];
    return resolvedLevelLabels
      .map((name, index) => ({
        name,
        value: Number(distribution[index] ?? 0) || 0,
        color: chartMultiPalette[index % chartMultiPalette.length],
      }))
      .filter((item) => item.value > 0);
  }, [analyticsData?.phonemicDistribution, resolvedLevelLabels]);
  const hasPhonemicLevelPieData = useMemo(() => phonemicLevelPieData.some((item) => item.value > 0), [phonemicLevelPieData]);

  const showInitialSkeleton =
    (isLoadingProfile && !coordinatorProfile && !profileError) ||
    (isLoadingAnalytics && analyticsData === null && !analyticsError) ||
    (userId !== null && isLoadingStudents && students.length === 0 && !studentsError);

  if (showInitialSkeleton) {
    return <MasterTeacherPageSkeleton title="Dashboard" variant="coordinator" />;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-live print-page relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
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
                <SecondaryHeader title="Teacher's Profile" />
                <div className="flex space-x-2 mt-2 md:mt-0"></div>
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
                ) : coordinatorProfile ? (
                  <div className="grid grid-cols-1 gap-2 text-sm font-medium text-slate-700 sm:text-base md:grid-cols-4 md:gap-0">
                    <div className="md:border-r md:border-slate-200 md:pr-3">
                      <p className="font-semibold text-slate-900 md:text-center">{coordinatorProfile.fullName}</p>
                    </div>
                    <div className="md:border-r md:border-slate-200 md:px-3">
                      <p className="font-semibold text-slate-900 md:text-center">{coordinatorProfile.role}</p>
                    </div>
                    <div className="md:border-r md:border-slate-200 md:px-3">
                      <p className="font-semibold text-slate-900 md:text-center">{gradeNumberLabel}</p>
                    </div>
                    <div className="md:pl-3">
                      <p className="font-semibold text-slate-900 md:text-center">{coordinatorLabel}</p>
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
                <DashboardMetricCard
                  value={totalStudentsValue}
                  label="Total Students"
                  icon={<GraduationCap className="h-5.5 w-5.5" />}
                  onClick={() => handleNavigate("/MasterTeacher/Coordinator/students")}
                />
                <DashboardMetricCard
                  value={teacherCardValue}
                  label="Total Teachers"
                  icon={<FaChalkboardTeacher className="h-5.5 w-5.5" />}
                  onClick={() => handleNavigate("/MasterTeacher/Coordinator/teachers")}
                />
                <DashboardMetricCard
                  value={pendingReviewsValue}
                  label="Pending Materials"
                  icon={<FolderOpen className="h-5.5 w-5.5" />}
                  onClick={() => handleNavigate("/MasterTeacher/Coordinator/materials?status=pending")}
                />
                <DashboardMetricCard value={todayDateLabel} label="Date Today" icon={<CalendarDays className="h-5.5 w-5.5" />} />
              </div>

              {analyticsError ? (
                <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{analyticsError}</div>
              ) : null}

              <hr className="border-gray-200 mb-4 sm:mb-5 md:mb-6" />

              {/* Charts Section */}
              <div>
                <div className="no-print mb-4 p-1">
                  <div className="flex items-start justify-end gap-3">
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="relative">
                        {isFilterModalOpen && (
                          <button
                            type="button"
                            className="fixed inset-0 z-10 cursor-default"
                            onClick={() => setIsFilterModalOpen(false)}
                            aria-label="Close filter panel"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setIsFilterModalOpen((prev) => !prev)}
                          className="relative z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100"
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
                                  {handledSubjectOptions.map((subjectOption) => (
                                    <FilterChip
                                      key={subjectOption}
                                      label={subjectOption}
                                      active={selectedSubject === subjectOption}
                                      onClick={() => setSelectedSubject(subjectOption)}
                                    />
                                  ))}
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
                                onClick={() => setIsFilterModalOpen(false)}
                              >
                                Apply Filters
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100"
                        aria-label="Print dashboard"
                        title="Print"
                      >
                        <Printer className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div>
                    <SecondaryHeader title="Class Progress Overview" />
                    <div className="mt-3 grid grid-cols-1 gap-4">
                      <div className="rounded-2xl border border-white/75 bg-white/55 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg">
                        <p className="text-sm font-semibold text-slate-700">Monthly Student Progress by Level</p>
                        <div className="mt-3 h-64">
                          {isLoadingAnalytics ? (
                            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 text-sm font-medium text-slate-500">
                              Loading monthly progress...
                            </div>
                          ) : monthlyLevelProgressData.length === 0 ? (
                            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 text-sm font-medium text-slate-500">
                              No monthly progress data available for the selected grade and subject.
                            </div>
                          ) : (
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
                          )}
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
                          {isLoadingAnalytics ? (
                            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 text-sm font-medium text-slate-500">
                              Loading intervention data...
                            </div>
                          ) : interventionLevelData.length === 0 ? (
                            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 text-sm font-medium text-slate-500">
                              No intervention shift data available.
                            </div>
                          ) : (
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
                          )}
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
          </div>
        </main>
      </div>

      </div>

      <div className="print-report-root" aria-hidden={!isPreparingPrint && !isPrintReady}>
        <div className="print-report-header">
          <div>
            <h1>Coordinator Dashboard Report</h1>
            <p className="print-report-subtitle">Scoped to handled grade level and subject assignments</p>
          </div>
          <p className="print-report-date">Generated: {todayDateLabel}</p>
        </div>

        <div className="print-report-kpis">
          <article className="print-report-card">
            <h3>Total Students</h3>
            <p className="print-metric-value">{Number(totalStudentsValue) || 0}</p>
          </article>
          <article className="print-report-card">
            <h3>Total Teachers</h3>
            <p className="print-metric-value">{Number(teacherCardValue) || 0}</p>
          </article>
          <article className="print-report-card">
            <h3>Pending Materials</h3>
            <p className="print-metric-value">{Number(pendingReviewsValue) || 0}</p>
          </article>
          <article className="print-report-card">
            <h3>Subject / Grade</h3>
            <p className="print-metric-value">{`${selectedSubject} / ${gradeNumberLabel}`}</p>
          </article>
        </div>

        <section className="print-section-block">
          <h2>Teacher Profile</h2>
          <div className="print-report-card print-profile-grid">
            <div>
              <span className="print-label">Name</span>
              <p>{coordinatorProfile?.fullName ?? "N/A"}</p>
            </div>
            <div>
              <span className="print-label">Role</span>
              <p>{coordinatorProfile?.role ?? "N/A"}</p>
            </div>
            <div>
              <span className="print-label">Grade</span>
              <p>{gradeNumberLabel}</p>
            </div>
            <div>
              <span className="print-label">Coordinator</span>
              <p>{coordinatorLabel}</p>
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

          .print-page,
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

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active ? "border-emerald-700 bg-emerald-700 text-white" : "border-emerald-100 bg-white/70 text-emerald-900 hover:border-emerald-300"
      }`}
    >
      {label}
    </button>
  );
}
