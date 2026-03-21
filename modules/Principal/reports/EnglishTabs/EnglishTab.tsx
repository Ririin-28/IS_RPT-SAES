"use client";
import ReportsTabContent from "../ReportsTabContent";

interface EnglishTabProps {
  searchTerm: string;
  gradeLevel?: string;
}

export default function EnglishTab({ searchTerm, gradeLevel }: EnglishTabProps) {
  return <ReportsTabContent searchTerm={searchTerm} gradeLevel={gradeLevel} subject="english" />;
}
