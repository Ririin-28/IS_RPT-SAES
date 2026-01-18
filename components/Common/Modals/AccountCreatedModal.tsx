"use client";

import { useMemo, useState } from "react";
import BaseModal, { ModalLabel, ModalSection } from "./BaseModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

export interface AccountCreatedInfo {
  name: string;
  email: string;
  temporaryPassword: string;
  roleLabel: string;
}

interface AccountCreatedModalProps {
  show: boolean;
  onClose: () => void;
  account?: AccountCreatedInfo | null;
  accounts?: AccountCreatedInfo[] | null;
  title?: string;
  message?: string;
}

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function AccountCreatedModal({
  show,
  onClose,
  account = null,
  accounts = null,
  title,
  message,
}: AccountCreatedModalProps) {
  const [copied, setCopied] = useState(false);
  const bulkAccounts = Array.isArray(accounts) && accounts.length > 0 ? accounts : null;
  const roleLabel = account?.roleLabel ?? bulkAccounts?.[0]?.roleLabel ?? "Account";

  const csvPayload = useMemo(() => {
    const header = ["Name", "Email", "Temporary Password"]
      .map((value) => escapeCsvValue(value))
      .join(",");

    if (bulkAccounts) {
      const rows = bulkAccounts
        .map((item) => [item.name, item.email, item.temporaryPassword]
          .map((value) => escapeCsvValue(value))
          .join(","))
        .join("\n");
      return rows.length > 0 ? `${header}\n${rows}\n` : "";
    }

    if (!account) return "";
    const row = [account.name, account.email, account.temporaryPassword]
      .map((value) => escapeCsvValue(value))
      .join(",");
    return `${header}\n${row}\n`;
  }, [account, bulkAccounts]);

  const handleCopyPassword = async () => {
    if (!account?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(account.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!account || !csvPayload) return;
    const blob = new Blob([csvPayload], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeRole = roleLabel.replace(/\s+/g, "-").toLowerCase();
    link.download = `${safeRole}-account-passwords.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title={title ?? (bulkAccounts ? `${roleLabel} Accounts Imported` : `${roleLabel} Added Successfully`)}
      footer={
        <SecondaryButton onClick={onClose}>
          Close
        </SecondaryButton>
      }
    >
      {bulkAccounts ? (
        <>
          <ModalSection title="Import Summary">
            <div className="text-sm text-gray-700">
              Imported {bulkAccounts.length} {roleLabel} account{bulkAccounts.length === 1 ? "" : "s"} successfully. You can download the CSV file for passwords.
            </div>
          </ModalSection>

          <div>
            <SecondaryButton type="button" onClick={handleDownloadCsv} disabled={!csvPayload}>
              Download CSV
            </SecondaryButton>
          </div>
        </>
      ) : (
        <>
          <ModalSection title="Account Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <ModalLabel>Name</ModalLabel>
                <div className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-md px-3 py-2 text-sm">
                  {account?.name ?? "—"}
                </div>
              </div>
              <div className="space-y-1">
                <ModalLabel>Email</ModalLabel>
                <div className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-md px-3 py-2 text-sm">
                  {account?.email ?? "—"}
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <ModalLabel>Temporary Password</ModalLabel>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1 w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-md px-3 py-2 text-sm break-all">
                    {account?.temporaryPassword ?? "—"}
                  </div>
                  <PrimaryButton type="button" onClick={handleCopyPassword} disabled={!account?.temporaryPassword}>
                    {copied ? "Copied" : "Copy Password"}
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </ModalSection>

          <div className="text-sm text-gray-600">
            Save this temporary password now. You can copy it or download a CSV for safekeeping.
          </div>

          <div>
            <SecondaryButton type="button" onClick={handleDownloadCsv} disabled={!account?.temporaryPassword}>
              Download CSV
            </SecondaryButton>
          </div>
        </>
      )}
    </BaseModal>
  );
}
