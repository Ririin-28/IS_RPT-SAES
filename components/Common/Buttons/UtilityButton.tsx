import React, { useEffect, useRef, useState } from "react";

/*
UtilityButton is used for:
- Edit
- Add
*/
export default function UtilityButton({
  children,
  className = "",
  small = false,
  title,
  ...props
}: React.PropsWithChildren<{ className?: string; small?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimerRef = useRef<number | null>(null);
  const sizeClasses = small ? "px-3 py-1.5 text-sm" : "px-6 py-3";

  const clearTooltipTimer = () => {
    if (tooltipTimerRef.current !== null) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    if (!title) return;
    clearTooltipTimer();
    tooltipTimerRef.current = window.setTimeout(() => {
      setShowTooltip(true);
      tooltipTimerRef.current = null;
    }, 600);
  };

  const handleMouseLeave = () => {
    clearTooltipTimer();
    setShowTooltip(false);
  };

  useEffect(() => () => clearTooltipTimer(), []);
  
  return (
    <div className="relative inline-block">
      <button
        className={`border-3 border-[#013300] text-white font-bold rounded-lg bg-[#013300] hover:border-green-900 hover:bg-green-900 transition ${sizeClasses} ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </button>
      {title && showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-[#2f2f2f] rounded-sm whitespace-nowrap z-50 hidden lg:flex">
          {title}
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2f2f2f]"></div>
        </div>
      )}
    </div>
  );
}