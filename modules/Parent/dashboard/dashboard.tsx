"use client";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { ReactElement, RefObject } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ParentSidebar from "@/components/Parent/Sidebar";
import BaseModal, { ModalSection } from "@/components/Common/Modals/BaseModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { composeRuleBasedSlideFeedbackParagraph, getReadingSpeedLabel } from "@/lib/performance/insights";

const SUPPORTED_SUBJECTS = ["English", "Filipino", "Math"] as const;
const INITIAL_TIMELINE_ENTRY_COUNT = 8;
const WEEKDAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function formatChildName(firstName: string, middleName?: string | null, lastName?: string | null) {
  const safeFirst = typeof firstName === "string" ? firstName.trim() : "";
  const safeLast = typeof lastName === "string" ? lastName.trim() : "";
  const middleInitial = typeof middleName === "string" && middleName.trim().length > 0
    ? `${middleName.trim()[0].toUpperCase()}.`
    : "";

  const fullName = [safeFirst, middleInitial, safeLast].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return fullName.length > 0 ? fullName : "Student";
}

function HomeSubjectCell({
  label,
  value,
  muted = false,
  onClick,
}: {
  label: string;
  value: string;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full px-3 py-4 text-center transition",
        "hover:bg-white/80",
        muted
          ? "text-[#6B806D]"
          : "text-[#0C3B1F]",
      ].join(" ")}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#708672]">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-5 tracking-tight sm:text-base">{value}</p>
    </button>
  );
}

function SubjectSegmentedControl({
  subjects,
  selectedSubject,
  onSelect,
  className = "",
  disabled = false,
}: {
  subjects: readonly string[];
  selectedSubject: string;
  onSelect: (subject: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`w-full max-w-md rounded-[18px] border border-[#DCE6DD] bg-[#F7FAF7] p-1 ${className}`}>
      <div className="grid grid-cols-3 gap-1">
        {subjects.map((subject) => {
          const isActive = selectedSubject === subject;
          return (
            <button
              key={subject}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(subject)}
              className={`rounded-[14px] px-3 py-2 text-center text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isActive
                  ? "bg-[#0C3B1F] text-white shadow-sm"
                  : "text-[#5B705D] hover:bg-white hover:text-[#0C3B1F]"
              }`}
            >
              {subject}
            </button>
          );
        })}
      </div>
    </div>
  );
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
      className={`flex items-center justify-between gap-3 border-b border-[#E3EBE4] px-0 py-3 shadow-none lg:gap-4 lg:rounded-[20px] lg:border lg:p-4 lg:shadow-sm ${
        isToday
          ? "bg-transparent lg:border-[#C9E0CE] lg:bg-[#F3FAF4]"
          : "bg-transparent lg:border-[#E1E9E2] lg:bg-white/90"
      }`}
    >
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-[#0C3B1F] lg:text-base">{day}</h4>
        <p className="mt-1 text-xs text-[#5A6E5E] lg:text-sm">{subject}</p>
      </div>
      <div className="shrink-0 rounded-full border border-[#DCE7DD] bg-[#F7FAF7] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5C715F] lg:px-3 lg:py-1.5 lg:text-xs lg:tracking-[0.2em]">
        {time ?? "Pending"}
      </div>
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
  lrn: string | null;
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
  subjectValidation?: {
    subject: string | null;
    isTakingRemedial: boolean;
    message: string | null;
  } | null;
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
  subjectValidation: {
    subject: string | null;
    isTakingRemedial: boolean;
    message: string | null;
  } | null;
  selectedSubject: string | null;
  sessions: RemedialSessionTimelineItem[];
  assessments: StudentAssessmentRecord[];
};

type DashboardRequestParams = {
  userId: number;
  view: ParentDashboardView;
  studentId: string | null;
  subject: SupportedSubject;
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

const formatCompactDate = (value: string | Date | null | undefined) => {
  if (!value) return EMPTY_VALUE;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const getWeekdayIndex = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return WEEKDAY_ORDER.findIndex((day) => day.toLowerCase() === normalized);
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

const toDashboardState = (data: ParentDashboardResponse): ParentDashboardState => ({
  isLoading: false,
  error: null,
  parent: data.parent,
  children: data.children ?? [],
  child: data.child,
  attendance: data.attendance,
  schedule: data.schedule,
  subjectValidation: data.subjectValidation ?? null,
  selectedSubject: data.selectedSubject ?? null,
  sessions: Array.isArray(data.sessions) ? data.sessions : [],
  assessments: Array.isArray(data.assessments) ? data.assessments : [],
});

function InfoCard({ label, value, hint }: InfoCardProps) {
  return (
    <div className="border-b border-[#E3EBE4] px-0 py-3 shadow-none lg:rounded-[20px] lg:border lg:border-[#E1E8E2] lg:bg-white lg:px-4 lg:py-4 lg:shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#708672] lg:text-[11px] lg:tracking-[0.22em]">{label}</p>
      <p className="mt-1 text-sm font-semibold tracking-tight text-[#102A18] lg:mt-2 lg:text-base">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-5 text-[#617561] lg:mt-2 lg:text-xs">{hint}</p> : null}
    </div>
  );
}

function DetailChip({ label, value, emphasized = false }: DetailChipProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium",
        "lg:px-3 lg:py-1.5",
        emphasized
          ? "border-[#CFE2D2] bg-[#EEF7F0] text-[#0C3B1F]"
          : "border-[#DFE7E0] bg-white/90 text-[#566A59]",
      ].join(" ")}
    >
      <span className="text-[#748776]">{label}</span>
      <span className="ml-1 font-semibold">{value}</span>
    </span>
  );
}

