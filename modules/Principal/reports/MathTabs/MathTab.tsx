"use client";
import ReportsTabContent from "../ReportsTabContent";

interface MathTabProps {
  searchTerm: string;
  gradeLevel?: string;
}

export default function MathTab({ searchTerm, gradeLevel }: MathTabProps) {
  return <ReportsTabContent searchTerm={searchTerm} gradeLevel={gradeLevel} subject="math" />;
}
