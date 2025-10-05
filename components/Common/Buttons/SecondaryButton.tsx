import React from "react";

/*
SecondaryButton is used for:
- Cancel
- Back
*/
export default function SecondaryButton({
  children,
  className = "",
  small = false,
  ...props
}: React.PropsWithChildren<{ className?: string; small?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const sizeClasses = small ? "px-3 py-1.5 text-sm" : "px-6 py-3";
  return (
    <button
      className={`bg-transparent text-[#013300] font-semibold rounded-lg hover:bg-green-50 transition ${sizeClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

