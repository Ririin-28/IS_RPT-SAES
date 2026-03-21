"use client";

type ReportsEmptyStateProps = {
  hasSearchTerm?: boolean;
};

export default function ReportsEmptyState({ hasSearchTerm = false }: ReportsEmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50">
      <p className="text-gray-500 font-medium">
        {hasSearchTerm ? "No learners match your search." : "No monthly progress report available for this grade."}
      </p>
      <p className="text-gray-400 text-sm mt-1">
        {hasSearchTerm ? "Try a different learner name or section." : "Check back later or view another grade level."}
      </p>
    </div>
  );
}
