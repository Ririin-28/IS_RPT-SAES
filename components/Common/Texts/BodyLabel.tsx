import React from "react";

/*
BodyText is used for:
- Table Attributes
- Form Labels
*/
export default function BodyLabel({ title }: { title: string }) {
  // Sanitize the title to prevent XSS attacks
  const sanitizedTitle = typeof title === 'string' ? title : '';
  return <h3 className="block text-sm font-medium text-gray-700">{sanitizedTitle}</h3>;
}

