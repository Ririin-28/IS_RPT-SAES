"use client";

import BaseModal, { ModalLabel } from "@/components/Common/Modals/BaseModal";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

interface DeleteConfirmationModalProps {
	show: boolean;
	onClose: () => void;
	onConfirm: () => void;
	entityLabel?: string;
	description?: string;
}

export default function DeleteConfirmationModal({
	show,
	onClose,
	onConfirm,
	entityLabel = "item",
	description,
}: DeleteConfirmationModalProps) {
	const footer = (
		<>
			<SecondaryButton type="button" onClick={onClose}>
				Cancel
			</SecondaryButton>
			<DangerButton type="button" onClick={onConfirm}>
				Delete
			</DangerButton>
		</>
	);

	return (
		<BaseModal
			show={show}
			onClose={onClose}
			title="Delete Confirmation"
			maxWidth="sm"
			footer={footer}
		>
			<div className="space-y-4">
				<ModalLabel>
					Are you sure you want to delete this {entityLabel}?
				</ModalLabel>
				<p className="text-sm text-gray-600">
					{description ?? "This action cannot be undone and will permanently remove the selected data."}
				</p>
			</div>
		</BaseModal>
	);
}
