import React, { useState } from "react";

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
  const sizeClasses = small ? "px-3 py-1.5 text-sm" : "px-6 py-3";
  
  return (
    <div className="relative inline-block">
      <button
        className={`border-3 border-[#013300] text-white font-bold rounded-lg bg-[#013300] hover:border-green-900 hover:bg-green-900 transition ${sizeClasses} ${className}`}
        onMouseEnter={() => title && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        {...props}
      >
        {children}
      </button>
      {title && showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-[#2f2f2f] rounded-sm whitespace-nowrap z-50">
          {title}
        </div>
      )}
    </div>
  );
}

