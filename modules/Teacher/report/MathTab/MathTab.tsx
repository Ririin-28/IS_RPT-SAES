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
		learner: "Andres, Felicity",
		section: "III-Integrity",
		preAssessment: "NP",
		october: "NP",
		december: "LP",
		midYear: "LP",
		postAssessment: "NPF",
		endingProfile: "NPF",
	},
	{
		learner: "Ballesteros, Nolan",
		section: "III-Integrity",
		preAssessment: "LP",
		october: "LP",
		december: "NPF",
		midYear: "NPF",
		postAssessment: "P",
		endingProfile: "P",
	},
	{
		learner: "Cruz, Justine",
		section: "III-Resilience",
		preAssessment: "NP",
		october: "LP",
		december: "LP",
		midYear: "NPF",
		postAssessment: "P",
		endingProfile: "P",
	},
	{
		learner: "De Guzman, Lianne",
		section: "III-Resilience",
		preAssessment: "LP",
		october: "NPF",
		december: "P",
		midYear: "P",
		postAssessment: "P",
		endingProfile: "P",
	},
	{
		learner: "Escueta, Carlo",
		section: "III-Valor",
		preAssessment: "NP",
		october: "NP",
		december: "LP",
		midYear: "LP",
		postAssessment: "NPF",
		endingProfile: "NPF",
	},
	{
		learner: "Fuentes, Janella",
		section: "III-Valor",
		preAssessment: "NPF",
		october: "NPF",
		december: "P",
		midYear: "P",
		postAssessment: "HP",
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
							<th colSpan={3} className="border border-gray-300 p-3 text-center font-semibold">School-Based Numeracy Assessment</th>
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
