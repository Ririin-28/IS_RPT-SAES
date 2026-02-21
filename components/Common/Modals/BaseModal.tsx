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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className={`relative z-[10000] bg-white rounded-lg shadow-xl w-full ${maxWidthClasses[maxWidth]} max-h-[95vh] overflow-y-auto`}>
        {/* Modal Header with green background */}
        <div className="bg-[#013300] text-white rounded-t-lg p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-[#015500]"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className="flex justify-end gap-3 pt-4 border-t mt-6 px-6 pb-6">
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
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
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