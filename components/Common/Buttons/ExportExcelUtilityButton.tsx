"use client";

interface ExportExcelUtilityButtonProps {
  onExport: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
}

export default function ExportExcelUtilityButton({
  onExport,
  disabled = false,
  ariaLabel = "Export to Excel",
  title = "Export to Excel",
}: ExportExcelUtilityButtonProps) {
  return (
    <button
      type="button"
      onClick={onExport}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-[0.98] ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
    >
      <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
      </svg>
    </button>
  );
}
