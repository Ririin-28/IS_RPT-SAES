import React from "react";

/*
PrimaryryButton is used for:
- Done
- Save
- Submit
*/
export default function PrimaryButton({
  children,
  className = "",
  small = false,
  fullWidth = false,
  ...props
}: React.PropsWithChildren<{ className?: string; small?: boolean; fullWidth?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const sizeClasses = small ? "px-3 py-1.5 text-sm" : "px-6 py-3";
  const widthClass = fullWidth ? "w-full" : "";
  return (
    <button className={`border-3 border-[#013300] bg-[#013300] text-white font-bold rounded-lg hover:bg-green-900 hover:border-green-900 transition ${sizeClasses} ${widthClass} ${className}`} {...props}>
      {children}
    </button>
  );
}

