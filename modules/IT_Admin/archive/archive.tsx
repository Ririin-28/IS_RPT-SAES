"use client";
import { useMemo, useState } from "react";
import ITAdminHeader from "@/components/IT_Admin/Header";
import ITAdminSidebar from "@/components/IT_Admin/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import { FaTimes } from "react-icons/fa";

type ArchiveRecord = {
	id: number;
	user_id: string;
	name: string;
	role: string;
	reason: string;
	timestamp: string;
};

const initialArchiveRecords: ArchiveRecord[] = [
	{
		id: 1,
		user_id: "USR-001",
		name: "John Reyes",
		role: "Teacher",
		reason: "Resigned",
		timestamp: "2025-09-18T08:22:10Z",
	},
	{
		id: 2,
		user_id: "USR-024",
		name: "Maria Santos",
		role: "Master Teacher",
		reason: "Transferred",
		timestamp: "2025-09-12T15:40:00Z",
	},
	{
		id: 3,
		user_id: "USR-107",
		name: "Alex Cruz",
		role: "Principal",
		reason: "System Cleanup",
		timestamp: "2025-09-02T10:05:33Z",
	},
	{
		id: 4,
		user_id: "USR-305",
		name: "Lea Mendoza",
		role: "IT Admin",
		reason: "Duplicate Account",
		timestamp: "2025-08-28T21:11:48Z",
	},
];

const formatTimestamp = (value: string) => {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return parsed.toLocaleString("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
};

export default function ITAdminArchive() {
	const [records, setRecords] = useState<ArchiveRecord[]>(initialArchiveRecords);
	const [searchTerm, setSearchTerm] = useState("");
	const [selectMode, setSelectMode] = useState(false);
	const [selectedRecords, setSelectedRecords] = useState<Set<number>>(new Set());

	const filteredRecords = useMemo(() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) return records;
		return records.filter((record) =>
			[
				record.user_id,
				record.name,
				record.role,
				record.reason,
				formatTimestamp(record.timestamp),
			]
				.join(" ")
				.toLowerCase()
				.includes(term)
		);
	}, [records, searchTerm]);

	const handleSelectAll = (checked: boolean) => {
		if (checked) {
			setSelectedRecords(new Set(filteredRecords.map((record) => record.id)));
		} else {
			setSelectedRecords(new Set());
		}
	};

	const handleSelectRecord = (id: number, checked: boolean) => {
		setSelectedRecords((prev) => {
			const updated = new Set(prev);
			if (checked) {
				updated.add(id);
			} else {
				updated.delete(id);
			}
			return updated;
		});
	};

	const exitSelectMode = () => {
		setSelectMode(false);
		setSelectedRecords(new Set());
	};

	const handleRestore = (ids: Set<number>) => {
		if (ids.size === 0) return;
		setRecords((prev) => prev.filter((record) => !ids.has(record.id)));
		exitSelectMode();
	};

	const handleDelete = (ids: Set<number>) => {
		if (ids.size === 0) return;
		if (!window.confirm(`Permanently delete ${ids.size} archived entr${ids.size > 1 ? "ies" : "y"}? This cannot be undone.`)) {
			return;
		}
		setRecords((prev) => prev.filter((record) => !ids.has(record.id)));
		exitSelectMode();
	};

	const handleSingleRestore = (id: number) => {
		handleRestore(new Set([id]));
	};

	const handleSingleDelete = (id: number) => {
		handleDelete(new Set([id]));
	};

	const handleClearArchive = () => {
		if (records.length === 0) return;
		if (!window.confirm("Clear all archived records? This action cannot be undone.")) {
			return;
		}
		setRecords([]);
		exitSelectMode();
	};

	return (
		<div className="flex h-screen bg-white overflow-hidden">
			<ITAdminSidebar />
			<div className="flex-1 pt-16 flex flex-col overflow-hidden">
				<ITAdminHeader title="Archive" />
				<main className="flex-1">
					<div className="p-4 h-full sm:p-5 md:p-6">
						<div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
							<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
								<div className="flex flex-col gap-1">
									<SecondaryHeader title="Archived Accounts" />
									<p className="text-gray-600 text-md font-medium">Total: {filteredRecords.length}</p>
								</div>
								<div className="flex flex-col gap-2 w-full sm:w-64 items-start sm:items-end">
									<div className="relative w-full">
										<input
											type="text"
											placeholder="Search archive..."
											className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 text-black"
											value={searchTerm}
											onChange={(e) => setSearchTerm(e.target.value)}
										/>
										{searchTerm && (
											<button
												className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
												onClick={() => setSearchTerm("")}
												aria-label="Clear search"
											>
												<FaTimes />
											</button>
										)}
									</div>
									<div className="self-end">
										<KebabMenu
											small
											renderItems={(close) => (
												<div className="py-1">
													<button
														onClick={() => {
															setSelectMode(true);
															close();
														}}
														className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50"
													>
														Enter select mode
													</button>
													<button
														onClick={() => {
															handleClearArchive();
															close();
														}}
														className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
													>
														Clear archive
													</button>
												</div>
										)}
										/>
									</div>
								</div>
							</div>

							<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
								{selectMode ? (
									<div className="flex items-center gap-2">
										<SecondaryButton small onClick={exitSelectMode}>
											Cancel
										</SecondaryButton>
										{selectedRecords.size > 0 && (
											<>
																		<UtilityButton small onClick={() => handleRestore(new Set(selectedRecords))}>
													Restore ({selectedRecords.size})
												</UtilityButton>
																		<DangerButton small onClick={() => handleDelete(new Set(selectedRecords))}>
													Delete ({selectedRecords.size})
												</DangerButton>
											</>
										)}
									</div>
								) : null}
							</div>

							<TableList
								columns={[
									{ key: "no", title: "No." },
									{ key: "user_id", title: "User ID" },
									{ key: "name", title: "Name" },
									{ key: "role", title: "Role" },
									{ key: "reason", title: "Reason" },
									{
										key: "timestamp",
										title: "Timestamp",
										render: (row) => formatTimestamp(row.timestamp),
									},
								]}
								data={filteredRecords.map((record, idx) => ({
									...record,
									no: idx + 1,
								}))}
								selectable={selectMode}
								selectedItems={selectedRecords}
								onSelectAll={handleSelectAll}
								onSelectItem={handleSelectRecord}
								actions={(row) => (
									<>
										<UtilityButton small onClick={() => handleSingleRestore(row.id)}>
											Restore
										</UtilityButton>
										<DangerButton small onClick={() => handleSingleDelete(row.id)}>
											Delete
										</DangerButton>
									</>
								)}
								pageSize={10}
							/>
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}
