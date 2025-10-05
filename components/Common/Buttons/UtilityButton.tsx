import React from "react";

/*
UtilityButton is used for:
- Edit
- Add
*/
export default function UtilityButton({
  children,
  className = "",
  small = false,
  ...props
}: React.PropsWithChildren<{ className?: string; small?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const sizeClasses = small ? "px-3 py-1.5 text-sm" : "px-6 py-3";
  return (
    <button
      className={`border-3 border-[#013300] text-white font-bold rounded-lg bg-[#013300] hover:border-green-900 hover:bg-green-900 transition ${sizeClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

