"use client";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { ReactElement, RefObject } from "react";
import Header from "@/components/Parent/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import { composeRuleBasedSlideFeedbackParagraph, getReadingSpeedLabel } from "@/lib/performance/insights";

const SUPPORTED_SUBJECTS = ["English", "Filipino", "Math"] as const;

function formatChildName(firstName: string, middleName?: string | null, lastName?: string | null) {
  const safeFirst = typeof firstName === "string" ? firstName.trim() : "";
  const safeLast = typeof lastName === "string" ? lastName.trim() : "";
  const middleInitial = typeof middleName === "string" && middleName.trim().length > 0
    ? `${middleName.trim()[0].toUpperCase()}.`
    : "";

  const fullName = [safeFirst, middleInitial, safeLast].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return fullName.length > 0 ? fullName : "Student";
}

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
  const containerClasses = `
      rounded-2xl border border-white/70 bg-white/60 shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl
      flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px]
      transition duration-200 hover:border-gray-200 hover:bg-white/70
      sm:p-6 sm:min-w-[180px] sm:min-h-[120px]
      lg:p-7
      ${className}
    `;

  const content = (
    <>
      <div className="flex flex-row items-center">
        <span className="text-4xl font-semibold text-slate-900 sm:text-5xl">{value}</span>
        {icon && <span className="ml-1 sm:ml-2">{icon}</span>}
      </div>
      <div className="text-slate-600 text-sm font-medium mt-1 tracking-wide sm:text-base sm:mt-2">{label}</div>
    </>
  );

  if (typeof onClick === "function") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${containerClasses} focus:outline-none cursor-pointer text-left`}
      >
        {content}
      </button>
    );
  }

  return <div className={containerClasses}>{content}</div>;
}

function ScheduleCard({
  day,
  subject,
  time,
  isToday = false,
}: {
  day: string;
  subject: string;
  time: string | null;
  isToday?: boolean;
}) {
  return (
    <div
      className={`bg-white p-4 rounded-lg shadow flex justify-between items-center border border-gray-200 ${isToday ? "border-gray-300 bg-green-50" : ""
        }`}
    >
      <div>
        <h4 className={`font-semibold ${isToday ? "text-green-900" : "text-green-900"}`}>{day}</h4>
        <p className="text-sm text-gray-600">{subject}</p>
      </div>
      <div className="text-sm text-gray-500">{time ?? "Schedule pending"}</div>
    </div>
  );
}

type AttendanceRecord = {
  date: string;
  subject: string | null;
  present: boolean;
};

type AttendanceCalendarProps = {
  attendanceRecords: AttendanceRecord[];
  attendanceRate: number | null;
};

type AttendanceSummary = {
  records: AttendanceRecord[];
  totalSessions: number;
  presentSessions: number;
  absentSessions: number;
  attendanceRate: number | null;
};

type ScheduleEntry = {
  day: string;
  subject: string;
  timeRange: string | null;
};

type SupportedSubject = (typeof SUPPORTED_SUBJECTS)[number];

type SubjectProgress = {
  currentLevel: string;
  startingLevel: string;
  improvement: string;
  teacherComments: string;
  aiRecommendation: string;
  teacher: string;
};

type ChildProfile = {
  studentId: string;
  userId: number;
  firstName: string;
  middleName: string | null;
  lastName: string;
  grade: string | null;
  section: string | null;
  relationship: string | null;
  subjects: string[];
  currentLevel?: Record<SupportedSubject, string>;
  progressDetails?: Record<SupportedSubject, SubjectProgress>;
};

type ChildView = ChildProfile & {
  age: number;
  teacher: string;
  attendance: number | null;
  currentLevel: Record<SupportedSubject, string>;
  progressDetails: Record<SupportedSubject, SubjectProgress>;
};

type ParentInfo = {
  parentId: number;
  relationship: string | null;
};

type ParentDashboardResponse = {
  parent: ParentInfo;
  children: ChildProfile[];
  child: ChildProfile;
  attendance: AttendanceSummary;
  schedule: ScheduleEntry[];
  selectedSubject: string | null;
  sessions: RemedialSessionTimelineItem[];
  assessments: StudentAssessmentRecord[];
};

type ParentDashboardState = {
  isLoading: boolean;
  error: string | null;
  parent: ParentInfo | null;
  child: ChildProfile | null;
  children: ChildProfile[];
  attendance: AttendanceSummary | null;
  schedule: ScheduleEntry[];
  selectedSubject: string | null;
  sessions: RemedialSessionTimelineItem[];
  assessments: StudentAssessmentRecord[];
};

type RemedialSessionSlide = {
  performance_id?: number | string | null;
  flashcard_index?: number | null;
  reading_tutor_feedback?: string | null;
  accuracy_score?: number | null;
  reading_speed_wpm?: number | null;
  slide_average?: number | null;
};

type RemedialSessionTimelineItem = {
  session_id?: number | string | null;
  overall_average?: number | null;
  ai_remarks?: string | null;
  teacher_notes?: string | null;
  completed_at?: string | Date | null;
  created_at?: string | Date | null;
  schedule_title?: string | null;
  schedule_date?: string | Date | null;
  phonemic_level?: string | null;
  slides: RemedialSessionSlide[];
};

type StudentAssessmentRecord = {
  attempt_id?: number | string | null;
  assessment_id?: number | string | null;
  title?: string | null;
  description?: string | null;
  phonemic_level?: string | null;
  total_score?: number | null;
  total_points?: number | null;
  status?: string | null;
  submitted_at?: string | Date | null;
};

type SessionSummary = {
  dateLabel: string;
  titleLabel: string;
  phonemicLabel: string;
  overallLabel: string;
  slideCountLabel: string;
};

type TimelineEntry =
  | {
      key: string;
      kind: "assessment";
      timestamp: number;
      assessment: StudentAssessmentRecord;
    }
  | {
      key: string;
      kind: "session";
      timestamp: number;
      session: RemedialSessionTimelineItem;
      summary: SessionSummary;
    };

type InfoCardProps = {
  label: string;
  value: string;
  hint?: string | null;
};

type DetailChipProps = {
  label: string;
  value: string;
  emphasized?: boolean;
};

type RecordBadgeProps = {
  kind: "assessment" | "session";
};

type StatusBadgeProps = {
  value: string;
};

type NoteCardProps = {
  label: string;
  value: string;
};

const EMPTY_VALUE = "--";

const toTimestamp = (value: string | Date | null | undefined) => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return EMPTY_VALUE;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatPercent = (value: number | null | undefined) => {
  if (typeof value !== "number") return EMPTY_VALUE;
  return `${Math.round(value)}%`;
};

const formatInteger = (value: number | null | undefined) => {
  if (typeof value !== "number") return EMPTY_VALUE;
  return String(Math.round(value));
};

const formatStatusLabel = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return EMPTY_VALUE;

  return trimmed.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatSlideAverage = (slide: RemedialSessionSlide) =>
  formatPercent(typeof slide.slide_average === "number" ? slide.slide_average : null);

const formatAssessmentScore = (assessment: StudentAssessmentRecord) => {
  const score = assessment.total_score;
  const totalPoints = assessment.total_points;

  if (typeof score !== "number") {
    return { value: EMPTY_VALUE, hint: null as string | null };
  }

  if (typeof totalPoints === "number" && totalPoints > 0) {
    const percent = Math.round((score / totalPoints) * 100);
    return {
      value: `${percent}%`,
      hint: `${Math.round(score)} / ${Math.round(totalPoints)} points`,
    };
  }

  return {
    value: formatInteger(score),
    hint: null as string | null,
  };
};

const buildSessionSummary = (session: RemedialSessionTimelineItem): SessionSummary => {
  const completed = session.completed_at ?? session.created_at;
  const scheduleDate = session.schedule_date ?? completed;

  return {
    dateLabel: formatDate(scheduleDate),
    titleLabel: (session.schedule_title ?? "").trim(),
    phonemicLabel: (session.phonemic_level ?? "").trim() || EMPTY_VALUE,
    overallLabel: formatPercent(session.overall_average),
    slideCountLabel: String(session.slides.length),
  };
};

const buildSessionKey = (session: RemedialSessionTimelineItem, index: number) =>
  String(session.session_id ?? `${session.schedule_date ?? session.completed_at ?? session.created_at ?? "session"}-${index}`);

const buildAssessmentKey = (assessment: StudentAssessmentRecord, index: number) =>
  String(assessment.attempt_id ?? assessment.assessment_id ?? `${assessment.title ?? "assessment"}-${assessment.submitted_at ?? index}`);

function InfoCard({ label, value, hint }: InfoCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function DetailChip({ label, value, emphasized = false }: DetailChipProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        emphasized ? "border-emerald-200 bg-emerald-50 text-[#013300]" : "border-slate-200 bg-slate-50 text-slate-700",
      ].join(" ")}
    >
      <span className="text-slate-500">{label}</span>
      <span className="ml-1 font-semibold">{value}</span>
    </span>
  );
}

function RecordBadge({ kind }: RecordBadgeProps) {
  const classes = kind === "assessment" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-emerald-200 bg-emerald-50 text-[#013300]";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {kind === "assessment" ? "Assessment" : "Remedial Session"}
    </span>
  );
}

function StatusBadge({ value }: StatusBadgeProps) {
  const normalized = value.toLowerCase();
  const classes =
    normalized === "graded" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700";

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{value}</span>;
}

function NoteCard({ label, value }: NoteCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 leading-6">{value}</p>
    </div>
  );
}

function AttendanceCalendar({ attendanceRecords, attendanceRate }: AttendanceCalendarProps) {
  const parseRecordDate = useCallback((value: string | null | undefined) => {
    if (!value) return null;
    const candidate = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
    return Number.isNaN(candidate.getTime()) ? null : candidate;
  }, []);

  const latestDate = useMemo(() => {
    const fallback = new Date();
    if (attendanceRecords.length === 0) {
      return fallback;
    }

    let latest: Date | null = null;
    for (const record of attendanceRecords) {
      const parsed = parseRecordDate(record.date);
      if (!parsed) continue;
      if (!latest || parsed.getTime() > latest.getTime()) {
        latest = parsed;
      }
    }

    return latest ?? fallback;
  }, [attendanceRecords, parseRecordDate]);

  const [currentMonth, setCurrentMonth] = useState<number>(latestDate.getMonth());
  const [currentYear, setCurrentYear] = useState<number>(latestDate.getFullYear());

  useEffect(() => {
    if (attendanceRecords.length === 0) return;
    setCurrentMonth(latestDate.getMonth());
    setCurrentYear(latestDate.getFullYear());
  }, [attendanceRecords, latestDate]);

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, { hasRecord: boolean; present: boolean }>();
    for (const record of attendanceRecords) {
      const parsed = parseRecordDate(record.date);
      if (!parsed) continue;
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(
        parsed.getDate(),
      ).padStart(2, "0")}`;
      const current = map.get(key);
      if (!current) {
        map.set(key, { hasRecord: true, present: record.present });
        continue;
      }
      // If any record is absent, mark the day as absent
      current.present = current.present && record.present;
      current.hasRecord = true;
    }
    return map;
  }, [attendanceRecords, parseRecordDate]);

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const navigateMonth = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear((year) => year - 1);
      } else {
        setCurrentMonth((month) => month - 1);
      }
    } else if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((year) => year + 1);
    } else {
      setCurrentMonth((month) => month + 1);
    }
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDayOfMonth = getFirstDayOfMonth(currentMonth, currentYear);

  const dayCells: ReactElement[] = [];
  for (let emptyIndex = 0; emptyIndex < firstDayOfMonth; emptyIndex += 1) {
    dayCells.push(<div key={`empty-${emptyIndex}`} className="h-12" />);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const summary = attendanceByDate.get(dateKey);
    const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const today = new Date();
    const isToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === day;

    let statusClass = "bg-gray-50 text-gray-400"; // default: no record
    if (summary?.hasRecord) {
      statusClass = summary.present
        ? "bg-green-100 text-green-800 border border-gray-200"
        : "bg-red-100 text-red-800 border border-red-200";
    } else if (isWeekend) {
      statusClass = "bg-gray-50 text-gray-400";
    }

    dayCells.push(
      <div
        key={day}
        className={`h-12 flex items-center justify-center rounded text-sm font-medium border border-gray-100 ${statusClass} ${isToday ? "ring-1 ring-gray-300" : ""
          }`}
      >
        {day}
      </div>,
    );
  }

  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const monthlyRecords = attendanceRecords.filter((record) => record.date.startsWith(monthKey));
  const monthTotal = monthlyRecords.length;
  const monthPresent = monthlyRecords.filter((record) => record.present).length;
  const monthRate = monthTotal > 0 ? Math.round((monthPresent / monthTotal) * 100) : null;
  const displayedRate = monthRate ?? attendanceRate;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h4 className="font-bold text-gray-800">Monthly Attendance</h4>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigateMonth("prev")}
            className="p-1 rounded hover:bg-gray-100 text-black font-bold text-lg"
            type="button"
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="font-semibold text-gray-700">
            {months[currentMonth]} {currentYear}
          </span>
          <button
            onClick={() => navigateMonth("next")}
            className="p-1 rounded hover:bg-gray-100 text-black font-bold text-lg"
            type="button"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-6">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-600 py-1">
            {day}
          </div>
        ))}
        {dayCells}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs mb-6">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-green-100 rounded border border-gray-200" />
          <span className="text-gray-700 font-medium">Present</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-red-100 rounded border border-red-200" />
          <span className="text-gray-700 font-medium">Absent</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-gray-50 rounded border border-gray-200" />
          <span className="text-gray-700 font-medium">No record</span>
        </div>
      </div>

      <div className="p-4 rounded-lg border border-gray-200 bg-white">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-800">Monthly Attendance Rate</span>
          <span className="px-3 py-1 text-base font-bold text-gray-800">
            {displayedRate != null ? `${displayedRate}%` : "—"}
          </span>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          {monthTotal > 0
            ? `Based on ${monthPresent} of ${monthTotal} recorded sessions this month.`
            : "No attendance records available for this month."}
        </p>
      </div>
    </div>
  );
}

