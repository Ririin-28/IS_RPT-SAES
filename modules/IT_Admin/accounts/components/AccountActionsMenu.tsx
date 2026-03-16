"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AccountType = "Principal" | "IT Admin" | "Master Teachers" | "Teachers";

export type AccountActionKey =
  | "principal:add"
  | "principal:upload"
  | "principal:select"
  | "it_admin:add"
  | "it_admin:upload"
  | "it_admin:select"
  | "master-teacher:add"
  | "master-teacher:upload"
  | "master-teacher:select"
  | "teacher:add"
  | "teacher:upload"
  | "teacher:select";

type ActionConfig = {
  label: string;
  action: AccountActionKey;
};

const SelectIcon = () => (
  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
  </svg>
);

const ExportIcon = () => (
  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
  </svg>
);

const ACCOUNT_ACTIONS: Record<AccountType, ActionConfig[]> = {
  Principal: [
    { label: "Add Principal", action: "principal:add" },
    { label: "Upload file", action: "principal:upload" },
    { label: "Select", action: "principal:select" },
  ],
  "IT Admin": [
    { label: "Add IT Admin", action: "it_admin:add" },
    { label: "Upload file", action: "it_admin:upload" },
    { label: "Select", action: "it_admin:select" },
  ],
  "Master Teachers": [
    { label: "Add MasterTeacher", action: "master-teacher:add" },
    { label: "Upload file", action: "master-teacher:upload" },
    { label: "Select", action: "master-teacher:select" },
  ],
  Teachers: [
    { label: "Add Teacher", action: "teacher:add" },
    { label: "Upload file", action: "teacher:upload" },
    { label: "Select", action: "teacher:select" },
  ],
};

interface AccountActionsMenuProps {
  accountType: AccountType;
  onAction?: (action: AccountActionKey) => boolean | void;
  buttonAriaLabel?: string;
  className?: string;
  exportConfig?: {
    label?: string;
    disabled?: boolean;
    onExport: () => void;
  };
  downloadTemplateConfig?: {
    disabled?: boolean;
    onDownload: () => void;
  };
}

export default function AccountActionsMenu({
  accountType,
  onAction,
  buttonAriaLabel = "Open add account menu",
  className = "",
  exportConfig,
  downloadTemplateConfig,
}: AccountActionsMenuProps) {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  const actions = ACCOUNT_ACTIONS[accountType];
  const selectAction = actions.find((item) => item.action.includes(":select"));
  const addAction = actions.find((item) => item.action.includes(":add"));
  const uploadAction = actions.find((item) => item.action.includes(":upload"));

  const handleMenuClose = useCallback(() => {
    setIsAddMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!isAddMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (addMenuRef.current && target && !addMenuRef.current.contains(target)) {
        setIsAddMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAddMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isAddMenuOpen]);

  const handleAction = useCallback(
    (action: AccountActionKey) => {
      const result = onAction?.(action);
      return result !== false;
    },
    [onAction],
  );

  const handleExportClick = useCallback(() => {
    if (exportConfig?.disabled) {
      return;
    }
    exportConfig?.onExport();
  }, [exportConfig]);

  const utilityButtonClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        {selectAction ? (
          <button
            type="button"
            onClick={() => {
              void handleAction(selectAction.action);
            }}
            className={utilityButtonClass}
            aria-label="Select"
            title="Select"
          >
            <SelectIcon />
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleExportClick}
          className={`${utilityButtonClass} ${exportConfig?.disabled ? "cursor-not-allowed opacity-60" : ""}`}
          aria-label="Export to Excel"
          title="Export to Excel"
          disabled={exportConfig?.disabled}
        >
          <ExportIcon />
        </button>

        <div className="relative" ref={addMenuRef}>
          <button
            type="button"
            onClick={() => setIsAddMenuOpen((prev) => !prev)}
            className="inline-flex h-10 items-center gap-2 rounded-full border-2 border-[#013300] bg-[#013300] px-4 text-sm font-semibold text-white shadow-sm transition hover:border-green-900 hover:bg-green-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            aria-haspopup="menu"
            aria-expanded={isAddMenuOpen}
            aria-label={buttonAriaLabel}
            title="Add Account"
          >
            <span>Add Account</span>
            <ChevronDownIcon />
          </button>

          {isAddMenuOpen ? (
            <div
              role="menu"
              aria-label="Add Account options"
              className="absolute right-0 z-30 mt-2 w-48 rounded-xl border border-gray-200 bg-white p-1 shadow-[0_16px_32px_rgba(15,23,42,0.16)]"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (addAction && handleAction(addAction.action)) {
                    handleMenuClose();
                  }
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                Add Individual
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (uploadAction && handleAction(uploadAction.action)) {
                    handleMenuClose();
                  }
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                Upload List
              </button>

              {downloadTemplateConfig ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (downloadTemplateConfig.disabled) {
                      return;
                    }
                    downloadTemplateConfig.onDownload();
                    handleMenuClose();
                  }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    downloadTemplateConfig.disabled
                      ? "cursor-not-allowed text-slate-300"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  aria-disabled={downloadTemplateConfig.disabled}
                >
                  Download Template
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
