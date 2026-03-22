"use client";
import { useEffect } from "react";

type ParentWelcomeProps = {
  initialDisplayName?: string;
};

export default function ParentWelcome({ initialDisplayName: _initialDisplayName = "Parent" }: ParentWelcomeProps) {

  useEffect(() => {
    window.location.replace("/Parent/home");
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-white px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className="h-8 w-8 animate-spin rounded-full border-4 border-[#D7E9DB] border-t-[#0C6932]"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-[#58705D]">Redirecting to home...</p>
      </div>
    </div>
  );
}