// Progress Card Component
function ProgressCard({ title, value, description, icon, color = "green" }: {
  title: string;
  value: string;
  description: string;
  icon?: React.ReactNode;
  color?: "green" | "blue" | "orange" | "yellow";
}) {
  const colorClasses = {
    green: "border border-gray-200 bg-white/60 backdrop-blur-md",
    blue: "border border-gray-200 bg-white/60 backdrop-blur-md",
    orange: "border border-gray-200 bg-white/60 backdrop-blur-md",
    yellow: "border border-gray-200 bg-white/60 backdrop-blur-md"
  };

  return (
    <div className={`p-4 rounded-xl ${colorClasses[color]} shadow-[0_8px_24px_rgba(15,23,42,0.07)]`}>
      <div className="flex items-center mb-2">
        {icon && <div className="mr-3 text-2xl">{icon}</div>}
        <h4 className="font-bold text-gray-800">{title}</h4>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

const FALLBACK_SUBJECTS: SupportedSubject[] = [...SUPPORTED_SUBJECTS];

const FALLBACK_CHILD_VIEW: ChildView = {
  studentId: "",
  userId: 0,
  relationship: null,
  subjects: FALLBACK_SUBJECTS,
  firstName: "",
  middleName: null,
  lastName: "",
  grade: null,
  section: null,
  age: 0,
  teacher: "—",
  attendance: null,
  currentLevel: {
    English: "—",
    Filipino: "—",
    Math: "—",
  },
  progressDetails: {
    English: {
      currentLevel: "—",
      startingLevel: "—",
      improvement: "—",
      teacherComments: "—",
      aiRecommendation: "—",
      teacher: "—",
    },
    Filipino: {
      currentLevel: "—",
      startingLevel: "—",
      improvement: "—",
      teacherComments: "—",
      aiRecommendation: "—",
      teacher: "—",
    },
    Math: {
      currentLevel: "—",
      startingLevel: "—",
      improvement: "—",
      teacherComments: "—",
      aiRecommendation: "—",
      teacher: "—",
    },
  },
};

const FALLBACK_SCHEDULE: ScheduleEntry[] = [];
const FALLBACK_SESSIONS: RemedialSessionTimelineItem[] = [];
const FALLBACK_ASSESSMENTS: StudentAssessmentRecord[] = [];

const isSupportedSubject = (subject: string): subject is SupportedSubject =>
  SUPPORTED_SUBJECTS.includes(subject as SupportedSubject);

export default function ParentDashboard() {
  const [selectedSubject, setSelectedSubject] = useState<SupportedSubject>("English");
  const [state, setState] = useState<ParentDashboardState>({
    isLoading: true,
    error: null,
    parent: null,
    child: null,
    children: [],
    attendance: null,
    schedule: [],
    selectedSubject: null,
    sessions: [],
    assessments: [],
  });
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const progressSectionRef = useRef<HTMLDivElement | null>(null);
  const attendanceSectionRef = useRef<HTMLDivElement | null>(null);

  const scrollToSection = useCallback((sectionRef: RefObject<HTMLDivElement | null>) => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const profile = getStoredUserProfile();
    const userId = Number(profile?.userId);

    if (!Number.isFinite(userId)) {
      setState((previous) => ({
        ...previous,
        isLoading: false,
        error: "Unable to determine the signed-in parent. Please sign in again.",
      }));
      return;
    }

    const controller = new AbortController();

    const loadDashboard = async () => {
      setState((previous) => ({ ...previous, isLoading: true, error: null }));
      try {
        const query = new URLSearchParams({ userId: String(userId) });
        if (selectedChildId) {
          query.set("studentId", selectedChildId);
        }
        query.set("subject", selectedSubject);
        const response = await fetch(`/api/parent/dashboard?${query.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (!response.ok || !payload) {
          const message =
            typeof payload === "object" && payload && "error" in payload
              ? String((payload as { error?: unknown }).error)
              : `Failed to load dashboard (${response.status})`;
          throw new Error(message);
        }

        const data = payload as ParentDashboardResponse;

        if (!selectedChildId && data.child?.studentId) {
          setSelectedChildId(data.child.studentId);
        }

        setState({
          isLoading: false,
          error: null,
          parent: data.parent,
          children: data.children ?? [],
          child: data.child,
          attendance: data.attendance,
          schedule: data.schedule,
          selectedSubject: data.selectedSubject ?? null,
          sessions: Array.isArray(data.sessions) ? data.sessions : [],
          assessments: Array.isArray(data.assessments) ? data.assessments : [],
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to load dashboard.";
        setState({
          isLoading: false,
          error: message,
          parent: null,
          child: null,
          children: [],
          attendance: null,
          schedule: [],
          selectedSubject: null,
          sessions: [],
          assessments: [],
        });
      }
    };

    loadDashboard();

    return () => {
      controller.abort();
    };
  }, [selectedChildId, selectedSubject]);

  const handleSubjectCardClick = useCallback(
    (subject: SupportedSubject) => {
      setSelectedSubject(subject);
      scrollToSection(progressSectionRef);
    },
    [scrollToSection],
  );

  const handleAttendanceCardClick = useCallback(() => {
    scrollToSection(attendanceSectionRef);
  }, [scrollToSection]);

  // Get current day for highlighting
  const getCurrentDay = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  const currentDay = getCurrentDay();
  const attendanceSummary: AttendanceSummary = state.attendance ?? {
    records: [],
    totalSessions: 0,
    presentSessions: 0,
    absentSessions: 0,
    attendanceRate: null,
  };

  const attendanceRecords = attendanceSummary.records;

  const currentChild = useMemo<ChildView>(() => {
    if (!state.child) {
      return FALLBACK_CHILD_VIEW;
    }

    const supportedSubjects = (state.child.subjects ?? []).filter(isSupportedSubject);
    const subjectsFromApi = supportedSubjects.length > 0 ? supportedSubjects : FALLBACK_CHILD_VIEW.subjects;
    const currentLevel = {
      ...FALLBACK_CHILD_VIEW.currentLevel,
      ...(state.child.currentLevel ?? {}),
    };
    const progressDetails = {
      ...FALLBACK_CHILD_VIEW.progressDetails,
      ...(state.child.progressDetails ?? {}),
    };

    return {
      ...FALLBACK_CHILD_VIEW,
      studentId: state.child.studentId,
      userId: state.child.userId,
      firstName: state.child.firstName || FALLBACK_CHILD_VIEW.firstName,
      middleName: state.child.middleName ?? FALLBACK_CHILD_VIEW.middleName,
      lastName: state.child.lastName || FALLBACK_CHILD_VIEW.lastName,
      grade: state.child.grade ?? FALLBACK_CHILD_VIEW.grade,
      section: state.child.section ?? FALLBACK_CHILD_VIEW.section,
      relationship: state.child.relationship ?? FALLBACK_CHILD_VIEW.relationship,
      subjects: subjectsFromApi,
      attendance: attendanceSummary.attendanceRate ?? FALLBACK_CHILD_VIEW.attendance,
      currentLevel,
      progressDetails,
    };
  }, [state.child, attendanceSummary.attendanceRate]);

  const subjects = useMemo<SupportedSubject[]>(() => {
    const filtered = currentChild.subjects.filter(isSupportedSubject);
    return filtered.length > 0 ? filtered : FALLBACK_SUBJECTS;
  }, [currentChild]);

  const childOptions = state.children.length > 0 ? state.children : state.child ? [state.child] : [];

  const attendanceRate = attendanceSummary.attendanceRate ?? currentChild.attendance;
  const attendanceDaysDisplay =
    attendanceSummary.totalSessions > 0
      ? `${attendanceSummary.presentSessions}/${attendanceSummary.totalSessions} days`
      : "--";

  useEffect(() => {
    if (subjects.length === 0) {
      return;
    }
    setSelectedSubject((current) => (subjects.includes(current) ? current : subjects[0]));
  }, [subjects]);

  const scheduleEntries = state.schedule.length > 0 ? state.schedule : FALLBACK_SCHEDULE;

  const currentProgress: SubjectProgress =
    currentChild.progressDetails[selectedSubject] ?? currentChild.progressDetails.English;

  const sessions = state.sessions.length > 0 ? state.sessions : FALLBACK_SESSIONS;
  const assessments = state.assessments.length > 0 ? state.assessments : FALLBACK_ASSESSMENTS;

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    const sessionEntries: TimelineEntry[] = sessions.map((session, index) => {
      const completed = session.schedule_date ?? session.completed_at ?? session.created_at;
      return {
        key: buildSessionKey(session, index),
        kind: "session",
        timestamp: toTimestamp(completed),
        session,
        summary: buildSessionSummary(session),
      };
    });

    const assessmentEntries: TimelineEntry[] = assessments.map((assessment, index) => ({
      key: buildAssessmentKey(assessment, index),
      kind: "assessment",
      timestamp: toTimestamp(assessment.submitted_at),
      assessment,
    }));

    return [...assessmentEntries, ...sessionEntries].sort((left, right) => right.timestamp - left.timestamp);
  }, [assessments, sessions]);

  const firstSessionKey = useMemo(() => timelineEntries.find((entry) => entry.kind === "session")?.key ?? null, [timelineEntries]);
  const [expandedSessionKey, setExpandedSessionKey] = useState<string | null>(firstSessionKey);

  useEffect(() => {
    if (!firstSessionKey) {
      setExpandedSessionKey(null);
      return;
    }

    setExpandedSessionKey((current) => {
      if (!current) return firstSessionKey;
      return timelineEntries.some((entry) => entry.kind === "session" && entry.key === current) ? current : firstSessionKey;
    });
  }, [firstSessionKey, timelineEntries]);

  const assessmentCount = assessments.length;
  const sessionCount = sessions.length;

  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      {/*---------------------------------Main Content---------------------------------*/}
      <div className="relative z-10 w-full pt-16 flex flex-col overflow-hidden">
        <Header
          title="Dashboard"
          childOptions={childOptions.map((child) => ({
            id: child.studentId,
            label: formatChildName(child.firstName, child.middleName, child.lastName),
          }))}
          selectedChildId={selectedChildId}
          onChildSelect={setSelectedChildId}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="relative p-4 h-full sm:p-5 md:p-6">
            {/*---------------------------------Main Container---------------------------------*/}
            <div className="relative w-full h-full min-h-95 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">
              <div className="mb-6">
                <SecondaryHeader title="Child Profile" />
              </div>

              {state.error && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  {state.error}
                </div>
              )}

              {state.isLoading && !state.child && !state.error && (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Loading child details…
                </div>
              )}

              {/* Child Details Section */}
              <div className="mb-8 min-h-40 rounded-2xl border border-white/75 bg-white/55 p-6 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg flex flex-col gap-6 md:flex-row md:items-start md:px-8">

                <div className="flex-1 w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
                    <div>
                      <span className="block text-lg font-bold text-[#014421]">First Name:</span>
                      <span className="block text-base text-black">{currentChild.firstName}</span>
                    </div>
                    <div>
                      <span className="block text-lg font-bold text-[#014421]">Grade:</span>
                      <span className="block text-base text-black">{currentChild.grade}</span>
                    </div>
                    <div>
                      <span className="block text-lg font-bold text-[#014421]">Middle Name:</span>
                      <span className="block text-base text-black">{currentChild.middleName}</span>
                    </div>
                    <div>
                      <span className="block text-lg font-bold text-[#014421]">Section:</span>
                      <span className="block text-base text-black">{currentChild.section}</span>
                    </div>
                    <div>
                      <span className="block text-lg font-bold text-[#014421]">Surname:</span>
                      <span className="block text-base text-black">{currentChild.lastName}</span>
                    </div>
                    <div>
                      <span className="block text-lg font-bold text-[#014421]">Age:</span>
                      <span className="block text-base text-black">{currentChild.age}</span>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-gray-200 mb-6" />

              {/* Overview Cards Section */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <SecondaryHeader title="Child Performance" />
              </div>
              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 sm:gap-5 sm:mb-7 lg:grid-cols-4 lg:gap-6 lg:mb-8">
                <OverviewCard
                  value={attendanceDaysDisplay}
                  label="Attendance Days"
                  icon={
                    <svg width="38" height="38" fill="none" viewBox="0 0 24 24">
                      <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                  onClick={handleAttendanceCardClick}
                />
                <OverviewCard
                  value={<span className="text-3xl sm:text-4xl font-extrabold text-[#013300]">{currentChild.currentLevel.English.split(' ')[0]}</span>}
                  label="English Level"
                  onClick={() => handleSubjectCardClick('English')}
                />
                <OverviewCard
                  value={<span className="text-3xl sm:text-4xl font-extrabold text-[#013300]">{currentChild.currentLevel.Filipino.split(' ')[0]}</span>}
                  label="Filipino Level"
                  onClick={() => handleSubjectCardClick('Filipino')}
                />
                <OverviewCard
                  value={<span className="text-3xl sm:text-4xl font-extrabold text-[#013300]">{currentChild.currentLevel.Math.split(' ')[0]}</span>}
                  label="Math Level"
                  onClick={() => handleSubjectCardClick('Math')}
                />
              </div>

              <hr className="border-gray-200 mb-6" />

              {/* Remedial Subjects Section */}
              <div className="space-y-8">
                <div ref={progressSectionRef} className="rounded-2xl border border-white/75 bg-white/55 p-6 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg">
                  <TertiaryHeader title="Learning Progress" />

                  {/* Subject Buttons */}
                  <div className="flex flex-wrap gap-4 mt-6 mb-8">
                    {subjects.map((subject) => {
                      const isActive = selectedSubject === subject;
                      return (
                        <UtilityButton
                          key={subject}
                          onClick={() => handleSubjectCardClick(subject)}
                          className={`transition-all duration-200 ${isActive ? 'shadow-lg' : 'bg-white! text-[#013300]! border-gray-300 hover:bg-gray-50! hover:text-[#013300]!'}`}
                        >
                          {subject}
                        </UtilityButton>
                      );
                    })}
                  </div>

                  {/* Teacher Information */}
                  <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h4 className="font-bold text-green-800 mb-2">
                      Subject Teacher: {currentProgress.teacher}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Your child&apos;s progress in {selectedSubject} is guided by {currentProgress.teacher}
                    </p>
                  </div>

                  {/* Subject Details Container */}
                  <div className="space-y-6">
                    {/* Progress Overview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <ProgressCard
                        title="Current Level"
                        value={currentProgress.currentLevel}
                        description="Where your child is now"
                        color="yellow"
                      />
                      <ProgressCard
                        title="Progress Made"
                        value={currentProgress.improvement}
                        description="Since starting remedial classes"
                        color="blue"
                      />
                      <ProgressCard
                        title="Starting Level"
                        value={currentProgress.startingLevel}
                        description="When remedial classes began"
                        color="orange"
                      />
                    </div>

                    {/* AI Recommendation */}
                    <div className="grid grid-cols-1 gap-6">
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <h4 className="font-bold text-green-800 mb-3 flex items-center">
                          AI Recommendation
                        </h4>
                        <p className="text-gray-700">{currentProgress.aiRecommendation}</p>
                      </div>
                    </div>

                    {/* Teacher Feedback */}
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                      <h4 className="font-bold text-gray-800">Teacher&apos;s Comment</h4>
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">
                        {currentProgress.teacherComments}
                      </p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-green-700">
                        - {currentProgress.teacher}
                      </p>
                    </div>

                    {/* Progress Timeline */}
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#013300]">Progress Timeline ({selectedSubject})</p>
                          <p className="text-sm text-slate-500">Assessment records and remedial sessions arranged by date.</p>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <DetailChip label="All" value={String(timelineEntries.length)} />
                          <DetailChip label="Assessments" value={String(assessmentCount)} />
                          <DetailChip label="Sessions" value={String(sessionCount)} />
                        </div>
                      </div>
                    </div>

                    {state.isLoading && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Updating progress timeline...
                      </div>
                    )}

                    {timelineEntries.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                        No performance records found for {selectedSubject}.
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-4 top-0 h-full w-px bg-slate-200" />

                        <div className="space-y-4">
                          {timelineEntries.map((entry) => {
                            if (entry.kind === "assessment") {
                              const assessment = entry.assessment;
                              const title = (assessment.title ?? "").trim() || "Untitled Assessment";
                              const description = (assessment.description ?? "").trim();
                              const phonemicLabel = (assessment.phonemic_level ?? "").trim() || EMPTY_VALUE;
                              const statusLabel = formatStatusLabel(assessment.status);
                              const score = formatAssessmentScore(assessment);

                              return (
                                <section key={entry.key} className="relative pl-12">
                                  <span className="absolute left-1.5 top-5 h-5 w-5 rounded-full border-4 border-sky-600 bg-sky-100" />

                                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                    <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <RecordBadge kind="assessment" />
                                          <span className="text-sm text-slate-500">{formatDate(assessment.submitted_at)}</span>
                                        </div>

                                        <div>
                                          <p className="text-base font-semibold text-slate-900">{title}</p>
                                          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
                                        </div>
                                      </div>

                                      {statusLabel !== EMPTY_VALUE ? <StatusBadge value={statusLabel} /> : null}
                                    </div>

                                    <div className="grid gap-3 border-t border-slate-200 px-4 py-4 md:grid-cols-3">
                                      <InfoCard label="Score" value={score.value} hint={score.hint} />
                                      <InfoCard label="Status" value={statusLabel} />
                                      <InfoCard label="Phonemic" value={phonemicLabel} />
                                    </div>
                                  </div>
                                </section>
                              );
                            }

                            const { key, session, summary } = entry;
                            const isExpanded = expandedSessionKey === key;

                            return (
                              <section key={key} className="relative pl-12">
                                <span className="absolute left-1.5 top-5 h-5 w-5 rounded-full border-4 border-[#013300] bg-green-100" />

                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                  <button
                                    type="button"
                                    aria-expanded={isExpanded}
                                    onClick={() => setExpandedSessionKey((current) => (current === key ? null : key))}
                                    className="flex w-full flex-col gap-4 px-4 py-4 text-left sm:flex-row sm:items-start sm:justify-between"
                                  >
                                    <div className="space-y-3">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <RecordBadge kind="session" />
                                        <span className="text-sm text-slate-500">{summary.dateLabel}</span>
                                      </div>

                                      <div>
                                        <p className="text-base font-semibold text-slate-900">{summary.titleLabel || "Remedial Session"}</p>
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        <DetailChip label="Phonemic" value={summary.phonemicLabel} />
                                        <DetailChip label="Average" value={summary.overallLabel} emphasized />
                                        <DetailChip label="Slides" value={summary.slideCountLabel} />
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm font-semibold text-[#013300]">
                                      <span>{isExpanded ? "Hide" : "View"} details</span>
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className={isExpanded ? "rotate-180 transition" : "transition"}
                                      >
                                        <path d="m6 9 6 6 6-6" />
                                      </svg>
                                    </div>
                                  </button>

                                  {isExpanded && (
                                    <div className="border-t border-slate-200 px-4 pb-4 pt-4">
                                      <div className="grid gap-3 md:grid-cols-3">
                                        <InfoCard label="Phonemic" value={summary.phonemicLabel} />
                                        <InfoCard label="Overall Average" value={summary.overallLabel} />
                                        <InfoCard label="Slides Recorded" value={summary.slideCountLabel} />
                                      </div>

                                      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                                          <p className="text-sm font-semibold text-slate-900">Per-Slide Feedback</p>
                                        </div>

                                        <div className="overflow-x-auto">
                                          <table className="min-w-full text-left text-sm text-slate-700">
                                            <thead className="bg-white text-slate-600">
                                              <tr className="border-b border-slate-200">
                                                <th className="px-4 py-3 font-semibold">Slide</th>
                                                <th className="px-4 py-3 font-semibold">Accuracy</th>
                                                <th className="px-4 py-3 font-semibold">Reading Speed</th>
                                                <th className="px-4 py-3 font-semibold">Average</th>
                                                <th className="px-4 py-3 font-semibold">Feedback</th>
                                              </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-100 bg-white">
                                              {session.slides.length === 0 ? (
                                                <tr>
                                                  <td className="px-4 py-4 text-slate-500" colSpan={5}>
                                                    No slides recorded for this session.
                                                  </td>
                                                </tr>
                                              ) : (
                                                session.slides.map((slide) => {
                                                  const storedFeedback = (slide.reading_tutor_feedback ?? "").trim();
                                                  const slideFeedback =
                                                    storedFeedback ||
                                                    composeRuleBasedSlideFeedbackParagraph({
                                                      accuracyScore: slide.accuracy_score ?? null,
                                                      readingSpeedWpm: slide.reading_speed_wpm ?? null,
                                                      slideAverage: slide.slide_average ?? null,
                                                    });

                                                  return (
                                                    <tr key={String(slide.performance_id ?? `${key}-${slide.flashcard_index}`)}>
                                                      <td className="px-4 py-3 align-top font-semibold text-slate-900">
                                                        {typeof slide.flashcard_index === "number" ? slide.flashcard_index + 1 : EMPTY_VALUE}
                                                      </td>
                                                      <td className="px-4 py-3 align-top">{formatPercent(slide.accuracy_score)}</td>
                                                      <td className="px-4 py-3 align-top">
                                                        {typeof slide.reading_speed_wpm === "number"
                                                          ? getReadingSpeedLabel(slide.reading_speed_wpm)
                                                          : EMPTY_VALUE}
                                                      </td>
                                                      <td className="px-4 py-3 align-top font-semibold text-[#013300]">
                                                        {formatSlideAverage(slide)}
                                                      </td>
                                                      <td className="px-4 py-3 leading-6 text-slate-600">{slideFeedback}</td>
                                                    </tr>
                                                  );
                                                })
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>

                                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <NoteCard label="AI Remarks" value={session.ai_remarks?.trim() || "No AI remarks available."} />
                                        <NoteCard label="Teacher Remarks" value={session.teacher_notes?.trim() || "No teacher remarks available."} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </section>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* Updated Schedule Section with Calendar */}
                <div ref={attendanceSectionRef} className="rounded-2xl border border-white/75 bg-white/55 p-6 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur-lg">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Schedule Cards */}
                    <div>
                      <TertiaryHeader title="Weekly Schedule" />
                      <div className="mt-4 space-y-3">
                        {scheduleEntries.map((item) => (
                          <ScheduleCard
                            key={`${item.day}-${item.subject}`}
                            day={item.day}
                            subject={item.subject}
                            time={item.timeRange}
                            isToday={item.day === currentDay}
                          />
                        ))}
                      </div>
                      <div className="mt-4 text-sm text-gray-600 space-y-1">
                        <p className="font-medium">Please ensure your child attends all remedial sessions.</p>
                        <p className="italic">Siguraduhin na dumadalo ang inyong anak sa lahat ng remedial sessions.</p>
                      </div>
                    </div>

                    {/* Attendance Calendar */}
                    <AttendanceCalendar attendanceRecords={attendanceRecords} attendanceRate={attendanceRate} />
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


