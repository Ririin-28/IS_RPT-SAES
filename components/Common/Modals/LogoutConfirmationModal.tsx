"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PrimaryButton from "../Buttons/PrimaryButton";
import SecondaryButton from "../Buttons/SecondaryButton";

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LogoutConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
}: LogoutConfirmationModalProps) {
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
        aria-labelledby="logout-modal-title"
        aria-describedby="logout-modal-description"
        data-logout-modal-card="true"
        className="relative z-[10002] w-full max-w-[24rem] rounded-[26px] border border-slate-200 bg-white px-6 py-7 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] sm:px-7"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close logout confirmation"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-400">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
                d="M10 7.25V6.5A2.5 2.5 0 0 1 12.5 4h4A2.5 2.5 0 0 1 19 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-4A2.5 2.5 0 0 1 10 17.5v-.75M5 12h10.5m0 0-2.75-2.75M15.5 12l-2.75 2.75"
              />
            </svg>
          </div>

          <h3 id="logout-modal-title" className="max-w-[15rem] text-[1.45rem] font-semibold leading-tight tracking-tight text-slate-900">
            Do you really want to log out?
          </h3>
          <p id="logout-modal-description" className="mt-3 max-w-[17rem] text-sm leading-6 text-slate-500">
            All unsaved progress from this session would be lost.
          </p>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <PrimaryButton
            type="button"
            onClick={onConfirm}
            className="w-full rounded-xl border border-rose-500 bg-rose-500 px-5 py-3 text-sm font-semibold shadow-none hover:border-rose-600 hover:bg-rose-600"
          >
            Yes
          </PrimaryButton>
          <SecondaryButton
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-rose-100 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-400 hover:bg-rose-100"
          >
            No
          </SecondaryButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