const formatTimelineMonthLabel = (timestamp: number) => {
  if (!timestamp) {
    return "Undated Records";
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
};

function ProgressTimelineDetailModal({
  entry,
  onClose,
}: {
  entry: TimelineEntry | null;
  onClose: () => void;
}) {
  if (!entry) {
    return null;
  }

  if (entry.kind === "assessment") {
    const assessment = entry.assessment;
    const title = (assessment.title ?? "").trim() || "Assessment";
    const description = (assessment.description ?? "").trim();
    const phonemicLabel = (assessment.phonemic_level ?? "").trim() || EMPTY_VALUE;
    const statusLabel = formatStatusLabel(assessment.status);
    const score = formatAssessmentScore(assessment);

    return (
      <BaseModal
        show
        onClose={onClose}
        title="Assessment Details"
        maxWidth="lg"
        footer={(
          <SecondaryButton type="button" onClick={onClose} className="px-5 py-2.5">
            Close
          </SecondaryButton>
        )}
      >
        <ModalSection title="Overview">
          <div className="space-y-3">
            <div>
              <p className="text-lg font-semibold text-[#102A18]">{title}</p>
              <p className="mt-1 text-sm text-[#617561]">{formatDate(assessment.submitted_at)}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#DFE7E0] bg-[#F9FCF9] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#708672]">Score</p>
                <p className="mt-2 text-base font-semibold text-[#102A18]">{score.value}</p>
                {score.hint ? <p className="mt-1 text-xs text-[#617561]">{score.hint}</p> : null}
              </div>
              <div className="rounded-xl border border-[#DFE7E0] bg-[#F9FCF9] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#708672]">Status</p>
                <p className="mt-2 text-base font-semibold text-[#102A18]">{statusLabel}</p>
              </div>
              <div className="rounded-xl border border-[#DFE7E0] bg-[#F9FCF9] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#708672]">Phonemic</p>
                <p className="mt-2 text-base font-semibold text-[#102A18]">{phonemicLabel}</p>
              </div>
            </div>
          </div>
        </ModalSection>

        {description ? (
          <ModalSection title="Description">
            <p className="text-sm leading-7 text-[#465A4A]">{description}</p>
          </ModalSection>
        ) : null}
      </BaseModal>
    );
  }

  const { session, summary } = entry;

  return (
    <BaseModal
      show
      onClose={onClose}
      title="Session Details"
      maxWidth="3xl"
      footer={(
        <SecondaryButton type="button" onClick={onClose} className="px-5 py-2.5">
          Close
        </SecondaryButton>
      )}
    >
      <ModalSection title="Overview">
        <div className="space-y-3">
          <div>
            <p className="text-lg font-semibold text-[#102A18]">{summary.titleLabel || "Remedial Session"}</p>
            <p className="mt-1 text-sm text-[#617561]">{summary.dateLabel}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-0 rounded-lg border border-[#DFE7E0] bg-[#F9FCF9] px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#708672]">Phonemic</p>
              <p className="mt-1.5 text-sm font-semibold text-[#102A18] lg:text-base">{summary.phonemicLabel}</p>
            </div>
            <div className="min-w-0 rounded-lg border border-[#DFE7E0] bg-[#F9FCF9] px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#708672]">Average</p>
              <p className="mt-1.5 text-sm font-semibold text-[#102A18] lg:text-base">{summary.overallLabel}</p>
            </div>
            <div className="min-w-0 rounded-lg border border-[#DFE7E0] bg-[#F9FCF9] px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#708672]">Slides</p>
              <p className="mt-1.5 text-sm font-semibold text-[#102A18] lg:text-base">{summary.slideCountLabel}</p>
            </div>
          </div>
        </div>
      </ModalSection>

      <ModalSection title="Per-Slide Feedback">
        {session.slides.length === 0 ? (
          <p className="text-sm text-[#617561]">No slides recorded for this session.</p>
        ) : (
          <div className="space-y-3">
            {session.slides.map((slide) => {
              const storedFeedback = (slide.reading_tutor_feedback ?? "").trim();
              const slideFeedback =
                storedFeedback ||
                composeRuleBasedSlideFeedbackParagraph({
                  accuracyScore: slide.accuracy_score ?? null,
                  readingSpeedWpm: slide.reading_speed_wpm ?? null,
                  slideAverage: slide.slide_average ?? null,
                });

              return (
                <div
                  key={String(slide.performance_id ?? `${entry.key}-${slide.flashcard_index}`)}
                  className="rounded-lg border border-[#DFE7E0] bg-white px-3 py-3"
                >
                  <p className="text-sm font-semibold text-[#102A18]">
                    Slide {typeof slide.flashcard_index === "number" ? slide.flashcard_index + 1 : EMPTY_VALUE}
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="min-w-0 rounded-lg border border-[#DFE7E0] bg-[#F9FCF9] px-2.5 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#708672]">Accuracy</p>
                      <p className="mt-1 text-xs font-semibold text-[#102A18] lg:text-sm">{formatPercent(slide.accuracy_score)}</p>
                    </div>
                    <div className="min-w-0 rounded-lg border border-[#DFE7E0] bg-[#F9FCF9] px-2.5 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#708672]">Speed</p>
                      <p className="mt-1 text-xs font-semibold leading-4 text-[#102A18] lg:text-sm">
                        {typeof slide.reading_speed_wpm === "number" ? getReadingSpeedLabel(slide.reading_speed_wpm) : EMPTY_VALUE}
                      </p>
                    </div>
                    <div className="min-w-0 rounded-lg border border-[#CFE2D2] bg-[#EEF7F0] px-2.5 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6C7F6F]">Average</p>
                      <p className="mt-1 text-xs font-semibold text-[#0C3B1F] lg:text-sm">{formatSlideAverage(slide)}</p>
                    </div>
                  </div>

                  <div className="mt-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#708672]">Feedback</p>
                    <p className="mt-1.5 text-sm leading-6 text-[#617561]">{slideFeedback}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ModalSection>

      <ModalSection title="AI Remarks">
        <p className="text-sm leading-7 text-[#465A4A]">{session.ai_remarks?.trim() || "No AI remarks available."}</p>
      </ModalSection>

      <ModalSection title="Teacher Remarks">
        <p className="text-sm leading-7 text-[#465A4A]">{session.teacher_notes?.trim() || "No teacher remarks available."}</p>
      </ModalSection>
    </BaseModal>
  );
}

function AttendanceCalendar({ attendanceRecords }: AttendanceCalendarProps) {
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

    let statusClass = "bg-[#F7F9F7] text-[#9AAD9D]"; // default: no record
    if (summary?.hasRecord) {
      statusClass = summary.present
        ? "border border-[#D3E5D6] bg-[#EEF8F1] text-[#0C6932]"
        : "border border-[#F0D3D3] bg-[#FDF1F1] text-[#A53A3A]";
    } else if (isWeekend) {
      statusClass = "bg-[#F7F9F7] text-[#9AAD9D]";
    }

    dayCells.push(
      <div
        key={day}
        className={`flex h-12 items-center justify-center rounded-2xl border border-[#EDF2EE] text-sm font-medium ${statusClass} ${isToday ? "ring-2 ring-[#C9DBCC]" : ""
          }`}
      >
        {day}
      </div>,
    );
  }

  return (
    <div className="border-t border-[#E3EBE4] py-4 shadow-none lg:rounded-[24px] lg:border lg:border-[#DFE7E0] lg:bg-white lg:p-6 lg:shadow-sm">
      <div className="mb-4 flex items-center justify-between lg:mb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6E8471] lg:text-[11px] lg:tracking-[0.24em]">Attendance</p>
          <h4 className="mt-1 text-base font-semibold text-[#0C3B1F] lg:text-lg">Monthly Attendance</h4>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigateMonth("prev")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DFE7E0] bg-white text-lg font-semibold text-[#0C3B1F] transition hover:bg-[#F3F7F3]"
            type="button"
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="font-semibold text-[#334C3A]">
            {months[currentMonth]} {currentYear}
          </span>
          <button
            onClick={() => navigateMonth("next")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DFE7E0] bg-white text-lg font-semibold text-[#0C3B1F] transition hover:bg-[#F3F7F3]"
            type="button"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-7 gap-1.5 lg:mb-6 lg:gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="py-1 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7B8F80]">
            {day}
          </div>
        ))}
        {dayCells}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-[11px] lg:mb-6 lg:gap-4 lg:text-xs">
        <div className="flex items-center space-x-1">
          <div className="h-3 w-3 rounded-full border border-[#D3E5D6] bg-[#EEF8F1]" />
          <span className="font-medium text-[#546958]">Present</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="h-3 w-3 rounded-full border border-[#F0D3D3] bg-[#FDF1F1]" />
          <span className="font-medium text-[#546958]">Absent</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="h-3 w-3 rounded-full border border-[#E6ECE6] bg-[#F7F9F7]" />
          <span className="font-medium text-[#546958]">No record</span>
        </div>
      </div>
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
  lrn: null,
  grade: null,
  section: null,
  age: 0,
  teacher: "--",
  attendance: null,
  currentLevel: {
    English: "--",
    Filipino: "--",
    Math: "--",
  },
  progressDetails: {
    English: {
      currentLevel: "--",
      startingLevel: "--",
      improvement: "--",
      teacherComments: "--",
      aiRecommendation: "--",
      teacher: "--",
    },
    Filipino: {
      currentLevel: "--",
      startingLevel: "--",
      improvement: "--",
      teacherComments: "--",
      aiRecommendation: "--",
      teacher: "--",
    },
    Math: {
      currentLevel: "--",
      startingLevel: "--",
      improvement: "--",
      teacherComments: "--",
      aiRecommendation: "--",
      teacher: "--",
    },
  },
};

const FALLBACK_SCHEDULE: ScheduleEntry[] = [];
const FALLBACK_SESSIONS: RemedialSessionTimelineItem[] = [];
const FALLBACK_ASSESSMENTS: StudentAssessmentRecord[] = [];
const EMPTY_ATTENDANCE_SUMMARY: AttendanceSummary = {
  records: [],
  totalSessions: 0,
  presentSessions: 0,
  absentSessions: 0,
  attendanceRate: null,
};

const isSupportedSubject = (subject: string): subject is SupportedSubject =>
  SUPPORTED_SUBJECTS.includes(subject as SupportedSubject);

export type ParentDashboardView = "home" | "progress" | "attendance";

type ParentDashboardProps = {
  view?: ParentDashboardView;
};

export default function ParentDashboard({ view = "home" }: ParentDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSubject, setSelectedSubject] = useState<SupportedSubject>("English");
  const [state, setState] = useState<ParentDashboardState>({
    isLoading: true,
    error: null,
    parent: null,
    child: null,
    children: [],
    attendance: null,
    schedule: [],
    subjectValidation: null,
    selectedSubject: null,
    sessions: [],
    assessments: [],
  });
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const progressSectionRef = useRef<HTMLDivElement | null>(null);
  const attendanceSectionRef = useRef<HTMLDivElement | null>(null);
  const dashboardCacheRef = useRef<Map<string, ParentDashboardResponse>>(new Map());
  const dashboardRequestRef = useRef<Map<string, Promise<ParentDashboardResponse>>>(new Map());

  const scrollToSection = useCallback((sectionRef: RefObject<HTMLDivElement | null>) => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const getSignedInParentUserId = useCallback(() => {
    const profile = getStoredUserProfile();
    const userId = Number(profile?.userId);
    return Number.isFinite(userId) ? userId : null;
  }, []);

  const createDashboardCacheKey = useCallback(
    ({ userId, view: requestView, studentId, subject }: DashboardRequestParams) =>
      `${requestView}:${userId}:${studentId ?? "default"}:${subject}`,
    [],
  );

  const storeDashboardResponse = useCallback(
    (request: DashboardRequestParams, data: ParentDashboardResponse) => {
      dashboardCacheRef.current.set(createDashboardCacheKey(request), data);

      const resolvedStudentId = data.child?.studentId ?? null;
      if (!request.studentId && resolvedStudentId) {
        dashboardCacheRef.current.set(
          createDashboardCacheKey({
            ...request,
            studentId: resolvedStudentId,
          }),
          data,
        );
      }
    },
    [createDashboardCacheKey],
  );

  const fetchDashboardData = useCallback(async (request: DashboardRequestParams) => {
    const query = new URLSearchParams({
      userId: String(request.userId),
      view: request.view,
      subject: request.subject,
    });

    if (request.studentId) {
      query.set("studentId", request.studentId);
    }

    const response = await fetch(`/api/parent/dashboard?${query.toString()}`, {
      method: "GET",
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

    return payload as ParentDashboardResponse;
  }, []);

  const getCachedDashboardState = useCallback(
    (request: DashboardRequestParams) => {
      const cached = dashboardCacheRef.current.get(createDashboardCacheKey(request));
      return cached ? toDashboardState(cached) : null;
    },
    [createDashboardCacheKey],
  );

  const requestDashboardData = useCallback(
    (request: DashboardRequestParams) => {
      const cacheKey = createDashboardCacheKey(request);
      const cached = dashboardCacheRef.current.get(cacheKey);
      if (cached) {
        return Promise.resolve(cached);
      }

      const existingRequest = dashboardRequestRef.current.get(cacheKey);
      if (existingRequest) {
        return existingRequest;
      }

      const nextRequest = fetchDashboardData(request)
        .then((data) => {
          storeDashboardResponse(request, data);
          return data;
        })
        .finally(() => {
          dashboardRequestRef.current.delete(cacheKey);
        });

      dashboardRequestRef.current.set(cacheKey, nextRequest);
      return nextRequest;
    },
    [createDashboardCacheKey, fetchDashboardData, storeDashboardResponse],
  );

  const hydrateDashboardFromCache = useCallback(
    (subject: SupportedSubject) => {
      if (view !== "attendance" && view !== "progress") {
        return false;
      }

      const userId = getSignedInParentUserId();
      if (userId === null) {
        return false;
      }

      const cachedState = getCachedDashboardState({
        userId,
        view,
        studentId: selectedChildId,
        subject,
      });

      if (!cachedState) {
        return false;
      }

      setState(cachedState);
      return true;
    },
    [getCachedDashboardState, getSignedInParentUserId, selectedChildId, view],
  );

  useEffect(() => {
    const userId = getSignedInParentUserId();

    if (userId === null) {
      setState((previous) => ({
        ...previous,
        isLoading: false,
        error: "Unable to determine the signed-in parent. Please sign in again.",
      }));
      return;
    }

    let cancelled = false;

    const loadDashboard = async () => {
      const request: DashboardRequestParams = {
        userId,
        view,
        studentId: selectedChildId,
        subject: selectedSubject,
      };

      const cachedState = getCachedDashboardState(request);
      if (cachedState) {
        setState(cachedState);
        return;
      }

      setState((previous) => ({ ...previous, isLoading: true, error: null }));

      try {
        const data = await requestDashboardData(request);
        if (cancelled) {
          return;
        }
        setState(toDashboardState(data));
      } catch (error) {
        if (cancelled) {
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
          subjectValidation: null,
          selectedSubject: null,
          sessions: [],
          assessments: [],
        });
      }
    };

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [getCachedDashboardState, getSignedInParentUserId, requestDashboardData, selectedChildId, selectedSubject, view]);

  useEffect(() => {
    if (view !== "attendance" && view !== "progress") {
      return;
    }

    const userId = getSignedInParentUserId();
    if (userId === null) {
      return;
    }

    for (const subject of SUPPORTED_SUBJECTS) {
      if (subject === selectedSubject) {
        continue;
      }

      const request: DashboardRequestParams = {
        userId,
        view,
        studentId: selectedChildId,
        subject,
      };

      void requestDashboardData(request).catch(() => undefined);
    }
  }, [getSignedInParentUserId, requestDashboardData, selectedChildId, selectedSubject, view]);

  const handleSubjectCardClick = useCallback(
    (subject: SupportedSubject) => {
      if (view === "home") {
        router.push(`/Parent/progress?subject=${encodeURIComponent(subject)}`);
        return;
      }
      hydrateDashboardFromCache(subject);
      setSelectedSubject(subject);
      scrollToSection(progressSectionRef);
    },
    [hydrateDashboardFromCache, router, scrollToSection, view],
  );

  const handleAttendanceCardClick = useCallback(() => {
    if (view === "home" || view === "progress") {
      router.push("/Parent/attendance");
      return;
    }
    scrollToSection(attendanceSectionRef);
  }, [router, scrollToSection, view]);

  // Get current day for highlighting
  const getCurrentDay = () => {
    return WEEKDAY_ORDER[new Date().getDay()];
  };

  const currentDay = getCurrentDay();
  const requestedChildId = selectedChildId ?? state.child?.studentId ?? null;
  const hasFreshSelectedChild = !requestedChildId || state.child?.studentId === requestedChildId;
  const isSubjectSelectionPending =
    (view === "attendance" || view === "progress") &&
    !state.error &&
    (!hasFreshSelectedChild || state.selectedSubject !== selectedSubject || state.isLoading);
  const isAttendanceSelectionPending =
    view === "attendance" && isSubjectSelectionPending;
  const isProgressSelectionPending = view === "progress" && isSubjectSelectionPending;
  const attendanceSummary: AttendanceSummary =
    isAttendanceSelectionPending ? EMPTY_ATTENDANCE_SUMMARY : state.attendance ?? EMPTY_ATTENDANCE_SUMMARY;

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
      lrn: state.child.lrn ?? FALLBACK_CHILD_VIEW.lrn,
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
  const remedialSubjects = useMemo<SupportedSubject[]>(
    () => ((state.child?.subjects ?? []).filter(isSupportedSubject)),
    [state.child?.subjects],
  );

  const childOptions = state.children.length > 0 ? state.children : state.child ? [state.child] : [];

  const attendanceRate = isAttendanceSelectionPending ? null : attendanceSummary.attendanceRate ?? currentChild.attendance;
  const isSelectedSubjectRemedial = isSubjectSelectionPending ? true : state.subjectValidation?.isTakingRemedial ?? true;
  const selectedSubjectValidationMessage = isSubjectSelectionPending ? null : state.subjectValidation?.message ?? null;

  useEffect(() => {
    if (view === "attendance" || view === "progress") {
      return;
    }
    if (subjects.length === 0) {
      return;
    }
    setSelectedSubject((current) => (subjects.includes(current) ? current : subjects[0]));
  }, [subjects, view]);

  useEffect(() => {
    if (view !== "progress") {
      return;
    }
    const requestedSubject = searchParams.get("subject");
    if (requestedSubject && isSupportedSubject(requestedSubject)) {
      setSelectedSubject(requestedSubject);
    }
  }, [searchParams, view]);

  const scheduleEntries =
    isAttendanceSelectionPending ? FALLBACK_SCHEDULE : state.schedule.length > 0 ? state.schedule : FALLBACK_SCHEDULE;
  const dashboardStudentName =
    state.child
      ? formatChildName(state.child.firstName, state.child.middleName, state.child.lastName)
      : "--";

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
  const [selectedTimelineEntry, setSelectedTimelineEntry] = useState<TimelineEntry | null>(null);
  const [showAllTimelineEntries, setShowAllTimelineEntries] = useState(false);

  useEffect(() => {
    setSelectedTimelineEntry(null);
    setShowAllTimelineEntries(false);
  }, [selectedSubject, selectedChildId, view]);

  const assessmentCount = assessments.length;
  const sessionCount = sessions.length;
  const orderedHomeScheduleEntries = useMemo(() => {
    const currentDayIndex = getWeekdayIndex(currentDay);

    return [...scheduleEntries].sort((left, right) => {
      const leftIndex = getWeekdayIndex(left.day);
      const rightIndex = getWeekdayIndex(right.day);
      const leftOffset = leftIndex >= 0 && currentDayIndex >= 0 ? (leftIndex - currentDayIndex + 7) % 7 : 99;
      const rightOffset = rightIndex >= 0 && currentDayIndex >= 0 ? (rightIndex - currentDayIndex + 7) % 7 : 99;

      if (leftOffset !== rightOffset) {
        return leftOffset - rightOffset;
      }

      return (left.timeRange ?? "").localeCompare(right.timeRange ?? "");
    });
  }, [currentDay, scheduleEntries]);
  const homeSchedulePreview = orderedHomeScheduleEntries.slice(0, 3);
  const homeFeaturedSchedule = orderedHomeScheduleEntries[0] ?? null;
  const isHomeFeaturedScheduleToday =
    homeFeaturedSchedule !== null && getWeekdayIndex(homeFeaturedSchedule.day) === getWeekdayIndex(currentDay);
  const visibleTimelineEntries = useMemo(
    () => (showAllTimelineEntries ? timelineEntries : timelineEntries.slice(0, INITIAL_TIMELINE_ENTRY_COUNT)),
    [showAllTimelineEntries, timelineEntries],
  );
  const groupedTimelineEntries = useMemo(() => {
    const groups: Array<{ label: string; entries: TimelineEntry[] }> = [];

    for (const entry of visibleTimelineEntries) {
      const label = formatTimelineMonthLabel(entry.timestamp);
      const previousGroup = groups[groups.length - 1];

      if (!previousGroup || previousGroup.label !== label) {
        groups.push({ label, entries: [entry] });
        continue;
      }

      previousGroup.entries.push(entry);
    }

    return groups;
  }, [visibleTimelineEntries]);
  const hiddenTimelineEntryCount = Math.max(0, timelineEntries.length - INITIAL_TIMELINE_ENTRY_COUNT);
  const attendanceDaysSoFar =
    isAttendanceSelectionPending || !isSelectedSubjectRemedial
      ? null
      : attendanceSummary.presentSessions + attendanceSummary.absentSessions;
  const attendanceSummaryCards: InfoCardProps[] = [
    { label: "Present", value: isAttendanceSelectionPending ? "Loading..." : isSelectedSubjectRemedial ? formatInteger(attendanceSummary.presentSessions) : EMPTY_VALUE },
    {
      label: "Attendance Rate",
      value:
        isAttendanceSelectionPending
          ? "Loading..."
          : isSelectedSubjectRemedial && typeof attendanceDaysSoFar === "number" && attendanceDaysSoFar > 0
            ? `${formatInteger(attendanceSummary.presentSessions)}/${formatInteger(attendanceDaysSoFar)}${
                attendanceRate != null ? ` (${attendanceRate}%)` : ""
              }`
            : EMPTY_VALUE,
    },
    { label: "Absent", value: isAttendanceSelectionPending ? "Loading..." : isSelectedSubjectRemedial ? formatInteger(attendanceSummary.absentSessions) : EMPTY_VALUE },
    { label: "Total Days", value: isAttendanceSelectionPending ? "Loading..." : isSelectedSubjectRemedial ? formatInteger(attendanceSummary.totalSessions) : EMPTY_VALUE },
  ];
  const dashboardTitle =
    view === "progress" ? "Progress Overview" : view === "attendance" ? "Attendance Overview" : "Home Overview";
  const dashboardDescription = "";
  const dashboardLoadingTitle =
    view === "attendance"
      ? "Loading attendance"
      : view === "progress"
        ? "Loading progress"
        : "Loading home";
  const dashboardLoadingMessage =
    view === "attendance"
      ? "Please wait while the attendance records are being loaded."
      : view === "progress"
        ? "Please wait while the progress details are being loaded."
        : "Please wait while the home overview is being loaded.";

  if (state.isLoading && !state.error) {
    return (
      <div className="relative h-dvh bg-white lg:flex lg:h-screen lg:overflow-hidden">
        <ParentSidebar />
        <div className="relative z-10 flex-1 overflow-hidden lg:flex lg:flex-col lg:overflow-hidden">
          <main className="flex-1 overflow-hidden">
            <div className="relative mx-auto h-[calc(100dvh-4.75rem)] w-full max-w-5xl px-3 pb-2 pt-3 sm:px-4 sm:pb-3 sm:pt-4 lg:h-full lg:max-w-7xl lg:p-6">
              <div className="h-full overflow-y-auto rounded-[24px] border border-[#DCE6DD] bg-white p-4 shadow-sm lg:p-8">
                <div className="flex min-h-full items-center justify-center px-6 py-10 text-center">
                  <div className="max-w-sm">
                    <div className="mx-auto h-10 w-10 rounded-full border-4 border-[#D7E9DB] border-t-[#0C6932] animate-spin" />
                    <p className="mt-4 text-base font-semibold leading-8 text-[#0C3B1F]">{dashboardLoadingTitle}</p>
                    <p className="mt-1 text-sm leading-6 text-[#58705D]">{dashboardLoadingMessage}</p>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh bg-white lg:flex lg:h-screen lg:overflow-hidden">
      <ParentSidebar />
      {/*---------------------------------Main Content---------------------------------*/}
      <div className="relative z-10 flex-1 overflow-hidden lg:flex lg:flex-col lg:overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <div className="relative mx-auto h-[calc(100dvh-4.75rem)] w-full max-w-5xl px-3 pb-2 pt-3 sm:px-4 sm:pb-3 sm:pt-4 lg:h-full lg:max-w-7xl lg:p-6">
            {/*---------------------------------Main Container---------------------------------*/}
            <div className="relative h-full overflow-y-auto rounded-[24px] border border-[#DCE6DD] bg-white p-4 shadow-sm lg:p-8">
              {state.error && (
                <div className="mb-6 rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  {state.error}
                </div>
              )}

              {childOptions.length > 1 && (
                <div className="mb-4 flex justify-stretch lg:mb-6 lg:justify-end">
                  <div className="w-full lg:max-w-sm">
                    <label
                      htmlFor="parent-student-switcher"
                      className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6A816F]"
                    >
                      Student
                    </label>
                    <select
                      id="parent-student-switcher"
                      value={selectedChildId ?? currentChild.studentId}
                      onChange={(event) => setSelectedChildId(event.target.value)}
                      className="mt-2 w-full rounded-[16px] border border-[#DCE6DD] bg-white px-4 py-3 text-sm font-medium text-[#0C3B1F] outline-none transition focus:border-[#BCD2C1]"
                    >
                      {childOptions.map((child) => (
                        <option key={child.studentId} value={child.studentId}>
                          {formatChildName(child.firstName, child.middleName, child.lastName)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Child Details Section */}
              <div className="relative mb-4 overflow-hidden border-b border-[#E3EBE4] pb-5 lg:mb-10 lg:rounded-[24px] lg:border lg:border-[#DDE7DE] lg:bg-[#F9FCF9] lg:p-8 lg:shadow-sm">
                <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
                  <div>
                    {view === "home" ? (
                      <>
                        <div className="rounded-[20px] border border-[#DDE7DE] bg-white px-4 py-4 lg:px-5 lg:py-5">
                          <div className="border-b border-[#E3EBE4] pb-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6A816F]">Full Name</p>
                            <p className="mt-2 text-lg font-semibold leading-7 tracking-tight text-[#0C3B1F] lg:text-2xl">
                              {dashboardStudentName}
                            </p>
                          </div>

                          <div className="grid gap-3 pt-3 sm:grid-cols-3">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6A816F]">LRN</p>
                              <p className="mt-1 text-sm font-semibold leading-6 tracking-tight text-[#0C3B1F] lg:text-base">
                                {currentChild.lrn || EMPTY_VALUE}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6A816F]">Grade</p>
                              <p className="mt-1 text-sm font-semibold leading-6 tracking-tight text-[#0C3B1F] lg:text-base">
                                {currentChild.grade || EMPTY_VALUE}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6A816F]">Section</p>
                              <p className="mt-1 text-sm font-semibold leading-6 tracking-tight text-[#0C3B1F] lg:text-base">
                                {currentChild.section || EMPTY_VALUE}
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6A816F] lg:text-[11px] lg:tracking-[0.28em]">
                          {dashboardTitle}
                        </p>
                        <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#0C3B1F] lg:mt-2 lg:text-3xl">
                          {dashboardStudentName}
                        </h2>
                        {dashboardDescription ? (
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#55705B] lg:mt-3 lg:leading-7">
                            {dashboardDescription}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>

                  {view === "home" ? null : view === "attendance" ? (
                    <div className="w-full">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6A816F]">Subject</p>
                    <SubjectSegmentedControl
                      subjects={SUPPORTED_SUBJECTS}
                      selectedSubject={selectedSubject}
                      disabled={state.isLoading}
                      onSelect={(subject) => {
                        const nextSubject = subject as SupportedSubject;
                        hydrateDashboardFromCache(nextSubject);
                        setSelectedSubject(nextSubject);
                      }}
                    />
                  </div>
                  ) : view === "progress" ? null : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoCard label="Relationship" value={currentChild.relationship || EMPTY_VALUE} />
                      <InfoCard label="Student ID" value={currentChild.studentId || EMPTY_VALUE} />
                      <InfoCard label="Attendance" value={attendanceRate != null ? `${attendanceRate}%` : EMPTY_VALUE} />
                      <InfoCard label="Current Subject" value={selectedSubject || EMPTY_VALUE} />
                    </div>
                  )}
                </div>
              </div>

              {view === "home" && (
                <div className="space-y-4 lg:space-y-6">
                  <div className="overflow-hidden rounded-[20px] border border-[#DDE7DE] bg-white">
                    <div className="grid grid-cols-3 divide-x divide-[#E3EBE4]">
                      {SUPPORTED_SUBJECTS.map((subject) => {
                        const isTakingRemedial = remedialSubjects.includes(subject);

                        return (
                          <HomeSubjectCell
                            key={subject}
                            label={subject}
                            value={isTakingRemedial ? currentChild.currentLevel[subject] : "No remedial"}
                            muted={!isTakingRemedial}
                            onClick={() => handleSubjectCardClick(subject)}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={handleAttendanceCardClick}
                      className="w-full rounded-[20px] border border-[#DFE7E0] bg-white px-4 py-4 text-left transition hover:border-[#C9D9CC] hover:bg-[#FBFDFC] lg:rounded-[24px] lg:px-5 lg:py-5"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6A816F]">
                        {isHomeFeaturedScheduleToday ? "Today" : "Next Schedule"}
                      </p>
                      {homeFeaturedSchedule ? (
                        <>
                          <p className="mt-2 text-xl font-semibold tracking-tight text-[#0C3B1F] lg:text-2xl">
                            {homeFeaturedSchedule.subject}
                          </p>
                          <p className="mt-1 text-sm text-[#617561]">
                            {homeFeaturedSchedule.day}
                            {homeFeaturedSchedule.timeRange ? ` | ${homeFeaturedSchedule.timeRange}` : ""}
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-[#617561]">No remedial schedule recorded yet.</p>
                      )}
                    </button>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={handleAttendanceCardClick}
                      className="w-full rounded-[20px] border border-[#DFE7E0] bg-white px-4 py-4 text-left transition hover:border-[#C9D9CC] hover:bg-[#FBFDFC] lg:rounded-[24px] lg:px-5 lg:py-5"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6A816F]">This Week</p>
                      <div className="mt-3 space-y-2.5">
                        {homeSchedulePreview.length === 0 ? (
                          <p className="text-sm text-[#617561]">No remedial schedule recorded yet.</p>
                        ) : (
                          homeSchedulePreview.map((item) => (
                            <div
                              key={`${item.day}-${item.subject}-home`}
                              className="rounded-[16px] border border-[#E1E9E2] bg-[#F9FCF9] px-3 py-3"
                            >
                              <p className="text-sm font-semibold text-[#0C3B1F]">{item.subject}</p>
                              <p className="mt-1 text-xs text-[#708672]">
                                {item.day}
                                {item.timeRange ? ` | ${item.timeRange}` : ""}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {view === "attendance" && !isAttendanceSelectionPending && isSelectedSubjectRemedial ? (
                <div className="mb-4 grid grid-cols-2 gap-2 lg:mb-8 lg:gap-4 xl:grid-cols-4">
                  {attendanceSummaryCards.map((card) => (
                    <InfoCard key={card.label} label={card.label} value={card.value} hint={card.hint} />
                  ))}
                </div>
              ) : null}

              <div className="space-y-4 lg:space-y-10">
                {view === "progress" && (
                  <div ref={progressSectionRef} className="border-b border-[#E3EBE4] pb-5 lg:rounded-[24px] lg:border lg:border-[#DFE7E0] lg:bg-white lg:p-8 lg:shadow-sm">
                  {/* Subject Buttons */}
                  <div className="mb-4 lg:mb-8">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6A816F]">Subject</p>
                    <SubjectSegmentedControl
                      subjects={SUPPORTED_SUBJECTS}
                      selectedSubject={selectedSubject}
                      disabled={state.isLoading}
                      onSelect={(subject) => handleSubjectCardClick(subject as SupportedSubject)}
                    />
                  </div>

                  {/* Subject Details Container */}
                  {!isProgressSelectionPending && !isSelectedSubjectRemedial ? (
                    <div className="flex min-h-[320px] items-center justify-center px-6 py-10 text-center">
                      <p className="max-w-sm text-base font-semibold leading-8 text-[#0C3B1F]">
                        {selectedSubjectValidationMessage ?? `This student is not taking remedial in ${selectedSubject}.`}
                      </p>
                    </div>
                  ) : (
                  <div className="space-y-6">
                    {/* Progress Timeline */}
                    <div className="border-b border-[#E3EBE4] pb-4 lg:rounded-[20px] lg:border lg:border-[#DFE7E0] lg:bg-white lg:p-5 lg:shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#0C3B1F]">Progress Timeline ({selectedSubject})</p>
                          <p className="text-sm text-[#617561]">Assessment records and remedial sessions arranged by date.</p>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <DetailChip label="All" value={String(timelineEntries.length)} />
                          <span className="inline-flex items-center gap-2 rounded-full border border-[#D9E8F7] bg-[#EFF6FD] px-3 py-1.5 text-xs font-semibold text-[#1D5C8F]">
                            <span className="h-2 w-2 rounded-full bg-[#2C6EA1]" aria-hidden="true" />
                            <span>Assessments {assessmentCount}</span>
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-[#CFE2D2] bg-[#EEF7F0] px-3 py-1.5 text-xs font-semibold text-[#0C3B1F]">
                            <span className="h-2 w-2 rounded-full bg-[#0C6932]" aria-hidden="true" />
                            <span>Sessions {sessionCount}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {state.isLoading && (
                      <div className="border-b border-amber-200 pb-3 text-sm text-amber-800 lg:rounded-[24px] lg:border lg:bg-amber-50 lg:px-4 lg:py-3">
                        Updating progress timeline...
                      </div>
                    )}

                    {!state.isLoading && timelineEntries.length === 0 ? (
                      <div className="border-b border-[#E3EBE4] pb-4 text-sm text-[#617561] lg:rounded-[24px] lg:border lg:border-[#DFE7E0] lg:bg-white/90 lg:px-4 lg:py-4">
                        No performance records found for {selectedSubject}.
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {groupedTimelineEntries.map((group) => (
                          <section key={group.label} className="space-y-3">
                            <div className="flex items-center gap-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6A816F]">{group.label}</p>
                              <div className="h-px flex-1 bg-[#E3EBE4]" />
                            </div>

                            <div className="space-y-3">
                              {group.entries.map((entry) => {
                                if (entry.kind === "assessment") {
                                  const assessment = entry.assessment;
                                  const title = (assessment.title ?? "").trim() || "Untitled Assessment";
                                  const score = formatAssessmentScore(assessment);

                                  return (
                                    <button
                                      key={entry.key}
                                      type="button"
                                      onClick={() => setSelectedTimelineEntry(entry)}
                                      aria-label={`View assessment details for ${title}`}
                                      className="relative w-full overflow-hidden rounded-[18px] border border-[#DFE7E0] bg-white px-4 py-3.5 text-left transition hover:border-[#C9D9CC] hover:bg-[#FBFDFC] lg:rounded-[22px] lg:px-5"
                                    >
                                      <span className="absolute inset-y-3 left-1.5 w-1 rounded-full bg-[#2C6EA1]" aria-hidden="true" />
                                      <div className="flex items-start justify-between gap-4 pl-2">
                                        <div className="min-w-0">
                                          <p className="text-xs font-medium text-[#6B806D] lg:text-sm">{formatCompactDate(assessment.submitted_at)}</p>
                                          <p className="mt-1.5 text-sm font-semibold leading-5 text-[#102A18] lg:text-[15px]">{title}</p>
                                        </div>

                                        <span className="shrink-0 rounded-full border border-[#D9E8F7] bg-[#EFF6FD] px-2.5 py-1 text-xs font-semibold text-[#1D5C8F] lg:text-sm">
                                          Avg {score.value}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                }

                                const { session, summary } = entry;

                                return (
                                  <button
                                    key={entry.key}
                                    type="button"
                                    onClick={() => setSelectedTimelineEntry(entry)}
                                    aria-label={`View remedial session details for ${summary.titleLabel || "Remedial Session"}`}
                                    className="relative w-full overflow-hidden rounded-[18px] border border-[#DFE7E0] bg-white px-4 py-3.5 text-left transition hover:border-[#C9D9CC] hover:bg-[#FBFDFC] lg:rounded-[22px] lg:px-5"
                                  >
                                    <span className="absolute inset-y-3 left-1.5 w-1 rounded-full bg-[#0C6932]" aria-hidden="true" />
                                    <div className="flex items-start justify-between gap-4 pl-2">
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-[#6B806D] lg:text-sm">
                                          {formatCompactDate(session.schedule_date ?? session.completed_at ?? session.created_at)}
                                        </p>
                                        <p className="mt-1.5 text-sm font-semibold leading-5 text-[#102A18] lg:text-[15px]">
                                          {summary.titleLabel || "Remedial Session"}
                                        </p>
                                      </div>

                                      <span className="shrink-0 rounded-full border border-[#CFE2D2] bg-[#EEF7F0] px-2.5 py-1 text-xs font-semibold text-[#0C3B1F] lg:text-sm">
                                        Avg {summary.overallLabel}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        ))}

                        {hiddenTimelineEntryCount > 0 ? (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setShowAllTimelineEntries((current) => !current)}
                              className="text-sm font-semibold text-[#0C6932] transition hover:text-[#094F27]"
                            >
                              {showAllTimelineEntries
                                ? "Show latest entries only"
                                : `View older history (${hiddenTimelineEntryCount} more)`}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}

                  </div>
                  )}
                  </div>
                )}

                {view === "attendance" && (
                  <div
                    ref={attendanceSectionRef}
                    aria-busy={isAttendanceSelectionPending}
                    className="border-b border-[#E3EBE4] pb-5 lg:rounded-[24px] lg:border lg:border-[#DFE7E0] lg:bg-white lg:p-8 lg:shadow-sm"
                  >
                    {isAttendanceSelectionPending ? (
                      <div className="flex min-h-[320px] items-center justify-center px-6 py-10 text-center">
                        <div className="max-w-sm">
                          <div className="mx-auto h-10 w-10 rounded-full border-4 border-[#D7E9DB] border-t-[#0C6932] animate-spin" />
                          <p className="mt-4 text-base font-semibold leading-8 text-[#0C3B1F]">
                            Loading attendance for {selectedSubject}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-[#58705D]">
                            Please wait while the attendance records are being loaded.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {!isAttendanceSelectionPending && !isSelectedSubjectRemedial ? (
                      <div className="flex min-h-[320px] items-center justify-center px-6 py-10 text-center">
                        <p className="max-w-sm text-base font-semibold leading-8 text-[#0C3B1F]">
                          {selectedSubjectValidationMessage ?? `This student is not taking remedial in ${selectedSubject}.`}
                        </p>
                      </div>
                    ) : null}

                    {!isAttendanceSelectionPending && isSelectedSubjectRemedial ? (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                    {/* Schedule Cards */}
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6A816F]">School Rhythm</p>
                      <TertiaryHeader title="Weekly Schedule" className="mt-2 text-2xl font-semibold tracking-tight text-[#0C3B1F]" />
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
                    </div>

                    {/* Attendance Calendar */}
                    <AttendanceCalendar attendanceRecords={attendanceRecords} />
                    </div>
                    ) : null}

                    {!isAttendanceSelectionPending && isSelectedSubjectRemedial ? (
                      <div className="mt-6 border-t border-[#E3EBE4] pt-5 text-sm text-[#5B705D]">
                        <p className="font-medium">Please ensure your child attends all remedial sessions.</p>
                        <p className="mt-1 italic">Siguraduhin na dumadalo ang inyong anak sa lahat ng remedial sessions.</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <ProgressTimelineDetailModal
                entry={selectedTimelineEntry}
                onClose={() => setSelectedTimelineEntry(null)}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
