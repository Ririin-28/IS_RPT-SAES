"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type SortMenuItem<T extends string = string> =
  | {
      type?: "option";
      value: T;
      label: string;
      disabled?: boolean;
    }
  | {
      type: "separator";
      id?: string;
    };

export type SortMenuProps<T extends string = string> = {
  value: T;
  items: SortMenuItem<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  iconOnly?: boolean;
  onClearAll?: () => void;
  clearAllLabel?: string;
  clearAllDisabled?: boolean;
  align?: "left" | "right";
  small?: boolean;
  className?: string;
  menuClassName?: string;
  menuWidthClass?: string;
  buttonAriaLabel?: string;
  buttonTitle?: string;
  buttonLabel?: string;
  showSelectedLabel?: boolean;
  iconButtonClassName?: string;
  iconClassName?: string;
};

const SortMenu = <T extends string>({
  value,
  items,
  onChange,
  disabled = false,
  iconOnly = false,
  onClearAll,
  clearAllLabel = "Clear all",
  clearAllDisabled = false,
  align = "right",
  small = false,
  className = "",
  menuClassName = "",
  menuWidthClass = "w-64",
  buttonAriaLabel = "Open sort menu",
  buttonTitle,
  buttonLabel = "Sort",
  showSelectedLabel = false,
  iconButtonClassName,
  iconClassName = "h-4 w-4",
}: SortMenuProps<T>) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const activeLabel = useMemo(() => {
    const selected = items.find((item) => item.type !== "separator" && item.value === value);
    if (!selected || selected.type === "separator") {
      return buttonLabel;
    }
    return showSelectedLabel ? selected.label : buttonLabel;
  }, [buttonLabel, items, showSelectedLabel, value]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        disabled={disabled}
        aria-label={buttonAriaLabel}
        title={buttonTitle}
        className={
          iconOnly
            ? `${
                iconButtonClassName ??
                "inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white/90 p-2 text-[#013300] shadow-sm backdrop-blur transition hover:-translate-y-px hover:border-gray-300 hover:shadow"
              } ${
                disabled ? "opacity-50 cursor-not-allowed" : ""
              }`
            : `inline-flex items-center gap-2 rounded-lg border-2 border-[#013300] bg-[#013300] ${
                small ? "px-3 py-1.5 text-sm" : "px-6 py-3"
              } font-bold text-white hover:bg-green-900 hover:border-green-900 ${
                disabled ? "opacity-50 cursor-not-allowed" : ""
              }`
        }
      >
        <svg className={iconClassName} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 16-4 4-4-4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20V4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m3 8 4-4 4 4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16" />
        </svg>
        {!iconOnly && <span>{activeLabel}</span>}
      </button>
      {open && (
        <div
          className={`absolute ${align === "right" ? "right-0" : "left-0"} mt-2 ${menuWidthClass}
                      bg-white/95 border border-gray-200 rounded-lg shadow-[0_12px_30px_-12px_rgba(15,23,42,0.45)] backdrop-blur
                      z-999 ${menuClassName}`}
          role="menu"
          aria-label="Sort options"
        >
          <div className="py-1">
            {onClearAll && (
              <>
                <button
                  type="button"
                  disabled={clearAllDisabled}
                  onClick={() => {
                    if (clearAllDisabled) return;
                    onClearAll();
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                    clearAllDisabled
                      ? "cursor-not-allowed text-gray-400"
                      : "text-[#013300] hover:bg-gray-50"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                  <span>{clearAllLabel}</span>
                </button>
                <div className="my-1 border-t border-gray-200" />
              </>
            )}
            {items.map((item, index) => {
              if (item.type === "separator") {
                const separatorKey = item.id ?? `separator-${index}`;
                return <div key={separatorKey} className="my-1 border-t border-gray-200" />;
              }
              const isSelected = item.value === value;
              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    onChange(item.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm ${
                    item.disabled
                      ? "cursor-not-allowed text-gray-400"
                      : isSelected
                      ? "bg-emerald-50 text-[#013300]"
                      : "text-[#013300] hover:bg-gray-50"
                  }`}
                  role="menuitemradio"
                  aria-checked={isSelected}
                >
                  <span>{item.label}</span>
                  {isSelected && (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SortMenu;
