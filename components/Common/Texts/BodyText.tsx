import React from "react";

/*
BodyText is used for:
- Body text
- Table content
*/
export default function BodyText({ title }: { title: string }) {
  // Sanitize the title to prevent XSS attacks
  const sanitizedTitle = typeof title === 'string' ? title : '';
  return <p className="text-md font-normal text-black">{sanitizedTitle}</p>;
}

