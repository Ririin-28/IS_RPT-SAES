"use client";

import UtilityButton from "@/components/Common/Buttons/UtilityButton";

type PaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
};

export default function Pagination({
  page,
  totalPages,
  totalItems,
  onPrev,
  onNext,
  className = "",
}: PaginationProps) {
  return (
    <div className={`mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 ${className}`}>
      <p className="text-sm text-gray-600">
        Page {page} of {totalPages} | Total {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <UtilityButton small onClick={onPrev} disabled={page <= 1}>
          Previous
        </UtilityButton>
        <UtilityButton small onClick={onNext} disabled={page >= totalPages}>
          Next
        </UtilityButton>
      </div>
    </div>
  );
}
