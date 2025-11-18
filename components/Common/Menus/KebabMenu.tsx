"use client";
import React, { useEffect, useRef, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";

export type KebabMenuProps = {
  align?: "left" | "right";
  small?: boolean;
  className?: string;
  menuClassName?: string;
  menuWidthClass?: string;
  buttonAriaLabel?: string;
  renderItems: (close: () => void) => React.ReactNode;
};

const KebabMenu: React.FC<KebabMenuProps> = ({
  align = "right",
  small = false,
  className = "",
  menuClassName = "",
  menuWidthClass = "w-48",
  buttonAriaLabel = "Open menu",
  renderItems,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const close = () => setOpen(false);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <UtilityButton small={small} onClick={() => setOpen((v) => !v)} aria-label={buttonAriaLabel}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </UtilityButton>
      {open && (
        <div
          className={`absolute ${align === "right" ? "right-0" : "left-0"} mt-2 ${menuWidthClass} 
                      bg-white border border-gray-200 rounded-md shadow-lg 
                      z-[999] ${menuClassName}`}
          role="menu"
        >
          {renderItems(close)}
        </div>
      )}
    </div>
  );
};

export default KebabMenu;
