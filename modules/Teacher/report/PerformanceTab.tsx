"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Teacher/Sidebar";
import Header from "@/components/Teacher/Header";
import type { RemedialSessionSlide, RemedialSessionTimelineItem } from "@/lib/performance";

type StudentDetails = {
  student_id?: string | number | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  lrn?: string | null;
};

type PerformanceTabProps = {
  student: StudentDetails | null;
  sessions: RemedialSessionTimelineItem[];
  subjectLabel: string;
  backHref: string;
};

const formatStudentName = (student: StudentDetails | null) => {
  if (!student) return "Student";
  const explicit = (student.full_name ?? "").trim();
  if (explicit) return explicit;
  const parts = [student.first_name, student.middle_name, student.last_name]
    .map((value) => (value ?? "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(" ") : "Student";
};

const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatScore = (value: number | null | undefined, suffix = "%") => {
  if (typeof value !== "number") return "—";
  return `${Math.round(value)}${suffix}`;
};

const buildSessionLabel = (session: RemedialSessionTimelineItem) => {
  const completed = session.completed_at ?? session.created_at;
  const scheduleDate = session.schedule_date ?? completed;
  const dateLabel = formatDate(scheduleDate);
  const titleLabel = (session.schedule_title ?? "").trim();
  const overall = typeof session.overall_average === "number"
    ? `${Math.round(session.overall_average)}%`
    : "—";
  const phonemicLabel = (session.phonemic_level ?? "").trim();
  return { dateLabel, overall, titleLabel, phonemicLabel };
};

const formatSlideAverage = (slide: RemedialSessionSlide) =>
  formatScore(typeof slide.slide_average === "number" ? slide.slide_average : null);

export default function PerformanceTab({ student, sessions, subjectLabel, backHref }: PerformanceTabProps) {
  const studentName = useMemo(() => formatStudentName(student), [student]);
  const studentLrn = (student?.lrn ?? "").trim();
  const [expandedSessions, setExpandedSessions] = useState<Set<string | number>>(new Set());

  const timelineItems = useMemo(() => sessions ?? [], [sessions]);

  const toggleExpanded = (sessionId: string | number | null | undefined) => {
    if (sessionId == null) return;
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />

      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Report" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-100 overflow-hidden flex flex-col">
              <div className="no-print flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 sm:py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-800">{studentName}</h1>
                  <p className="text-sm text-gray-600">
                    {subjectLabel} performance {studentLrn ? `• LRN ${studentLrn}` : ""}
                  </p>
                </div>
                <Link
                  href={backHref}
                  className="inline-flex items-center gap-2 rounded-md border border-[#013300] px-3 py-2 text-sm font-semibold text-[#013300] transition hover:bg-green-50"
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

              <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto">
                {timelineItems.length === 0 ? (
                  <p className="text-sm text-gray-500">No performance records found.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 h-full w-px bg-[#013300]" />
                    <div className="space-y-6">
                      {timelineItems.map((session) => {
                        const sessionId = session.session_id ?? "session";
                        const { dateLabel, overall, titleLabel, phonemicLabel } = buildSessionLabel(session);
                        const isExpanded = expandedSessions.has(sessionId as string | number);
                        return (
                          <div key={String(sessionId)} className="relative pl-12">
                            <span className="absolute left-1.5 top-4 h-5 w-5 rounded-full border-4 border-[#013300] bg-green-100" />
                            <div className="rounded-xl border border-green-50 bg-white shadow-sm">
                              <button
                                type="button"
                                onClick={() => toggleExpanded(sessionId)}
                                className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-[#013300]">
                                    {dateLabel !== "—" ? dateLabel : "—"}
                                    {titleLabel ? ` (${titleLabel})` : ""}
                                  </p>
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
                                <div className="border-t border-green-50 px-4 pb-4 pt-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phonemic</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {phonemicLabel && (
                                      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-sm font-medium text-[#013300]">
                                        {phonemicLabel}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Overall Average</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-sm font-semibold text-[#013300]">
                                      {overall}
                                    </span>
                                  </div>
                                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Per-Slide Average</p>
                                  <div className="mt-3 overflow-x-auto">
                                    <table className="min-w-full text-sm text-left text-slate-700">
                                      <thead className="bg-green-50 text-[#013300]">
                                        <tr>
                                          <th className="px-3 py-2 font-semibold">Slide</th>
                                          <th className="px-3 py-2 font-semibold">Pronunciation</th>
                                          <th className="px-3 py-2 font-semibold">Correctness</th>
                                          <th className="px-3 py-2 font-semibold">WPM</th>
                                          <th className="px-3 py-2 font-semibold">Average</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-green-50">
                                        {session.slides.length === 0 ? (
                                          <tr>
                                            <td className="px-3 py-3 text-slate-500" colSpan={5}>
                                              No slides recorded for this session.
                                            </td>
                                          </tr>
                                        ) : (
                                          session.slides.map((slide) => (
                                            <tr key={String(slide.performance_id ?? `${sessionId}-${slide.flashcard_index}`)}>
                                              <td className="px-3 py-2 font-semibold text-[#013300]">
                                                {typeof slide.flashcard_index === "number" ? slide.flashcard_index + 1 : "—"}
                                              </td>
                                              <td className="px-3 py-2">{formatScore(slide.pronunciation_score)}</td>
                                              <td className="px-3 py-2">{formatScore(slide.correctness_score)}</td>
                                              <td className="px-3 py-2">{typeof slide.reading_speed_wpm === "number" ? slide.reading_speed_wpm : "—"}</td>
                                              <td className="px-3 py-2 font-semibold text-[#013300]">{formatSlideAverage(slide)}</td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Remarks</p>
                                  <div className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-[#013300]">
                                    {session.ai_remarks?.trim() || "No AI remarks available."}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
