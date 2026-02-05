"use client";

import React from "react";
import { StudentDetails } from "@/lib/performance";

interface PerformancePageProps {
  student: StudentDetails | null;
  performance: any[];
}

export default function PerformancePage({ student, performance }: PerformancePageProps) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Performance for {student?.first_name} {student?.last_name}
      </h1>
      <div className="bg-white shadow rounded-lg p-4">
         <p>Performance records found: {performance.length}</p>
         <ul className="list-disc pl-5 mt-4">
           {performance.map((p, i) => (
             <li key={i} className="mb-2">
               <strong>{p.activity_title || "Untitled Activity"}</strong> - Score: {p.score}/{p.total_items} ({p.grade || "N/A"})
               <br/>
               <span className="text-sm text-gray-500">
                 {p.activity_date ? new Date(p.activity_date).toLocaleDateString() : "No Date"}
               </span>
             </li>
           ))}
         </ul>
      </div>
    </div>
  );
}
