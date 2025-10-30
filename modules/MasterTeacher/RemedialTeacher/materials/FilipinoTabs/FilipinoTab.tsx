"use client";
import { useMemo } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
import { useMaterialsList } from "@/modules/MasterTeacher/useArchiveMaterials";

export const FILIPINO_LEVELS = [
	"Non Reader",
	"Syllable",
	"Word",
	"Phrase",
	"Sentence",
	"Paragraph",
] as const;

export type FilipinoLevel = (typeof FILIPINO_LEVELS)[number];

type MaterialItem = {
	id: number | string;
	title: string;
	dateAttached: string;
};

const normalizeId = (value: number | string) => String(value);

interface FilipinoTabProps {
	level: FilipinoLevel;
	searchTerm?: string;
}

export default function FilipinoTab({ level, searchTerm = "" }: FilipinoTabProps) {
	const { materials, setMaterials } = useMaterialsList<MaterialItem>({
		subject: "Filipino",
		category: level,
	});

	const normalizedSearch = searchTerm.trim().toLowerCase();

	const filteredMaterials = useMemo(() => {
		if (!normalizedSearch) return materials;
		return materials.filter((material) => {
			const title = material.title?.toLowerCase() ?? "";
			const date = material.dateAttached?.toLowerCase() ?? "";
			return title.includes(normalizedSearch) || date.includes(normalizedSearch);
		});
	}, [materials, normalizedSearch]);

	const rows = useMemo(
		() =>
			filteredMaterials.map((material, index) => ({
				...material,
				no: index + 1,
			})),
		[filteredMaterials]
	);

	const handleDelete = (id: number | string) => {
		setMaterials((prev) => prev.filter((material) => normalizeId(material.id) !== normalizeId(id)));
	};

	const handleDeleteAll = () => {
		setMaterials([]);
	};

	return (
		<div>
			<div
				className="
				/* Mobile */
				flex flex-row justify-between items-center mb-4
				/* Tablet */
				sm:mb-6
				/* Desktop */
				md:mb-2
			"
			>
				<p className="text-gray-600 text-md font-medium">Total: {materials.length}</p>
				<div className="flex gap-2">
					<UtilityButton small>
						<span className="flex items-center gap-1">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
							</svg>
							<span className="hidden sm:inline">Requests</span>
						</span>
					</UtilityButton>
					{materials.length > 0 && (
						<DangerButton small onClick={handleDeleteAll}>
							Burahin Lahat
						</DangerButton>
					)}
				</div>
			</div>
			<TableList
				columns={[
					{ key: "no", title: "No#" },
					{ key: "title", title: "Title" },
					{ key: "dateAttached", title: "Date Attached" },
				]}
				data={rows}
				actions={(row: any) => (
					<>
						<UtilityButton small>Ipakita Lahat</UtilityButton>
						<DangerButton small onClick={() => handleDelete(row.id)}>
							Burahin
						</DangerButton>
					</>
				)}
				pageSize={10}
			/>
		</div>
	);
}
