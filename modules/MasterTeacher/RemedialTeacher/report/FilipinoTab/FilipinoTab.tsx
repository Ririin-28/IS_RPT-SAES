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

export default function FilipinoReportTab({ rows, editable, onCellChange }: RemedialReportComponentProps) {
  return (
    <div className="space-y-6 text-black">
      <div className="overflow-x-auto border border-gray-300">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="border border-gray-300 p-3 text-left font-semibold">Pangalan ng Mag-aaral</th>
              <th rowSpan={2} className="border border-gray-300 p-3 text-left font-semibold">Seksyon</th>
              <th rowSpan={2} className="border border-gray-300 p-3 text-center font-semibold">Paunang Pagsusuri<br />Setyembre</th>
              <th colSpan={3} className="border border-gray-300 p-3 text-center font-semibold">School-Based Reading Assessment</th>
              <th rowSpan={2} className="border border-gray-300 p-3 text-center font-semibold">Pagtatapos na Pagsusuri<br />Marso</th>
              <th rowSpan={2} className="border border-gray-300 p-3 text-center font-semibold">Pangwakas na<br />Numeracy Profile</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 p-3 text-center font-semibold">Oktubre</th>
              <th className="border border-gray-300 p-3 text-center font-semibold">Disyembre</th>
              <th className="border border-gray-300 p-3 text-center font-semibold">Mid-Year<br />Assessment<br />Pebrero</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="border border-gray-300 p-6 text-center text-sm text-gray-500" colSpan={8}>
                  Walang mag-aaral na naka-assign sa gurong ito para sa asignaturang ito.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-3">{row.learner}</td>
                  <td className="border border-gray-300 p-3 text-center">{row.section || "—"}</td>
                  <td className="border border-gray-300 p-3 text-center">
                    {renderCell(row.preAssessment, editable, (value) => onCellChange(index, "preAssessment", value))}
                  </td>
                  <td className="border border-gray-300 p-3 text-center">
                    {renderCell(row.october, editable, (value) => onCellChange(index, "october", value))}
                  </td>
                  <td className="border border-gray-300 p-3 text-center">
                    {renderCell(row.december, editable, (value) => onCellChange(index, "december", value))}
                  </td>
                  <td className="border border-gray-300 p-3 text-center">
                    {renderCell(row.midYear, editable, (value) => onCellChange(index, "midYear", value))}
                  </td>
                  <td className="border border-gray-300 p-3 text-center">
                    {renderCell(row.postAssessment, editable, (value) => onCellChange(index, "postAssessment", value))}
                  </td>
                  <td className="border border-gray-300 p-3 text-center">
                    {renderCell(row.endingProfile, editable, (value) => onCellChange(index, "endingProfile", value))}
                  </td>
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