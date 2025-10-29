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
    <button className={`border-3 border-red-600 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 hover:border-red-500 transition ${sizeClasses} ${className}`} 
    {...props}> 
      {children}
    </button>
  );
}

