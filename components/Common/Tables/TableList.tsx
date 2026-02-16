"use client";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import { useEffect, useState } from "react";

interface TableColumn {
  key: string;
  title: React.ReactNode;
  render?: (row: any) => React.ReactNode;
}

interface TableListProps {
  columns: TableColumn[];
  data: any[];
  actions?: (row: any) => React.ReactNode;
  pageSize?: number;
  showFullScreenToggle?: boolean;
  selectable?: boolean;
  selectedItems?: Set<any>;
  onSelectAll?: (checked: boolean) => void;
  onSelectItem?: (id: any, checked: boolean) => void;
  hidePagination?: boolean;
  nonSelectableIds?: Set<any>;
  actionHeaderLabel?: string;
}

export default function TableList({
  columns,
  data,
  actions,
  pageSize = 10,
  showFullScreenToggle = false,
  selectable = false,
  selectedItems = new Set(),
  onSelectAll,
  onSelectItem,
  hidePagination = false,
  nonSelectableIds,
  actionHeaderLabel,
}: TableListProps) {
  const [page, setPage] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const effectivePageSize = Math.min(Math.max(Math.floor(pageSize), 1), 10);
  const totalPages = Math.ceil((data.length || 0) / effectivePageSize);
  const paginatedData = hidePagination
    ? data
    : data.slice((page - 1) * effectivePageSize, page * effectivePageSize);
  const disabledSelectionIds = nonSelectableIds ?? new Set();
  const headerSelectableRows = selectable
    ? data.reduce((count, row) => count + (disabledSelectionIds.has(row.id) ? 0 : 1), 0)
    : 0;
  const allSelectableSelected = selectable && headerSelectableRows > 0 && selectedItems.size === headerSelectableRows;

  useEffect(() => {
    setPage(1);
  }, [data.length, effectivePageSize]);

  useEffect(() => {
    if (totalPages === 0 && page !== 1) {
      setPage(1);
      return;
    }
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const renderFullScreenToggle = (className: string) => (
    <button
      onClick={() => setIsFullScreen(!isFullScreen)}
      className={className}
      aria-label={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
      aria-pressed={isFullScreen}
    >
      {isFullScreen ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m14 10 7-7" />
          <path d="M20 10h-6V4" />
          <path d="m3 21 7-7" />
          <path d="M4 14h6v6" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 3h6v6" />
          <path d="m21 3-7 7" />
          <path d="m3 21 7-7" />
          <path d="M9 21H3v-6" />
        </svg>
      )}
    </button>
  );

  // Updated height classes for better mobile responsiveness
  const bodyMaxHeightClass = isFullScreen
    ? 'max-h-[calc(100vh-8rem)]'
    : 'lg:max-h-[53vh] md:max-h-[62vh] max-h-[59vh]';

  return (
    <div
      className={`w-full flex flex-col ${isFullScreen ? 'fixed inset-0 z-50 bg-white p-6' : 'relative'}`}
      style={isFullScreen ? { height: '100vh' } : undefined}
    >
      {/* Main table container with improved flex behavior */}
      <div className={`relative flex-1 min-h-0 rounded-lg border border-gray-200 bg-white shadow-md ${
        isFullScreen ? '' : 'mb-2' // Add margin bottom only in non-fullscreen
      }`}>
        {showFullScreenToggle && !actions && (
          <div className="absolute right-6 top-0 z-20">
            {renderFullScreenToggle(
              'p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors'
            )}
          </div>
        )}
        <div className={`h-full w-full overflow-auto rounded-lg ${bodyMaxHeightClass}`}>
          <table className="min-w-full text-sm" role="table">
            <thead className="text-[#013300] bg-green-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                {selectable && (
                  <th className="px-4 py-0 text-left w-14">
                    <input
                      type="checkbox"
                      checked={allSelectableSelected}
                      disabled={headerSelectableRows === 0}
                      onChange={(e) => onSelectAll?.(e.target.checked)}
                      className={`w-4 h-4 rounded accent-[#013300] border-2 border-[#013300] ${
                        headerSelectableRows === 0 ? 'cursor-not-allowed opacity-60' : ''
                      }`}
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-2 text-left">
                    {typeof col.title === 'string' ? (
                      <TertiaryHeader title={col.title} className="mb-0" />
                    ) : (
                      col.title
                    )}
                  </th>
                ))}
                {actions && (
                  <th className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-4">
                      <TertiaryHeader title={actionHeaderLabel || "Actions"} className="mb-0" />
                      {renderFullScreenToggle(
                        'p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors'
                      )}
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0)}
                    className="px-4 py-2 text-center text-gray-400"
                  >
                    No data available
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150"
                  >
                    {selectable && (
                      <td className="px-4 py-2 w-14">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(row.id)}
                          disabled={disabledSelectionIds.has(row.id)}
                          onChange={(e) => onSelectItem?.(row.id, e.target.checked)}
                          className={`w-4 h-4 rounded accent-[#013300] border-2 border-[#013300] ${
                            disabledSelectionIds.has(row.id) ? 'cursor-not-allowed opacity-60' : ''
                          }`}
                          title={
                            disabledSelectionIds.has(row.id)
                              ? 'You cannot select this row.'
                              : undefined
                          }
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-2">
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-4 py-2 text-center">
                        <div className="flex gap-2 justify-center">{actions(row)}</div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination - Improved mobile styling */}
      {!hidePagination && data.length > 0 && (
        <div
          className={`flex shrink-0 items-center justify-center gap-1 sm:gap-2 py-2 text-sm sm:text-base border-t border-gray-200 bg-white rounded-lg shadow-sm ${
            isFullScreen ? 'sticky bottom-0 left-0 right-0' : ''
          }`}
        >
          {data.length <= effectivePageSize ? (
            <>
              <UtilityButton small disabled>
                <span className="flex items-center gap-1 opacity-50">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Prev</span>
                </span>
              </UtilityButton>

              <span className="text-gray-500 font-semibold px-2 sm:px-3 py-1.5 rounded bg-gray-100 cursor-default text-xs sm:text-sm">
                1
              </span>

              <UtilityButton small disabled>
                <span className="flex items-center gap-1 opacity-50">
                  <span className="hidden sm:inline">Next</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </UtilityButton>
            </>
          ) : (
            <>
              <UtilityButton
                small
                disabled={page === 1}
                onClick={() => page > 1 && setPage((prev) => Math.max(prev - 1, 1))}
              >
                <span className={`flex items-center gap-1 ${page === 1 ? 'opacity-50' : ''}`}>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Prev</span>
                </span>
              </UtilityButton>

              {/* Dynamic Page Numbers with mobile optimization */}
              {(() => {
                const pages: (number | string)[] = [];
                const maxVisible = window.innerWidth < 640 ? 3 : 5; // Fewer pages on mobile

                if (totalPages <= maxVisible) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  if (page <= 2) { // Show fewer pages on mobile
                    pages.push(1, 2, 3, "...", totalPages);
                  } else if (page >= totalPages - 1) {
                    pages.push(1, "...", totalPages - 2, totalPages - 1, totalPages);
                  } else {
                    pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
                  }
                }

                return pages.map((num, i) =>
                  typeof num === "number" ? (
                    <button
                      key={i}
                      onClick={() => setPage(num)}
                      className={`px-2 sm:px-3 py-1.5 rounded font-semibold transition-colors text-xs sm:text-sm ${
                        num === page
                          ? "bg-green-900 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-green-100"
                      }`}
                    >
                      {num}
                    </button>
                  ) : (
                    <span key={i} className="px-1 sm:px-2 text-gray-400 font-semibold select-none text-xs sm:text-sm">
                      {num}
                    </span>
                  )
                );
              })()}

              <UtilityButton
                small
                disabled={page === totalPages}
                onClick={() => page < totalPages && setPage((prev) => Math.min(prev + 1, totalPages))}
              >
                <span className={`flex items-center gap-1 ${page === totalPages ? 'opacity-50' : ''}`}>
                  <span className="hidden sm:inline">Next</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </UtilityButton>
            </>
          )}
        </div>
      )}
    </div>
  );
}
