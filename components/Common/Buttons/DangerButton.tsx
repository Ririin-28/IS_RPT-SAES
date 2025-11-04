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
  disabled = false,
  ...props
}: React.PropsWithChildren<{
  className?: string;
  small?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const sizeClasses = small ? "px-3 py-1.5 text-sm" : "px-6 py-3";

  return (
    <button
      className={`border-3 border-red-600 bg-red-600 text-white font-bold rounded-lg transition ${sizeClasses} hover:bg-red-500 hover:border-red-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-red-600 disabled:hover:border-red-600 ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

