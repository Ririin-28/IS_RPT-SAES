"use client";

import React, { useMemo, useState } from "react";

export type ToastTone = "success" | "info" | "error";

type ToastProps = {
  title?: string;
  message: string;
  details?: React.ReactNode;
  tone?: ToastTone;
  className?: string;
  actions?: React.ReactNode;
  expandable?: boolean;
  defaultExpanded?: boolean;
  onClose?: () => void;
};

const TONE_STYLES: Record<ToastTone, { container: string; icon: string; dot: string; ring: string }> = {
  success: {
    container: "border-white/50 bg-white/70 text-emerald-900",
    icon: "text-emerald-600",
    dot: "bg-emerald-400",
    ring: "ring-gray-200/60",
  },
  info: {
    container: "border-gray-200/70 bg-gray-50/80 text-sky-900",
    icon: "text-sky-600",
    dot: "bg-sky-400",
    ring: "ring-gray-200/60",
  },
  error: {
    container: "border-gray-200/70 bg-gray-50/80 text-rose-900",
    icon: "text-rose-600",
    dot: "bg-rose-400",
    ring: "ring-gray-200/60",
  },
};

const Toast: React.FC<ToastProps> = ({
  title,
  message,
  details,
  tone = "success",
  className = "",
  actions,
  expandable = false,
  defaultExpanded = false,
  onClose,
}) => {
  const styles = TONE_STYLES[tone];
  const [expanded, setExpanded] = useState(defaultExpanded);
  const canExpand = useMemo(() => expandable || Boolean(details) || Boolean(actions), [expandable, details, actions]);
  const iconPath =
    tone === "success"
      ? "M20 6 9 17l-5-5"
      : tone === "error"
      ? "M6 18 18 6M6 6l12 12"
      : "M12 16v-4m0-4h.01";

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl shadow-black/20 ring-1 backdrop-blur-md backdrop-saturate-150 ${
        styles.container
      } ${styles.ring} ${className}`}
    >
      <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-gray-50">
        <svg className={`h-4 w-4 ${styles.icon}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <div className="text-sm font-semibold text-gray-900">{title}</div>}
            <div className="text-sm text-gray-600">
              {message}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {canExpand && (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((prev) => !prev)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              >
                <svg
                  className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                aria-label="Close toast"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {expanded && details && <div className="mt-2 text-xs text-gray-500">{details}</div>}
        {expanded && actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
};

export default Toast;
