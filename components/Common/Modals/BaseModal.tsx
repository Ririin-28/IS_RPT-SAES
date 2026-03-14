"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface BaseModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  footer?: React.ReactNode;
}

export default function BaseModal({ 
  show, 
  onClose, 
  title, 
  children, 
  maxWidth = "2xl",
  footer 
}: BaseModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !show) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [mounted, show]);

  if (!show || !mounted) return null;

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md", 
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl"
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" aria-hidden="true" />
      <div className={`relative z-10000 flex max-h-[95vh] w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_20px_60px_-24px_rgba(15,23,42,0.35)] ${maxWidthClasses[maxWidth]}`}>
        <div className="shrink-0 bg-[#013300] px-6 py-5 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white tracking-tight">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 flex justify-end gap-3 border-t border-gray-200 bg-gray-50/70 px-6 py-4 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// Text Components for consistent styling
export function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-2">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function ModalLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

export function ModalInfoItem({ label, value }: { label: string; value: any }) {
  return (
    <div className="space-y-1">
      <ModalLabel>{label}</ModalLabel>
      <div className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-md px-3 py-2 text-sm">
        {value || "-"}
      </div>
    </div>
  );
}
