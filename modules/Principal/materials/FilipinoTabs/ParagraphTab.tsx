"use client";
import { useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";

export default function FilipinoParagraphTab() {
	const [materials, setMaterials] = useState<any[]>([]);
	const handleDelete = (id: number) => setMaterials((prev) => prev.filter((material) => material.id !== id));

	return (
		<div>
			<div className="flex flex-row justify-between items-center mb-4 sm:mb-6 md:mb-2">
				<p className="text-gray-600 text-md font-medium">
					Total: {materials.length}
				</p>
			</div>
			<TableList
				columns={[
					{ key: "no", title: "No#" },
					{ key: "title", title: "Title" },
					{ key: "gradeSection", title: "Grade" },
					{ key: "teacher", title: "Teacher" },
					{ key: "dateAttached", title: "Date Attached" },
				]}
				data={materials.map((material, idx) => ({ ...material, no: idx + 1 }))}
				actions={(row: any) => (
					<>
						<UtilityButton small>View Details</UtilityButton>
						<DangerButton small onClick={() => handleDelete(row.id)}>Delete</DangerButton>
					</>
				)}
				pageSize={10}
			/>
		</div>
	);
}
