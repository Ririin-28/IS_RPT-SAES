import React from "react";

/*
PrimaryHeader is used for:
- Main page titles
*/
export default function PrimaryHeader({ title }: { title: string }) {
  // Sanitize the title to prevent XSS attacks
  const sanitizedTitle = typeof title === 'string' ? title : '';
  return <h1 className="text-2xl font-bold text-[#013300] mb-2">{sanitizedTitle}</h1>;
}
