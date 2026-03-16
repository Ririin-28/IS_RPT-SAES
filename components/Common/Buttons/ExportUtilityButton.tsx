"use client";

import { useCallback, useState } from "react";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";

type ExportUtilityButtonProps = {
  onExport: () => void;
  disabled?: boolean;
  className?: string;
  confirmTitle?: string;
  confirmMessage?: string;
};

const ExportIcon = () => (
  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
  </svg>
);

export default function ExportUtilityButton({
  onExport,
  disabled = false,
  className = "",
  confirmTitle = "Confirm Export",
  confirmMessage = "You are about to export the current records to Excel. Do you want to continue?",
}: ExportUtilityButtonProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleClick = useCallback(() => {
    if (disabled) {
      return;
    }
    setShowConfirmModal(true);
  }, [disabled]);

  const handleConfirm = useCallback(() => {
    if (disabled) {
      return;
    }
    onExport();
    setShowConfirmModal(false);
  }, [disabled, onExport]);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className}`}
        aria-label="Export to Excel"
        title="Export to Excel"
        disabled={disabled}
      >
        <ExportIcon />
      </button>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirm}
        title={confirmTitle}
        message={confirmMessage}
        confirmText="Export"
      />
    </>
  );
}
