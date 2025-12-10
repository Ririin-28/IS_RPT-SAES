"use client";
import { type CSSProperties, type ReactNode } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useRouter } from "next/navigation";

/* ---------- Shared icons so downstream flashcard pages can keep the same visuals ---------- */
export const Volume2Icon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
    <path d="M16 9a5 5 0 0 1 0 6" />
    <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
  </svg>
);

export const MicIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 19v3" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <rect x="9" y="2" width="6" height="13" rx="3" />
  </svg>
);

type CardAction = {
  id: string;
  label: string;
  activeLabel?: string;
  icon: ReactNode;
  onClick: () => void;
  isActive?: boolean;
};

type InsightMetric = {
  label: string;
  value?: string | number | null;
  onClick?: () => void;
  clickable?: boolean;
};

export type InsightPanelProps = {
  heading?: string;
  highlightLabel?: string;
  highlightText?: string;
  metrics?: InsightMetric[];
  footerLabel?: string;
  footerText?: string;
};

export type StudentSummary = {
  studentId: string;
  name: string;
  grade?: string;
  section?: string;
};

export type SelectionViewProps = {
  summaryText: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  table: ReactNode;
  lastSavedMessage?: string;
  customBanner?: ReactNode;
};

export type SessionViewProps = {
  student: StudentSummary;
  levelLabel?: string;
  cardText?: string;
  cardContent?: ReactNode;
  cardFooter?: ReactNode;
  cardActions?: CardAction[];
  insights: InsightPanelProps;
  progress: { currentIndex: number; totalCount: number };
  nav: {
    onPrev: () => void;
    onNext: () => void;
    onStop: () => void;
    disablePrev?: boolean;
    disableNext?: boolean;
    prevLabel?: string;
    nextLabel?: string;
    stopLabel?: string;
  };
};

export type FlashcardsTemplateProps = {
  view: "select" | "session";
  subjectLabel: string;
  headline?: string;
  cardLabel?: string;
  onBack?: () => void;
  selection?: SelectionViewProps;
  session?: SessionViewProps;
};

