"use client";

import { useCallback, type ReactElement } from "react";
import KebabMenu from "@/components/Common/Menus/KebabMenu";

export type AccountType = "Principal" | "IT Admin" | "Master Teachers" | "Teachers";

export type AccountActionKey =
  | "principal:add"
  | "principal:select"
  | "it-admin:add"
  | "it-admin:select"
  | "master-teacher:add"
  | "master-teacher:upload"
  | "master-teacher:select"
  | "teacher:add"
  | "teacher:upload"
  | "teacher:select";

type ActionConfig = {
  label: string;
  action: AccountActionKey;
  icon: ReactElement;
};

const AddIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
  </svg>
);

const UploadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m17 8-5-5-5 5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  </svg>
);

const SelectIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
  </svg>
);

const ACCOUNT_ACTIONS: Record<AccountType, ActionConfig[]> = {
  Principal: [
    { label: "Add Principal", action: "principal:add", icon: <AddIcon /> },
    { label: "Select", action: "principal:select", icon: <SelectIcon /> },
  ],
  "IT Admin": [
    { label: "Add IT Admin", action: "it-admin:add", icon: <AddIcon /> },
    { label: "Select", action: "it-admin:select", icon: <SelectIcon /> },
  ],
  "Master Teachers": [
    { label: "Add MasterTeacher", action: "master-teacher:add", icon: <AddIcon /> },
    { label: "Upload file", action: "master-teacher:upload", icon: <UploadIcon /> },
    { label: "Select", action: "master-teacher:select", icon: <SelectIcon /> },
  ],
  Teachers: [
    { label: "Add Teacher", action: "teacher:add", icon: <AddIcon /> },
    { label: "Upload file", action: "teacher:upload", icon: <UploadIcon /> },
    { label: "Select", action: "teacher:select", icon: <SelectIcon /> },
  ],
};

interface AccountActionsMenuProps {
  accountType: AccountType;
  onAction?: (action: AccountActionKey) => boolean | void;
  buttonAriaLabel?: string;
  className?: string;
}

export default function AccountActionsMenu({
  accountType,
  onAction,
  buttonAriaLabel = "Open menu",
  className = "",
}: AccountActionsMenuProps) {
  const handleAction = useCallback(
    (action: AccountActionKey, close: () => void) => {
      const result = onAction?.(action);
      if (result !== false) {
        close();
      }
    },
    [onAction],
  );

  return (
    <KebabMenu
      small
      align="right"
      className={className}
      buttonAriaLabel={buttonAriaLabel}
      renderItems={(close) => (
        <div className="py-1">
          {ACCOUNT_ACTIONS[accountType].map(({ label, action, icon }) => (
            <button
              key={action}
              onClick={() => handleAction(action, close)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50"
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}
    />
  );
}
