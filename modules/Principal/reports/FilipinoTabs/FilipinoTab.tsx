"use client";
import ReportsTabContent from "../ReportsTabContent";

interface FilipinoTabProps {
  searchTerm: string;
  gradeLevel?: string;
}

export default function FilipinoTab({ searchTerm, gradeLevel }: FilipinoTabProps) {
  return <ReportsTabContent searchTerm={searchTerm} gradeLevel={gradeLevel} subject="filipino" />;
}
