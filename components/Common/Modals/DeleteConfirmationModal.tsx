"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import DangerButton from "../Buttons/DangerButton";
import SecondaryButton from "../Buttons/SecondaryButton";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  itemName?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  isProcessing?: boolean;
  errorMessage?: string | null;
  showCancel?: boolean;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Delete",
  message = "Are you sure you want to delete this item? This action cannot be undone.",
  itemName,
  confirmLabel = "Delete",
  confirmDisabled = false,
  isProcessing = false,
  errorMessage = null,
  showCancel = true,
}: DeleteConfirmationModalProps) {
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
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-description"
        className="relative z-[10002] w-full max-w-[25rem] rounded-[26px] border border-slate-200 bg-white px-6 py-7 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] sm:px-7"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close delete confirmation"
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
                d="M9.75 5.25h4.5m-8 2h11.5m-10.25 0 .6 9.5A2 2 0 0 0 10.1 18.6h3.8a2 2 0 0 0 1.99-1.85l.61-9.5M10.5 10.25v4.5m3-4.5v4.5"
              />
            </svg>
          </div>

          <h3 id="delete-modal-title" className="max-w-[16rem] text-[1.45rem] font-semibold leading-tight tracking-tight text-slate-900">
            {title}
          </h3>
          <p id="delete-modal-description" className="mt-3 max-w-[18rem] text-sm leading-6 text-slate-500">
            {message}
          </p>
        </div>

        {itemName && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Selected Item</p>
            <p className="mt-1 text-sm text-slate-600">{itemName}</p>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-left text-sm leading-6 text-red-600" role="alert">
            {errorMessage}
          </div>
        )}

        <div className={`mt-7 grid gap-3 ${showCancel ? "grid-cols-2" : "grid-cols-1"}`}>
          {showCancel && (
            <SecondaryButton
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </SecondaryButton>
          )}
          <DangerButton
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled || isProcessing}
            className="w-full rounded-xl border border-red-500 bg-red-500 px-5 py-3 text-sm font-semibold shadow-none hover:border-red-600 hover:bg-red-600 disabled:border-red-300 disabled:bg-red-300"
          >
            {isProcessing ? "Processing..." : confirmLabel}
          </DangerButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
