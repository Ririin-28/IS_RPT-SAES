"use client";

import type { RemedialReportComponentProps } from "../types";

const legend = [
  "NR - Non-Reader",
  "SylR - Syllable Reader",
  "WR - Word Reader",
  "PhR - Phrase Reader",
  "SR - Sentence Reader",
  "PR - Paraphrase Reader",
];

const renderCell = (
  value: string,
  editable: boolean,
  onChange: (nextValue: string) => void,
) => {
  if (!editable) {
    return value || "—";
  }
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-[#013300] focus:outline-none"
    />
  );
};

export default function EnglishReportTab({ rows, editable, onCellChange, monthColumns, quarterGroups }: RemedialReportComponentProps) {
  return (
    <div className="space-y-6 text-black">
      <div className="overflow-x-auto border border-gray-300">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="border border-gray-300 p-3 text-left font-semibold">Name of Learners</th>
              <th rowSpan={2} className="border border-gray-300 p-3 text-left font-semibold">Section</th>
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
                <td className="border border-gray-300 p-6 text-center text-sm text-gray-500" colSpan={2 + monthColumns.length}>
                  No students found for this subject.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-3">{row.learner}</td>
                  <td className="border border-gray-300 p-3 text-center">{row.section || "—"}</td>
                  {monthColumns.map((column) => (
                    <td key={column.key} className="border border-gray-300 p-3 text-center">
                      {renderCell(
                        row.monthValues?.[column.key] ?? "",
                        editable,
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

      <div className="grid gap-1 text-sm">
        <p className="font-semibold">Legend:</p>
        {legend.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </div>
  );
}