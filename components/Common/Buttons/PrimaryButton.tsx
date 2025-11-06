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
  const { disabled, ...restProps } = props;
  const sizeClasses = small ? "px-3 py-1.5 text-sm" : "px-6 py-3";
  const widthClass = fullWidth ? "w-full" : "";
  const enabledStateClasses = "bg-[#013300] border-[#013300] hover:bg-green-900 hover:border-green-900";
  const disabledStateClasses = "bg-[#8ca28f] border-[#8ca28f] cursor-not-allowed opacity-70";
  return (
    <button
      className={`border-3 text-white font-bold rounded-lg transition ${
        disabled ? disabledStateClasses : enabledStateClasses
      } ${sizeClasses} ${widthClass} ${className}`}
      disabled={disabled}
      {...restProps}
    >
      {children}
    </button>
  );
}

