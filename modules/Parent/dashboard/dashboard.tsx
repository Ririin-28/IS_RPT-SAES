"use client";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { ReactElement, RefObject } from "react";
import Header from "@/components/Parent/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";

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
      bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg
      flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px]
      transition-transform duration-200 hover:scale-105
      sm:p-6 sm:min-w-[180px] sm:min-h-[120px]
      lg:p-7
      ${className}
    `;

  const content = (
    <>
      <div className="flex flex-row items-center">
        <span className="text-4xl font-extrabold text-[#013300] drop-shadow sm:text-5xl">{value}</span>
        {icon && <span className="ml-1 sm:ml-2">{icon}</span>}
      </div>
      <div className="text-green-900 text-sm font-semibold mt-1 tracking-wide sm:text-base sm:mt-2">{label}</div>
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
      className={`bg-white p-4 rounded-lg shadow flex justify-between items-center border border-gray-200 ${
        isToday ? "border-gray-300 bg-green-50" : ""
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
  attendance: number;
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
};

type ParentDashboardState = {
  isLoading: boolean;
  error: string | null;
  parent: ParentInfo | null;
  child: ChildProfile | null;
  children: ChildProfile[];
  attendance: AttendanceSummary | null;
  schedule: ScheduleEntry[];
};

type NotificationType = {
  id: string;
  title: string;
  message: string;
  date: string;
  isRead: boolean;
  childName: string;
};

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
        ? "bg-green-100 text-green-800 border border-green-200"
        : "bg-red-100 text-red-800 border border-red-200";
    } else if (isWeekend) {
      statusClass = "bg-gray-50 text-gray-400";
    }

    dayCells.push(
      <div
        key={day}
        className={`h-12 flex items-center justify-center rounded text-sm font-medium border border-gray-100 ${statusClass} ${
          isToday ? "ring-1 ring-gray-300" : ""
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
          <div className="w-3 h-3 bg-green-100 rounded border border-green-200" />
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

function NotificationCard() {
  const [isTranslated, setIsTranslated] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const profile = useMemo(() => getStoredUserProfile(), []);

  const formatChildName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    const first = parts[0];
    const last = parts[parts.length - 1];
    const middle = parts.slice(1, -1).join(" ").trim();
    const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
    return [first, middleInitial, last].filter(Boolean).join(" ");
  };

  const formatDate = (dateString: string) => {
    try {
      const [day, month, year] = dateString.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      const monthNames = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
      return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    } catch {
      return dateString;
    }
  };

  const notification: NotificationType = {
    id: "1",
    title: "Notifications",
    message: "Your child, Alon Luan Nadura Ruedas, was marked absent on",
    date: "01-06-2026",
    isRead: false,
    childName: formatChildName("Alon Luan Nadura Ruedas"),
  };

  const storageKey = useMemo(() => {
    const userId = profile?.userId ?? "unknown";
    return `parentNotificationDismissed:${userId}`;
  }, [profile?.userId]);

  const notificationSignature = useMemo(() => {
    return [notification.childName, notification.message, notification.date].map(String).join("|");
  }, [notification.childName, notification.message, notification.date]);

  useEffect(() => {
    if (notification.isRead) {
      setIsClosed(true);
      return;
    }
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === notificationSignature) {
        setIsClosed(true);
      }
    } catch {
      // Ignore storage access errors (e.g., private mode)
    }
  }, [notification.isRead, notificationSignature, storageKey]);

  const handleClose = useCallback(() => {
    setIsClosed(true);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, notificationSignature);
    } catch {
      // Ignore storage access errors (e.g., private mode)
    }
  }, [notificationSignature, storageKey]);

  const englishText = {
    close: "Close",
    title: "Notifications",
    message: `Your child, ${notification.childName}, was marked absent on`,
    date: formatDate(notification.date),
  };

  const tagalogText = {
    close: "Isara",
    title: "Mga Paalala",
    message: `Ang iyong anak na si ${notification.childName}, ay minarkahang liban noong`,
    date: formatDate(notification.date),
  };

  const text = isTranslated ? tagalogText : englishText;

  if (isClosed) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200">
          <h3 className="font-bold text-red-800">{text.title}</h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 font-bold text-lg"
            aria-label={text.close}
          >
            ×
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.196 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-gray-800 mb-2">
                {text.message} <span className="font-semibold">{text.date}</span>.
              </p>
              <div className="text-xs text-gray-500 mt-1">
                {isTranslated ? "Nai-post noong Enero 25, 2026" : "Posted on January 25, 2026"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={() => setIsTranslated(!isTranslated)}
              className="px-3 py-1.5 text-sm bg-gradient-to-r from-green-50 to-green-100 text-green-800 font-medium rounded-lg hover:from-green-100 hover:to-green-200 transition-all duration-200 border border-green-200"
            >
              {isTranslated ? "Translate to English" : "Isalin sa Tagalog"}
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-1.5 text-sm bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              {text.close}
            </button>
          </div>
        </div>
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
    green: "bg-gradient-to-br from-green-50 to-green-100 border border-gray-200",
    blue: "bg-gradient-to-br from-blue-50 to-blue-100 border border-gray-200",
    orange: "bg-gradient-to-br from-orange-50 to-orange-100 border border-gray-200",
    yellow: "bg-gradient-to-br from-yellow-50 to-yellow-100 border border-gray-200"
  };

  return (
    <div className={`p-4 rounded-xl ${colorClasses[color]} shadow-sm`}>
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
  attendance: 0,
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

const FALLBACK_ATTENDANCE_RECORDS: AttendanceRecord[] = [];

const FALLBACK_ATTENDANCE_SUMMARY: AttendanceSummary = {
  records: [],
  totalSessions: 0,
  presentSessions: 0,
  absentSessions: 0,
  attendanceRate: null,
};

const FALLBACK_SCHEDULE: ScheduleEntry[] = [];

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
        const response = await fetch(`/api/parent/dashboard?${query.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch (error) {
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
        });
      }
    };

    loadDashboard();

    return () => {
      controller.abort();
    };
  }, [selectedChildId]);

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

  const handleChildChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedChildId(event.target.value);
  }, []);

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

  useEffect(() => {
    if (subjects.length === 0) {
      return;
    }
    setSelectedSubject((current) => (subjects.includes(current) ? current : subjects[0]));
  }, [subjects]);

  const scheduleEntries = state.schedule.length > 0 ? state.schedule : FALLBACK_SCHEDULE;

  const currentProgress: SubjectProgress =
    currentChild.progressDetails[selectedSubject] ?? currentChild.progressDetails.English;

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <NotificationCard />
      {/*---------------------------------Main Content---------------------------------*/}
      <div className="w-full pt-16 flex flex-col overflow-hidden">
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
          <div className="p-4 h-full sm:p-5 md:p-6">
            {/*---------------------------------Main Container---------------------------------*/}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 w-full h-full min-h-[380px] overflow-y-auto p-4 sm:p-5 md:p-6">
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
              <div className="bg-[#E9FDF2] rounded-xl shadow-lg p-6 mb-8 min-h-[160px] flex flex-col gap-6 md:flex-row md:items-start md:px-8">

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

              <hr className="border-gray-300 mb-6" />

              {/* Overview Cards Section */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <SecondaryHeader title="Child Performance" />
              </div>
              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 sm:gap-5 sm:mb-7 lg:grid-cols-4 lg:gap-6 lg:mb-8">
                <OverviewCard
                  value={`${currentChild.attendance}%`}
                  label="Attendance Rate"
                  icon={
                    <svg width="38" height="38" fill="none" viewBox="0 0 24 24">
                      <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

              <hr className="border-gray-300 mb-6" />

              {/* Remedial Subjects Section */}
              <div className="space-y-8">
                <div ref={progressSectionRef} className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                  <TertiaryHeader title="Learning Progress" />
                  
                  {/* Subject Buttons */}
                  <div className="flex flex-wrap gap-4 mt-6 mb-8">
                    {subjects.map((subject) => {
                      const isActive = selectedSubject === subject;
                      return (
                        <UtilityButton
                          key={subject}
                          onClick={() => handleSubjectCardClick(subject)}
                          className={`transition-all duration-200 ${isActive ? 'shadow-lg' : '!bg-white !text-[#013300] border-[#013300] hover:!bg-green-50 hover:!text-[#013300]'}`}
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
                      Your child's progress in {selectedSubject} is guided by {currentProgress.teacher}
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
                      <h4 className="font-bold text-gray-800">Teacher's Comment</h4>
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">
                        {currentProgress.teacherComments}
                      </p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-green-700">
                        — {currentProgress.teacher}
                      </p>
                    </div>

                  </div>
                </div>

                {/* Updated Schedule Section with Calendar */}
                <div ref={attendanceSectionRef} className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
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