export default function FlashcardsTemplate({
  view,
  subjectLabel,
  headline = "Remedial Flashcards",
  cardLabel = "Card",
  onBack,
  selection,
  session,
}: FlashcardsTemplateProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  if (view === "select") {
    if (!selection) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("FlashcardsTemplate: selection props are required for select view.");
      }
      return null;
    }

    return (
      <div className="min-h-dvh bg-gradient-to-br from-[#f2f8f4] via-white to-[#e6f2ec]">
        <div className="w-full max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex min-h-dvh flex-col">
          <header className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur px-3 py-3 sm:py-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between shadow-md shadow-gray-200">
            <div className="space-y-3 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">{subjectLabel}</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#0d1b16]">{headline}</h1>
            </div>
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-[#013300] px-6 py-3 text-sm font-semibold text-[#013300] transition hover:bg-emerald-50"
            >
              <FiArrowLeft /> Back
            </button>
          </header>

          {selection.lastSavedMessage && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm shadow-emerald-100">
              {selection.lastSavedMessage}
            </div>
          )}

          {selection.customBanner}

          <div className="mt-5 rounded-3xl border border-gray-300 bg-white shadow-md shadow-gray-200 p-6 space-y-6 flex flex-1 flex-col min-h-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-gray-600">{selection.summaryText}</p>
              <div>
                <input
                  type="text"
                  placeholder={selection.searchPlaceholder ?? "Search Students..."}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 text-black"
                  value={selection.searchValue}
                  onChange={(event) => selection.onSearchChange(event.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 min-h-0">{selection.table}</div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "session") {
    if (!session) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("FlashcardsTemplate: session props are required for session view.");
      }
      return null;
    }

    const progressPercent = session.progress.totalCount > 0
      ? ((session.progress.currentIndex + 1) / session.progress.totalCount) * 100
      : 0;
    const progressCircleStyle: CSSProperties = {
      background: `conic-gradient(#013300 ${progressPercent * 3.6}deg, #e6f4ef ${progressPercent * 3.6}deg)`,
    };

    const renderCardFooter = () => {
      if (session.cardFooter) return session.cardFooter;
      if (!session.cardActions || session.cardActions.length === 0) return null;

      return (
        <div className="px-6 sm:px-8 py-6 border-t border-gray-300 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
          {session.cardActions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              className={`group flex items-center gap-3 rounded-full px-6 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 active:scale-95 ${
                action.isActive
                  ? "bg-[#013300] text-white shadow-md shadow-gray-200"
                  : "border border-[#013300] bg-white text-[#013300] hover:border-[#013300] hover:bg-[#013300] hover:text-white"
              } w-full md:w-auto`}
            >
              <span
                className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${
                  action.isActive
                    ? "bg-white/10 text-white animate-pulse"
                    : "bg-white text-[#013300] group-hover:bg-[#013300] group-hover:text-white group-focus-visible:bg-[#013300] group-focus-visible:text-white"
                }`}
              >
                {action.icon}
              </span>
              {action.isActive ? action.activeLabel ?? action.label : action.label}
            </button>
          ))}
        </div>
      );
    };

    const renderInsightMetrics = () => {
      if (!session.insights.metrics || session.insights.metrics.length === 0) return null;
      return (
        <dl className="grid flex-1 grid-cols-1 gap-3 text-sm sm:grid-cols-2 auto-rows-fr">
          {session.insights.metrics.map((metric) => (
            <div 
              key={metric.label} 
              className={`rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col ${metric.clickable ? 'cursor-pointer hover:bg-emerald-50 transition-colors' : ''}`}
              onClick={metric.clickable ? metric.onClick : undefined}
            >
              <dt className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</dt>
              <dd className="text-lg font-semibold text-[#013300]">{metric.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      );
    };

    return (
      <div className="min-h-dvh bg-gradient-to-br from-[#f2f8f4] via-white to-[#e6f2ec]">
        <div className="w-full max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex min-h-dvh flex-col">
          <header className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur px-3 py-3 sm:py-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between shadow-md shadow-gray-200">
            <div className="space-y-2 text-center lg:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">{subjectLabel}</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#0d1b16]">{session.levelLabel ?? "Non-Reader Level"}</h1>
              <p className="text-md font-semibold text-[#013300]">
                Student: {session.student.studentId} - {session.student.name}
              </p>
              {(session.student.grade || session.student.section) && (
                <p className="text-sm text-slate-500">
                  {session.student.grade ? `Grade ${session.student.grade}` : ""}
                  {session.student.grade && session.student.section ? " • " : ""}
                  {session.student.section ? `Section ${session.student.section}` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center lg:justify-end">
              <div className="relative grid place-items-center">
                <div className="w-20 h-20 rounded-full ring-8 ring-emerald-50 shadow-inner" style={progressCircleStyle} />
                <div className="absolute inset-3 rounded-full bg-white" />
                <span className="absolute text-lg font-semibold text-[#013300]">{Math.round(progressPercent)}%</span>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs uppercase tracking-wide text-slate-500">{cardLabel}</p>
                <p className="text-xl font-semibold text-[#013300]">
                  {session.progress.currentIndex + 1} <span className="text-base font-normal text-slate-400">/ {session.progress.totalCount}</span>
                </p>
              </div>
            </div>
          </header>

          <div className="mt-5 flex flex-1 flex-col gap-5">
            <div className="grid gap-3 xl:grid-cols-12 flex-1 min-h-0">
              <section className="xl:col-span-8 flex flex-col min-h-0">
                <div className="h-full rounded-3xl border border-gray-300 bg-white shadow-md shadow-gray-200 overflow-hidden flex flex-col">
                  <div className="flex-1 px-6 sm:px-8 lg:px-12 py-12 via-white flex items-center justify-center text-center">
                    {session.cardContent ?? (
                      <p className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#013300] leading-tight">
                        {session.cardText ?? ""}
                      </p>
                    )}
                  </div>
                  {renderCardFooter()}
                </div>
              </section>

              <aside className="xl:col-span-4 flex flex-col gap-6 min-h-0">
                <div className="rounded-3xl border border-gray-300 bg-white/80 backdrop-blur px-6 py-7 shadow-md shadow-gray-200 flex flex-1 flex-col min-h-0">
                  <h2 className="text-lg font-semibold text-[#013300]">{session.insights.heading ?? "Real-time Insights"}</h2>
                  <div className="mt-6 flex flex-1 flex-col gap-4 min-h-0">
                    {session.insights.highlightText && (
                      <div className="rounded-2xl border border-gray-300 bg-emerald-50/60 px-4 py-3 flex flex-col h-full">
                        <p className="text-xs uppercase tracking-wide text-emerald-800">{session.insights.highlightLabel ?? "Highlight"}</p>
                        <p className="mt-1 text-sm font-medium text-[#013300]">{session.insights.highlightText}</p>
                      </div>
                    )}
                    {renderInsightMetrics()}
                    {session.insights.footerText && (
                      <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 flex flex-col h-full">
                        <p className="text-xs uppercase tracking-wide text-slate-500">{session.insights.footerLabel ?? "Remarks"}</p>
                        <p className="mt-1 text-sm text-[#013300]">{session.insights.footerText}</p>
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-center gap-3 w-full">
                <button
                  onClick={session.nav.onPrev}
                  disabled={session.nav.disablePrev}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#013300] px-6 py-3 text-sm font-medium text-[#013300] transition hover:border-[#013300] hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-transparent w-full sm:w-auto"
                >
                  <FiArrowLeft /> {session.nav.prevLabel ?? "Previous"}
                </button>
                <button
                  onClick={session.nav.onStop}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#013300] px-7 py-3 text-sm font-medium text-white shadow-md shadow-gray-200 transition hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 active:scale-95 w-full sm:w-auto"
                >
                  <span className="h-2 w-2 rounded-full bg-white/70" /> {session.nav.stopLabel ?? "Save & Exit"}
                </button>
                <button
                  onClick={session.nav.onNext}
                  disabled={session.nav.disableNext}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#013300] px-6 py-3 text-sm font-medium text-[#013300] transition hover:border-[#013300] hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-transparent w-full sm:w-auto"
                >
                  {session.nav.nextLabel ?? "Next"} <FiArrowRight />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}