import React from "react";

/*
TertiaryHeader is used for:
- Table headers
- Subject titles
*/
export default function TertiaryHeader({ title, className }: { title: string; className?: string }) {
  // Sanitize the title to prevent XSS attacks
  const sanitizedTitle = typeof title === 'string' ? title : '';
  const defaultClasses = "text-xl font-semibold text-[#013300] mb-2";
  const finalClasses = className ? className : defaultClasses;
  return <h2 className={finalClasses}>{sanitizedTitle}</h2>;
}

