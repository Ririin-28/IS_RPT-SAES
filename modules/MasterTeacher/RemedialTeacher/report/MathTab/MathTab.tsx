"use client";

type ReportRow = {
  learner: string;
  section: string;
  diagnostic: string;
  quarterOne: string;
  quarterTwo: string;
  quarterThree: string;
  quarterFour: string;
  endingProfile: string;
};

const rows: ReportRow[] = [
  {
    learner: "Andres, Felicity",
    section: "III-Integrity",
    diagnostic: "NP",
    quarterOne: "NP",
    quarterTwo: "LP",
    quarterThree: "LP",
    quarterFour: "NPF",
    endingProfile: "NPF",
  },
  {
    learner: "Ballesteros, Nolan",
    section: "III-Integrity",
    diagnostic: "LP",
    quarterOne: "LP",
    quarterTwo: "NPF",
    quarterThree: "NPF",
    quarterFour: "P",
    endingProfile: "P",
  },
  {
    learner: "Cruz, Justine",
    section: "III-Resilience",
    diagnostic: "NP",
    quarterOne: "LP",
    quarterTwo: "LP",
    quarterThree: "NPF",
    quarterFour: "P",
    endingProfile: "P",
  },
  {
    learner: "De Guzman, Lianne",
    section: "III-Resilience",
    diagnostic: "LP",
    quarterOne: "NPF",
    quarterTwo: "P",
    quarterThree: "P",
    quarterFour: "P",
    endingProfile: "P",
  },
  {
    learner: "Escueta, Carlo",
    section: "III-Valor",
    diagnostic: "NP",
    quarterOne: "NP",
    quarterTwo: "LP",
    quarterThree: "LP",
    quarterFour: "NPF",
    endingProfile: "NPF",
  },
  {
    learner: "Fuentes, Janella",
    section: "III-Valor",
    diagnostic: "NPF",
    quarterOne: "NPF",
    quarterTwo: "P",
    quarterThree: "P",
    quarterFour: "HP",
    endingProfile: "HP",
  },
];

const legend = [
  "NP - Not Proficient",
  "LP - Low Proficient",
  "NPF - Nearly Proficient",
  "P - Proficient",
  "HP - Highly Proficient",
];

export default function MathReportTab() {
  return (
    <div className="space-y-6 text-black">
      <div className="overflow-x-auto border border-gray-300">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="border border-gray-300 p-3 text-left font-semibold">Name of Learners</th>
              <th rowSpan={2} className="border border-gray-300 p-3 text-left font-semibold">Section</th>
              <th rowSpan={2} className="border border-gray-300 p-3 text-center font-semibold">Diagnostic<br />Assessment</th>
              <th colSpan={4} className="border border-gray-300 p-3 text-center font-semibold">Quarterly Assessment Progress</th>
              <th rowSpan={2} className="border border-gray-300 p-3 text-center font-semibold">Ending<br />Numeracy Profile</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 p-3 text-center font-semibold">Q1</th>
              <th className="border border-gray-300 p-3 text-center font-semibold">Q2</th>
              <th className="border border-gray-300 p-3 text-center font-semibold">Q3</th>
              <th className="border border-gray-300 p-3 text-center font-semibold">Q4</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.learner} className="hover:bg-gray-50">
                <td className="border border-gray-300 p-3">{row.learner}</td>
                <td className="border border-gray-300 p-3 text-center">{row.section}</td>
                <td className="border border-gray-300 p-3 text-center">{row.diagnostic}</td>
                <td className="border border-gray-300 p-3 text-center">{row.quarterOne}</td>
                <td className="border border-gray-300 p-3 text-center">{row.quarterTwo}</td>
                <td className="border border-gray-300 p-3 text-center">{row.quarterThree}</td>
                <td className="border border-gray-300 p-3 text-center">{row.quarterFour}</td>
                <td className="border border-gray-300 p-3 text-center">{row.endingProfile}</td>
              </tr>
            ))}
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