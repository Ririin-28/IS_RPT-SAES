"use client";

type ReportRow = {
  learner: string;
  section: string;
  preAssessment: string;
  october: string;
  december: string;
  midYear: string;
  postAssessment: string;
  endingProfile: string;
};

const rows: ReportRow[] = [
  {
    learner: "Agustia, Aiden Richard Paloma",
    section: "III-Crimson",
    preAssessment: "0",
    october: "WR",
    december: "WR",
    midYear: "WR",
    postAssessment: "PhR",
    endingProfile: "PhR",
  },
  {
    learner: "Romano, Gabriel Luis",
    section: "III-Crimson",
    preAssessment: "0",
    october: "WR",
    december: "WR",
    midYear: "WR",
    postAssessment: "PhR",
    endingProfile: "PhR",
  },
  {
    learner: "Sanchez, Eithan Jhara Encinares",
    section: "III-Violet",
    preAssessment: "0",
    october: "WR",
    december: "WR",
    midYear: "WR",
    postAssessment: "SR",
    endingProfile: "SR",
  },
  {
    learner: "Ano, Sebastian Renz Tabianan",
    section: "III-White",
    preAssessment: "5",
    october: "WR",
    december: "WR",
    midYear: "WR",
    postAssessment: "SR",
    endingProfile: "SR",
  },
  {
    learner: "Mauricio, Christian Habonero",
    section: "III-Yellow",
    preAssessment: "11",
    october: "WR",
    december: "WR",
    midYear: "PhR",
    postAssessment: "StoryR",
    endingProfile: "StoryR",
  },
  {
    learner: "Morales, Nyhl Zion",
    section: "III-Blue",
    preAssessment: "16",
    october: "SylR",
    december: "WR",
    midYear: "WR",
    postAssessment: "PhR",
    endingProfile: "PhR",
  },
];

const legend = [
  "NR - Non-Reader",
  "SylR - Syllable Reader",
  "WR - Word Reader",
  "PhR - Phrase Reader",
  "SR - Sentence Reader",
  "PR - Paraphrase Reader",
];

export default function EnglishReportTab() {
  return (
    <div className="space-y-6 text-black">
      <div className="overflow-x-auto border border-gray-300">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="border border-gray-300 p-3 text-left font-semibold">Name of Learners</th>
              <th rowSpan={2} className="border border-gray-300 p-3 text-left font-semibold">Section</th>
              <th rowSpan={2} className="border border-gray-300 p-3 text-center font-semibold">Pre-Assessment<br />September</th>
              <th colSpan={3} className="border border-gray-300 p-3 text-center font-semibold">School-Based Reading Assessment</th>
              <th rowSpan={2} className="border border-gray-300 p-3 text-center font-semibold">Post-Assessment<br />March</th>
              <th rowSpan={2} className="border border-gray-300 p-3 text-center font-semibold">Ending<br />Numeracy Profile</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 p-3 text-center font-semibold">October</th>
              <th className="border border-gray-300 p-3 text-center font-semibold">December</th>
              <th className="border border-gray-300 p-3 text-center font-semibold">Mid-Year<br />Assessment<br />February</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.learner} className="hover:bg-gray-50">
                <td className="border border-gray-300 p-3">{row.learner}</td>
                <td className="border border-gray-300 p-3 text-center">{row.section}</td>
                <td className="border border-gray-300 p-3 text-center">{row.preAssessment}</td>
                <td className="border border-gray-300 p-3 text-center">{row.october}</td>
                <td className="border border-gray-300 p-3 text-center">{row.december}</td>
                <td className="border border-gray-300 p-3 text-center">{row.midYear}</td>
                <td className="border border-gray-300 p-3 text-center">{row.postAssessment}</td>
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