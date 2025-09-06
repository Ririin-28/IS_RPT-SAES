import React from "react";

export default function BackButton({ href = "/" }: { href?: string }) {
  return (
    <a href={href} className="absolute top-6 left-4 sm:left-8 z-20 flex items-center text-green-900 hover:underline">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M15.5 19L9 12L15.5 5" stroke="#013300" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="ml-1 text-lg font-medium">Back</span>
    </a>
  );
}

