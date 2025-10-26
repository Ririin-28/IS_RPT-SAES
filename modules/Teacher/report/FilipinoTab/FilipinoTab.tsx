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
		learner: "Abalos, Jennica Mae",
		section: "III-Malaya",
		preAssessment: "NR",
		october: "NR",
		december: "SylR",
		midYear: "WR",
		postAssessment: "WR",
		endingProfile: "WR",
	},
	{
		learner: "Castro, Eliza Joy",
		section: "III-Matalino",
		preAssessment: "SylR",
		october: "WR",
		december: "WR",
		midYear: "PhR",
		postAssessment: "PhR",
		endingProfile: "PhR",
	},
	{
		learner: "Dela Cruz, Jericho",
		section: "III-Masigasig",
		preAssessment: "WR",
		october: "WR",
		december: "PhR",
		midYear: "SR",
		postAssessment: "SR",
		endingProfile: "SR",
	},
	{
		learner: "Escobar, Hannah",
		section: "III-Matalas",
		preAssessment: "SylR",
		october: "WR",
		december: "WR",
		midYear: "PhR",
		postAssessment: "SR",
		endingProfile: "SR",
	},
	{
		learner: "Guzman, Francine",
		section: "III-Matalino",
		preAssessment: "WR",
		october: "PhR",
		december: "SR",
		midYear: "SR",
		postAssessment: "PR",
		endingProfile: "PR",
	},
	{
		learner: "Villanueva, Mico",
		section: "III-Masigasig",
		preAssessment: "NR",
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

export default function FilipinoReportTab() {
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
