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

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    const sessionEntries: TimelineEntry[] = (sessions ?? []).map((session, index) => {
      const completed = session.schedule_date ?? session.completed_at ?? session.created_at;
      return {
        key: buildSessionKey(session, index),
        kind: "session",
        timestamp: toTimestamp(completed),
        session,
        summary: buildSessionSummary(session),
      };
    });

    const assessmentEntries: TimelineEntry[] = (assessments ?? []).map((assessment, index) => ({
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
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#013300] hover:text-[#013300]"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  <span>Back to Individual Progress</span>
                </Link>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {timelineEntries.length === 0 ? (
                  <p className="text-sm text-slate-500">No performance records found.</p>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#013300]">Progress Timeline</p>
                          <p className="text-sm text-slate-500">Assessment records and remedial sessions arranged by date.</p>
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
                                      <NoteCard
                                        label="Teacher Remarks"
                                        value={session.teacher_notes?.trim() || "No teacher remarks available."}
                                      />
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
