"use client";

import BaseModal, { ModalLabel, ModalSection } from "./BaseModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

export interface AccountCreatedInfo {
  name: string;
  email: string;
  roleLabel: string;
  temporaryPassword?: string;
  identifierLabel?: string | null;
  identifierValue?: string | null;
}

interface AccountCreatedModalProps {
  show: boolean;
  onClose: () => void;
  account?: AccountCreatedInfo | null;
  accounts?: AccountCreatedInfo[] | null;
  title?: string;
  message?: string;
}

export default function AccountCreatedModal({
  show,
  onClose,
  account = null,
  accounts = null,
  title,
  message,
}: AccountCreatedModalProps) {
  const bulkAccounts = Array.isArray(accounts) && accounts.length > 0 ? accounts : null;
  const roleLabel = account?.roleLabel ?? bulkAccounts?.[0]?.roleLabel ?? "Account";
  const defaultMessage = bulkAccounts
    ? `Imported ${bulkAccounts.length} ${roleLabel} account${bulkAccounts.length === 1 ? "" : "s"} successfully. Temporary sign-in credentials were sent to each user's email address.`
    : "Temporary sign-in credentials were sent to this user's email address.";

  const renderAccountCard = (entry: AccountCreatedInfo, key: string) => (
    <div key={key} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <ModalLabel>Name</ModalLabel>
          <div className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
            {entry.name || "--"}
          </div>
        </div>
        <div className="space-y-1">
          <ModalLabel>Email</ModalLabel>
          <div className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 break-all">
            {entry.email || "--"}
          </div>
        </div>
        {entry.identifierLabel && entry.identifierValue ? (
          <div className="space-y-1 sm:col-span-2">
            <ModalLabel>{entry.identifierLabel}</ModalLabel>
            <div className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
              {entry.identifierValue}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title={title ?? (bulkAccounts ? `${roleLabel} Accounts Imported` : `${roleLabel} Added Successfully`)}
      footer={<SecondaryButton onClick={onClose}>Close</SecondaryButton>}
    >
      <div className="mb-4 text-sm text-gray-600">
        {message ?? defaultMessage}
      </div>

      {bulkAccounts ? (
        <ModalSection title="Imported Accounts">
          <div className="space-y-3 max-h-[24rem] overflow-y-auto pr-1">
            {bulkAccounts.map((entry, index) =>
              renderAccountCard(entry, `${entry.email}-${entry.identifierValue ?? index}`),
            )}
          </div>
        </ModalSection>
      ) : account ? (
        <ModalSection title="Account Details">
          {renderAccountCard(account, account.email || "account")}
        </ModalSection>
      ) : null}
    </BaseModal>
  );
}
