"use client";

import { useMemo, useState } from "react";
import BaseModal, { ModalLabel, ModalSection } from "./BaseModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

export interface RestoredAccountInfo {
  name: string;
  email: string;
  temporaryPassword: string;
}

interface AccountRestoredModalProps {
  show: boolean;
  onClose: () => void;
  accounts: RestoredAccountInfo[];
  roleLabel: string;
}

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function AccountRestoredModal({
  show,
  onClose,
  accounts,
  roleLabel,
}: AccountRestoredModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const count = accounts.length;

  const csvPayload = useMemo(() => {
    if (accounts.length === 0) return "";
    const header = ["Name", "Email", "Temporary Password"]
      .map((value) => escapeCsvValue(value))
      .join(",");
    const rows = accounts.map((account) =>
      [account.name, account.email, account.temporaryPassword]
        .map((value) => escapeCsvValue(value))
        .join(","),
    );
    return `${header}\n${rows.join("\n")}\n`;
  }, [accounts]);

  const handleCopy = async (password: string, key: string) => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  };

  const handleDownloadCsv = () => {
    if (!csvPayload) return;
    const blob = new Blob([csvPayload], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeRole = roleLabel.replace(/\s+/g, "-").toLowerCase();
    link.download = `${safeRole}-restored-passwords.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!show) {
    return null;
  }

  const title = count === 1
    ? `${roleLabel} Restored Successfully`
    : `${count} ${roleLabel}${count === 1 ? "" : "s"} Restored`;

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title={title}
      footer={
        <SecondaryButton onClick={onClose}>
          Close
        </SecondaryButton>
      }
    >
      <ModalSection title="Account Details">
        {count === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <ModalLabel>Name</ModalLabel>
              <div className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-md px-3 py-2 text-sm">
                {accounts[0]?.name ?? "—"}
              </div>
            </div>
            <div className="space-y-1">
              <ModalLabel>Email</ModalLabel>
              <div className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-md px-3 py-2 text-sm">
                {accounts[0]?.email ?? "—"}
              </div>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <ModalLabel>Temporary Password</ModalLabel>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1 w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-md px-3 py-2 text-sm break-all">
                  {accounts[0]?.temporaryPassword ?? "—"}
                </div>
                <PrimaryButton
                  type="button"
                  onClick={() => handleCopy(accounts[0]?.temporaryPassword ?? "", accounts[0]?.email ?? "single")}
                  disabled={!accounts[0]?.temporaryPassword}
                >
                  {copiedKey === (accounts[0]?.email ?? "single") ? "Copied" : "Copy Password"}
                </PrimaryButton>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="text-gray-700">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Temporary Password</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {accounts.map((account) => {
                  const key = account.email || account.name;
                  return (
                    <tr key={key}>
                      <td className="px-3 py-2 whitespace-nowrap">{account.name || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{account.email || "—"}</td>
                      <td className="px-3 py-2 break-all">{account.temporaryPassword || "—"}</td>
                      <td className="px-3 py-2">
                        <PrimaryButton
                          type="button"
                          small
                          onClick={() => handleCopy(account.temporaryPassword, key)}
                          disabled={!account.temporaryPassword}
                        >
                          {copiedKey === key ? "Copied" : "Copy"}
                        </PrimaryButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ModalSection>

      <div className="text-sm text-gray-600">
        Save the temporary password now. You can copy it or download a CSV for safekeeping.
      </div>

      <div>
        <SecondaryButton type="button" onClick={handleDownloadCsv} disabled={!csvPayload}>
          Download CSV
        </SecondaryButton>
      </div>
    </BaseModal>
  );
}
