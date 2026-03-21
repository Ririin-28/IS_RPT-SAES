"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import type { RemedialSessionSlide, RemedialSessionTimelineItem, StudentAssessmentRecord } from "@/lib/performance";
import { composeRuleBasedSlideFeedbackParagraph, getReadingSpeedLabel } from "@/lib/performance/insights";

const EMPTY_VALUE = "--";

export type IndividualProgressStudent = {
  student_id?: string | number | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  lrn?: string | null;
};

export type IndividualProgressViewProps = {
  SidebarComponent: ComponentType;
  HeaderComponent: ComponentType<{ title: string }>;
  student: IndividualProgressStudent | null;
  sessions: RemedialSessionTimelineItem[];
  assessments: StudentAssessmentRecord[];
  subjectLabel: string;
  backHref: string;
};

type SessionSummary = {
  dateLabel: string;
  monthLabel: string;
  dayOfMonthLabel: string;
  dayLabel: string;
  subjectLabel: string;
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

type SessionMetricCardProps = {
  label: string;
  value: string;
  accent?: boolean;
};

const formatStudentName = (student: IndividualProgressStudent | null) => {
  if (!student) return "Student";

  const explicit = (student.full_name ?? "").trim();
  if (explicit) return explicit;

  const parts = [student.first_name, student.middle_name, student.last_name].map((value) => (value ?? "").trim()).filter(Boolean);

  return parts.length ? parts.join(" ") : "Student";
};

const toTimestamp = (value: string | Date | null | undefined) => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const toDate = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value: string | Date | null | undefined) => {
  const date = toDate(value);
  if (!date) return EMPTY_VALUE;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatShortMonth = (value: string | Date | null | undefined) => {
  const date = toDate(value);
  if (!date) return EMPTY_VALUE;
  return date.toLocaleDateString("en-PH", { month: "short" }).toUpperCase();
};

const formatDayOfMonth = (value: string | Date | null | undefined) => {
  const date = toDate(value);
  if (!date) return EMPTY_VALUE;
  return date.toLocaleDateString("en-PH", { day: "numeric" });
};

const formatShortWeekday = (value: string | Date | null | undefined) => {
  const date = toDate(value);
  if (!date) return EMPTY_VALUE;
  return date.toLocaleDateString("en-PH", { weekday: "short" });
};

const normalizeSessionSubjectLabel = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return EMPTY_VALUE;

  const lower = trimmed.toLowerCase();
  if (lower === "mathematics" || lower === "math") return "Math";
  if (lower === "english") return "English";
  if (lower === "filipino") return "Filipino";
  return trimmed;
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

const buildSessionSummary = (session: RemedialSessionTimelineItem, subjectLabel: string): SessionSummary => {
  const completed = session.completed_at ?? session.created_at;
  const scheduleDate = session.schedule_date ?? completed;

  return {
    dateLabel: formatDate(scheduleDate),
    monthLabel: formatShortMonth(scheduleDate),
    dayOfMonthLabel: formatDayOfMonth(scheduleDate),
    dayLabel: formatShortWeekday(scheduleDate),
    subjectLabel: normalizeSessionSubjectLabel(subjectLabel),
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
      {kind === "assessment" ? "Assessment" : "Session"}
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
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-700">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1.5 text-sm leading-5 text-slate-600">{value}</p>
    </div>
  );
}

function SessionMetricCard({ label, value, accent = false }: SessionMetricCardProps) {
  return (
    <div
      className={[
        "rounded-xl border px-4 py-3.5",
        accent ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={["mt-2 text-base font-semibold", accent ? "text-[#013300]" : "text-slate-900"].join(" ")}>{value}</p>
    </div>
  );
}

export default function IndividualProgressView({
  SidebarComponent,
  HeaderComponent,
  student,
  sessions,
  assessments,
  subjectLabel,
  backHref,
}: IndividualProgressViewProps) {
  const studentName = useMemo(() => formatStudentName(student), [student]);
  const studentLrn = (student?.lrn ?? "").trim();

  const safeSessions = useMemo(() => (Array.isArray(sessions) ? sessions : []), [sessions]);
  const safeAssessments = useMemo(() => (Array.isArray(assessments) ? assessments : []), [assessments]);

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    const sessionEntries: TimelineEntry[] = safeSessions.map((session, index) => {
      const completed = session.schedule_date ?? session.completed_at ?? session.created_at;
      return {
        key: buildSessionKey(session, index),
        kind: "session",
        timestamp: toTimestamp(completed),
        session,
        summary: buildSessionSummary(session, subjectLabel),
      };
    });

    const assessmentEntries: TimelineEntry[] = safeAssessments.map((assessment, index) => ({
      key: buildAssessmentKey(assessment, index),
      kind: "assessment",
      timestamp: toTimestamp(assessment.submitted_at),
      assessment,
    }));

    return [...assessmentEntries, ...sessionEntries].sort((left, right) => right.timestamp - left.timestamp);
  }, [safeAssessments, safeSessions, subjectLabel]);

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

  const assessmentCount = safeAssessments.length;
  const sessionCount = safeSessions.length;
  const hasTimelineData = timelineEntries.length > 0;

  const timelineDescription =
    assessmentCount > 0 && sessionCount > 0
      ? "Assessment records and remedial sessions arranged by date."
      : sessionCount > 0
        ? "Remedial sessions arranged by date."
        : assessmentCount > 0
          ? "Assessment records arranged by date."
          : "No assessment records or remedial sessions found.";

  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      <SidebarComponent />

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden pt-16">
        <HeaderComponent title="Report" />

        <main className="flex-1 overflow-y-auto">
          <div className="h-full p-4 sm:p-5 md:p-6">
            <div className="relative z-10 flex h-full min-h-100 flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/50 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <div className="no-print flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{studentName}</h1>
                  <p className="text-sm text-slate-600">
                    {subjectLabel} performance {studentLrn ? `| LRN ${studentLrn}` : ""}
                  </p>
                </div>

                <Link
                  href={backHref}
                  aria-label="Back"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#013300]/15"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  <span className="pr-1">Back</span>
                </Link>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {!hasTimelineData ? (
                  <p className="text-sm text-slate-500">No assessment records or remedial sessions found.</p>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#013300]">Progress Timeline</p>
                          <p className="text-sm text-slate-500">{timelineDescription}</p>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <DetailChip label="All" value={String(timelineEntries.length)} />
                          <DetailChip label="Assessments" value={String(assessmentCount)} />
                          <DetailChip label="Sessions" value={String(sessionCount)} />
                        </div>
                      </div>
                    </div>

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
                          const slideRows = session.slides.map((slide) => {
                            const storedFeedback = (slide.reading_tutor_feedback ?? "").trim();
                            const slideFeedback =
                              storedFeedback ||
                              composeRuleBasedSlideFeedbackParagraph({
                                accuracyScore: slide.accuracy_score ?? null,
                                readingSpeedWpm: slide.reading_speed_wpm ?? null,
                                slideAverage: slide.slide_average ?? null,
                              });

                            return {
                              key: String(slide.performance_id ?? `${key}-${slide.flashcard_index}`),
                              slideLabel: typeof slide.flashcard_index === "number" ? `Slide ${slide.flashcard_index + 1}` : "Slide",
                              accuracyLabel: formatPercent(slide.accuracy_score),
                              readingSpeedLabel:
                                typeof slide.reading_speed_wpm === "number" ? getReadingSpeedLabel(slide.reading_speed_wpm) : EMPTY_VALUE,
                              averageLabel: formatSlideAverage(slide),
                              feedback: slideFeedback,
                            };
                          });
                          const sessionCardClassName = [
                            "overflow-hidden rounded-xl border transition-all duration-300",
                            isExpanded
                              ? "border-[#013300]/20 bg-white shadow-[0_16px_36px_-24px_rgba(1,51,0,0.25)]"
                              : "border-gray-200 bg-white hover:border-[#013300]/30 hover:shadow-lg",
                          ].join(" ");
                          const sessionHeaderClassName = [
                            "group flex w-full flex-col gap-3 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between",
                            isExpanded ? "bg-[#013300]" : "bg-white",
                          ].join(" ");
                          const dateBoxClassName = [
                            "shrink-0 flex h-14 w-12 flex-col items-center justify-center rounded-lg border",
                            isExpanded
                              ? "border-white/15 bg-white/10 text-white"
                              : "border-[#013300]/10 bg-[#013300]/5 text-[#013300]",
                          ].join(" ");
                          const subjectChipClassName = [
                            "inline-flex items-center rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider",
                            isExpanded ? "bg-white/12 text-white" : "bg-gray-100 text-gray-600",
                          ].join(" ");
                          const weekdayClassName = [
                            "text-[0.65rem] font-medium uppercase",
                            isExpanded ? "text-white/70" : "text-gray-400",
                          ].join(" ");
                          const titleClassName = [
                            "text-sm font-bold leading-tight transition-colors",
                            isExpanded ? "text-white" : "text-gray-900",
                          ].join(" ");
                          const toggleClassName = [
                            "flex shrink-0 items-center gap-2 text-sm font-semibold transition-colors",
                            isExpanded
                              ? "text-white"
                              : "text-[#013300]",
                          ].join(" ");

                          return (
                            <section key={key} className="relative pl-12">
                              <span className="absolute left-1.5 top-5 h-5 w-5 rounded-full border-4 border-[#013300] bg-green-100" />

                              <div className={sessionCardClassName}>
                                <button
                                  type="button"
                                  aria-expanded={isExpanded}
                                  onClick={() => setExpandedSessionKey((current) => (current === key ? null : key))}
                                  className={sessionHeaderClassName}
                                >
                                  <div className="flex min-w-0 items-center gap-4">
                                    <div className={dateBoxClassName} title={summary.dateLabel !== EMPTY_VALUE ? summary.dateLabel : undefined}>
                                      <span className="text-[0.65rem] font-bold uppercase tracking-wide leading-none">{summary.monthLabel}</span>
                                      <span className="mt-0.5 text-xl font-extrabold leading-none">{summary.dayOfMonthLabel}</span>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="mb-1 flex flex-wrap items-center gap-2">
                                        <span className={subjectChipClassName}>
                                          {summary.subjectLabel}
                                        </span>
                                        <span className={weekdayClassName}>{summary.dayLabel}</span>
                                      </div>

                                      <p className={titleClassName}>{summary.titleLabel || "Untitled Session"}</p>

                                      {isExpanded ? (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          <DetailChip label="Phonemic" value={summary.phonemicLabel} />
                                          <DetailChip label="Average" value={summary.overallLabel} emphasized />
                                          <DetailChip label="Slides" value={summary.slideCountLabel} />
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className={toggleClassName}>
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
                                  <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-4">
                                    <div className="space-y-4">
                                      <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                                        <div className="mb-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Session Summary</p>
                                          <p className="mt-1 text-sm text-slate-500">High-level results from this remedial session.</p>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-3">
                                          <SessionMetricCard label="Phonemic Level" value={summary.phonemicLabel} />
                                          <SessionMetricCard label="Overall Average" value={summary.overallLabel} accent />
                                          <SessionMetricCard label="Slides Recorded" value={summary.slideCountLabel} />
                                        </div>
                                      </section>

                                      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
                                          <p className="text-sm font-semibold text-slate-900">Per-Slide Feedback</p>
                                          <p className="mt-1 text-xs text-slate-500">Accuracy, reading speed, and guidance for each recorded slide.</p>
                                        </div>

                                        {slideRows.length === 0 ? (
                                          <div className="px-4 py-4 text-sm text-slate-500">No slides recorded for this session.</div>
                                        ) : (
                                          <>
                                            <div className="hidden overflow-x-auto lg:block">
                                              <table className="min-w-[860px] w-full text-left text-sm text-slate-700">
                                                <thead className="bg-white text-slate-500">
                                                  <tr className="border-b border-slate-200">
                                                    <th className="px-4 py-3 font-semibold">Slide</th>
                                                    <th className="px-4 py-3 font-semibold">Accuracy</th>
                                                    <th className="px-4 py-3 font-semibold">Reading Speed</th>
                                                    <th className="px-4 py-3 font-semibold">Average</th>
                                                    <th className="px-4 py-3 font-semibold">Feedback</th>
                                                  </tr>
                                                </thead>

                                                <tbody className="bg-white">
                                                  {slideRows.map((slideRow) => (
                                                    <tr key={slideRow.key} className="border-b border-slate-100 last:border-b-0">
                                                      <td className="whitespace-nowrap px-4 py-3.5 align-top font-semibold text-slate-900">{slideRow.slideLabel}</td>
                                                      <td className="px-4 py-3.5 align-top">{slideRow.accuracyLabel}</td>
                                                      <td className="px-4 py-3.5 align-top">{slideRow.readingSpeedLabel}</td>
                                                      <td className="px-4 py-3.5 align-top font-semibold text-[#013300]">{slideRow.averageLabel}</td>
                                                      <td className="px-4 py-3.5 leading-6 text-slate-600">{slideRow.feedback}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>

                                            <div className="grid gap-3 p-4 lg:hidden">
                                              {slideRows.map((slideRow) => (
                                                <article key={slideRow.key} className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-4">
                                                  <div className="flex items-center justify-between gap-3">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{slideRow.slideLabel}</p>
                                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[#013300]">
                                                      {slideRow.averageLabel}
                                                    </span>
                                                  </div>

                                                  <div className="mt-3 grid grid-cols-2 gap-2">
                                                    <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200/80">
                                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Accuracy</p>
                                                      <p className="mt-1 text-sm font-semibold text-slate-900">{slideRow.accuracyLabel}</p>
                                                    </div>
                                                    <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200/80">
                                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Reading Speed</p>
                                                      <p className="mt-1 text-sm font-semibold text-slate-900">{slideRow.readingSpeedLabel}</p>
                                                    </div>
                                                  </div>

                                                  <p className="mt-3 text-sm leading-6 text-slate-600">{slideRow.feedback}</p>
                                                </article>
                                              ))}
                                            </div>
                                          </>
                                        )}
                                      </section>

                                      <section>
                                        <div className="mb-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Remarks</p>
                                          <p className="mt-1 text-sm text-slate-500">AI-generated feedback and teacher notes for this session.</p>
                                        </div>

                                        <div className="grid gap-3 xl:grid-cols-2">
                                          <NoteCard label="AI Remarks" value={session.ai_remarks?.trim() || "No AI remarks available."} />
                                          <NoteCard
                                            label="Teacher Remarks"
                                            value={session.teacher_notes?.trim() || "No teacher remarks available."}
                                          />
                                        </div>
                                      </section>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
