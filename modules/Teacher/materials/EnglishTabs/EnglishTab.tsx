"use client";
import { useMemo, useRef, useState, useEffect, type ChangeEvent } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
import { useMaterialsList } from "@/modules/MasterTeacher/useArchiveMaterials";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";

export const ENGLISH_LEVELS = [
	"Non Reader",
	"Syllable",
	"Word",
	"Phrase",
	"Sentence",
	"Paragraph",
] as const;

export type EnglishLevel = (typeof ENGLISH_LEVELS)[number];

type MaterialItem = {
	id: number | string;
	title: string;
	dateAttached: string;
};

const normalizeId = (value: number | string) => String(value);

interface EnglishTabProps {
	level: EnglishLevel;
	searchTerm?: string;
}

export default function EnglishTab({ level, searchTerm = "" }: EnglishTabProps) {
	const { materials, setMaterials } = useMaterialsList<MaterialItem>({
		subject: "English",
		category: level,
	});

	const [selectMode, setSelectMode] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<MaterialItem["id"]>>(new Set());
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);
	const [showUploadConfirm, setShowUploadConfirm] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

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

	useEffect(() => {
		if (!selectMode) return;
		const available = new Set(filteredMaterials.map((item) => normalizeId(item.id)));
		setSelectedIds((prev) => {
			const next = new Set<MaterialItem["id"]>();
			prev.forEach((value) => {
				if (available.has(normalizeId(value))) {
					next.add(value);
				}
			});
			if (next.size === prev.size) {
				let identical = true;
				prev.forEach((value) => {
					if (!next.has(value)) {
						identical = false;
					}
				});
				if (identical) {
					return prev;
				}
			}
			return next;
		});
	}, [filteredMaterials, selectMode]);

	const handleSelectItem = (id: MaterialItem["id"], checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) {
				next.add(id);
			} else {
				next.delete(id);
			}
			return next;
		});
	};

	const handleSelectAll = (checked: boolean) => {
		if (checked) {
			setSelectedIds(new Set(filteredMaterials.map((item) => item.id)));
		} else {
			setSelectedIds(new Set());
		}
	};

	const exitSelectMode = () => {
		setSelectMode(false);
		setSelectedIds(new Set());
	};

	const handleDeleteSelected = () => {
		if (selectedIds.size === 0) return;
		const normalized = new Set(Array.from(selectedIds).map((value) => normalizeId(value)));
		setMaterials((prev) => prev.filter((material) => !normalized.has(normalizeId(material.id))));
		exitSelectMode();
	};

	const handleUploadFiles = (event: ChangeEvent<HTMLInputElement>) => {
		const { files } = event.target;
		if (!files || files.length === 0) return;
		setPendingFiles(Array.from(files));
		setShowUploadConfirm(true);
	};

	const triggerUpload = () => {
		fileInputRef.current?.click();
	};

	const selectedCount = selectedIds.size;
	const pendingFileNames = useMemo(() => pendingFiles.map((file) => file.name).join(", "), [pendingFiles]);

	const handleUploadCancel = () => {
		setShowUploadConfirm(false);
		setPendingFiles([]);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleUploadConfirm = () => {
		if (pendingFiles.length === 0) {
			handleUploadCancel();
			return;
		}
		const timestamp = Date.now();
		const formattedDate = new Date().toLocaleDateString("en-PH", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
		setMaterials((prev) => [
			...prev,
			...pendingFiles.map((file, index) => ({
				id: `upload-${timestamp}-${index}`,
				title: file.name,
				dateAttached: formattedDate,
			})),
		]);
		handleUploadCancel();
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
				<div className="flex gap-2 items-center">
					{selectMode ? (
						<>
							<UtilityButton small onClick={exitSelectMode}>
								Cancel
							</UtilityButton>
							{selectedCount > 0 && (
								<DangerButton small onClick={handleDeleteSelected}>
									Delete ({selectedCount})
								</DangerButton>
							)}
						</>
					) : (
						<>
							<KebabMenu
								small
								renderItems={(close) => (
									<div className="py-1">
										<button
											onClick={() => {
												triggerUpload();
												close();
											}}
											className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
										>
											<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
												<path strokeLinecap="round" strokeLinejoin="round" d="m17 8-5-5-5 5" />
												<path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
											</svg>
											Upload File
										</button>
										<button
											onClick={() => {
												setSelectMode(true);
												close();
											}}
											className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
										>
											<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
												<rect x="3" y="3" width="18" height="18" rx="2" />
												<path d="M9 12l2 2 4-4" />
											</svg>
											Select
										</button>
									</div>
								)}
							/>
						</>
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
						<UtilityButton small>See All</UtilityButton>
					</>
				)}
				pageSize={10}
				selectable={selectMode}
				selectedItems={selectedIds}
				onSelectAll={handleSelectAll}
				onSelectItem={handleSelectItem}
			/>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				onChange={handleUploadFiles}
				className="hidden"
			/>
			<ConfirmationModal
				isOpen={showUploadConfirm}
				onClose={handleUploadCancel}
				onConfirm={handleUploadConfirm}
				title="Confirm File Upload"
				message="Upload the selected file(s) to this materials list?"
				fileName={pendingFileNames || undefined}
			/>
		</div>
	);
}
