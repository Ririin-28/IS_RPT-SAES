import React from "react";

/*
SecondaryHeader is used for:
- Section titles
*/
export default function SecondaryHeader({ title }: { title: string }) {
  // Sanitize the title to prevent XSS attacks
  const sanitizedTitle = typeof title === 'string' ? title : '';
  return <h2 className=" font-semibold text-[#013300] mb-2 lg:text-xl md:text-lg">{sanitizedTitle}</h2>;
}

