import React from "react";

/*
DangerButton is used for:
- Delete
- Archive
*/
export default function DangerButton({
  children,
  className = "",
  small = false,
  ...props
}: React.PropsWithChildren<{ className?: string; small?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const sizeClasses = small ? "px-3 py-1.5 text-sm" : "px-6 py-3";
  return (
    <button className={`border-3 border-red-600 text-white font-bold rounded-lg bg-red-600 hover:bg-red-800 transition ${sizeClasses} ${className}`} 
    {...props}>
      {children}
    </button>
  );
}

