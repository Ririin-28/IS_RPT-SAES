"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PrimaryButton from "../Buttons/PrimaryButton";

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  actionLabel?: string;
}

export default function MessageModal({
  isOpen,
  onClose,
  title,
  message,
  actionLabel = "OK",
}: MessageModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isOpen) return undefined;

    const { overflow } = document.body.style;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mounted, isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/20 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-modal-title"
        aria-describedby="message-modal-description"
        className="relative z-[10002] w-full max-w-[24rem] rounded-[26px] border border-slate-200 bg-white px-6 py-7 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] sm:px-7"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close message modal"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 8h.01M11 12h1v4h1m8-4a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>

          <h3 id="message-modal-title" className="max-w-[16rem] text-[1.45rem] font-semibold leading-tight tracking-tight text-slate-900">
            {title}
          </h3>
          <p id="message-modal-description" className="mt-3 max-w-[18rem] text-sm leading-6 text-slate-500">
            {message}
          </p>
        </div>

        <div className="mt-7">
          <PrimaryButton
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-[#013300] bg-[#013300] px-5 py-3 text-sm font-semibold shadow-none hover:border-green-900 hover:bg-green-900"
          >
            {actionLabel}
          </PrimaryButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
