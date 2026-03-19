"use client";

import type { RemedialReportComponentProps } from "../types";

const normalizeLevelName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const renderCell = (
  value: string,
  editable: boolean,
  locked: boolean,
  levelOptions: string[],
  optionDisabledResolver: ((option: string) => boolean) | null,
  onChange: (nextValue: string) => void,
) => {
  const matchedValue =
    levelOptions.find((option) => normalizeLevelName(option) === normalizeLevelName(value)) ?? value;

  if (!editable || locked) {
    return matchedValue || value || "\u2014";
  }

  return (
    <select
      value={matchedValue}
      onChange={(event) => onChange(event.target.value)}
      className={`mx-auto block w-full max-w-[156px] appearance-none rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm leading-5 shadow-none transition-colors focus:border-slate-300 focus:bg-white focus:outline-none ${
        matchedValue ? "text-gray-900" : "text-slate-400"
      }`}
    >
      <option value="">Select Level</option>
      {levelOptions.map((option) => {
        const isDisabled = optionDisabledResolver?.(option) ?? false;
        return (
          <option
            key={option}
            value={option}
            disabled={isDisabled}
            style={
              isDisabled
                ? { color: "#a8b4c7", backgroundColor: "#f8fafc", cursor: "not-allowed" }
                : { color: "#111827", cursor: "pointer" }
            }
          >
            {option}
          </option>
        );
      })}
    </select>
  );
};

export default function MathReportTab({
  rows,
  editable,
  onCellChange,
  monthColumns,
  quarterGroups,
  showRowNumbers = false,
  lockedFields = [],
  levelOptions = [],
  isOptionDisabled,
}: RemedialReportComponentProps) {
  const lockedFieldSet = new Set(lockedFields);

  return (
    <div className="space-y-6 text-black">
      <div className="overflow-x-auto border border-gray-300">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              {showRowNumbers ? (
                <th rowSpan={2} className="report-row-number-cell border border-gray-300 p-3 text-center font-semibold">
                  No.
                </th>
              ) : null}
              <th rowSpan={2} className="report-learner-cell border border-gray-300 p-3 text-left font-semibold">
                Name of Learners
              </th>
              <th rowSpan={2} className="report-section-cell border border-gray-300 p-3 text-left font-semibold">
                Section
              </th>
              {quarterGroups.map((group) => (
                <th key={group.label} colSpan={group.span} className="border border-gray-300 p-3 text-center font-semibold">
                  {group.label}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50">
              {monthColumns.map((column) => (
                <th key={column.key} className="border border-gray-300 p-3 text-center font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="border border-gray-300 p-6 text-center text-sm text-gray-500"
                  colSpan={(showRowNumbers ? 1 : 0) + 2 + monthColumns.length}
                >
                  No students found for this subject.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {showRowNumbers ? (
                    <td className="report-row-number-cell border border-gray-300 p-3 text-center">{index + 1}</td>
                  ) : null}
                  <td className="report-learner-cell border border-gray-300 p-3">{row.learner}</td>
                  <td className="report-section-cell border border-gray-300 p-3 text-center">{row.section || "\u2014"}</td>
                  {monthColumns.map((column) => (
                    <td
                      key={column.key}
                      className={`border border-gray-300 text-center ${
                        lockedFieldSet.has(column.key)
                          ? "bg-gray-50 px-3 py-3 text-gray-500"
                          : editable
                            ? "bg-slate-50/35 px-2 py-2.5"
                            : "p-3"
                      }`}
                      title={lockedFieldSet.has(column.key) ? "Current month is read-only in the report." : undefined}
                    >
                      {renderCell(
                        row.monthValues?.[column.key] ?? "",
                        editable,
                        lockedFieldSet.has(column.key),
                        levelOptions,
                        isOptionDisabled ? (option) => isOptionDisabled(row, column.key, option) : null,
                        (value) => onCellChange(index, column.key, value),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
