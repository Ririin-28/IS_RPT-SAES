import { useState, useCallback, useMemo, useRef, type ChangeEvent } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useForm } from "react-hook-form";
import * as XLSX from "xlsx";
import TableList from "@/components/Common/Tables/TableList";
import PrincipalDetailsModal from "./Modals/PrincipalDetailsModal";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import AccountActionsMenu, { type AccountActionKey } from "../components/AccountActionsMenu";
import AddPrincipalModal, { type AddPrincipalFormValues } from "./Modals/AddPrincipalModal";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import AccountCreatedModal, { type AccountCreatedInfo } from "@/components/Common/Modals/AccountCreatedModal";
import { exportAccountRows, PRINCIPAL_EXPORT_COLUMNS } from "../utils/export-columns";

const NAME_COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function formatTimestamp(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }

  try {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "Invalid Date";
    }

    return parsed.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return "Invalid Date";
  }
}

function formatLocalPhoneNumber(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly.length === 0) {
    return null;
  }

  let normalized = digitsOnly;
  if (normalized.startsWith("63") && normalized.length >= 12) {
    normalized = `0${normalized.slice(2)}`;
  }
  if (normalized.length === 10 && normalized.startsWith("9")) {
    normalized = `0${normalized}`;
  }
  if (normalized.length > 11) {
    normalized = normalized.slice(-11);
  }

  if (!normalized.startsWith("09") || normalized.length !== 11) {
    return normalized;
  }

  const part1 = normalized.slice(0, 4);
  const part2 = normalized.slice(4, 7);
  const part3 = normalized.slice(7);
  return `${part1}-${part2}-${part3}`;
}

function normalizePrincipalRecord(record: any) {
  const userId = record.userId ?? record.user_id ?? null;
  const normalized: any = {
    ...record,
    userId,
  };

  const suffix = toStringOrNull(record.suffix ?? record.suf ?? record.suffix_name);

  normalized.name = toStringOrNull(record.name ?? record.fullName ?? record.full_name) ?? (() => {
    const first = toStringOrNull(record.firstName ?? record.first_name);
    const middle = toStringOrNull(record.middleName ?? record.middle_name);
    const last = toStringOrNull(record.lastName ?? record.last_name);
    const parts = [first, middle, last].filter(Boolean);
    if (suffix) {
      parts.push(suffix);
    }
    return parts.join(" ") || toStringOrNull(record.email ?? record.user_email) || (userId != null ? `User ${userId}` : "Unknown User");
  })();
  normalized.suffix = suffix;
  normalized.fullName = normalized.name;

  normalized.email = toStringOrNull(record.email ?? record.user_email);
  const contactRaw = toStringOrNull(
    record.contactNumber ?? record.contact_number ?? record.phoneNumber ?? record.phone_number,
  );
  normalized.contactNumber = contactRaw;
  const contactDisplay = formatLocalPhoneNumber(contactRaw);
  normalized.contactNumberDisplay = contactDisplay ?? contactRaw;
  normalized.phoneNumber = contactRaw;
  normalized.status = toStringOrNull(record.status) ?? "Active";
  normalized.lastLogin = record.lastLogin ?? null;
  normalized.lastLoginDisplay = formatTimestamp(record.lastLogin ?? null);

  if (userId !== null && userId !== undefined) {
    const userIdString = String(userId);
    normalized.principalId = toStringOrNull(record.principalId) ?? userIdString;
  } else {
    normalized.principalId = toStringOrNull(record.principalId);
  }

  return normalized;
}

function sortPrincipals(records: any[]) {
  return [...records].sort((a, b) => {
    const nameA = toStringOrNull(a.name);
    const nameB = toStringOrNull(b.name);

    if (nameA && nameB) {
      const cmp = NAME_COLLATOR.compare(nameA, nameB);
      if (cmp !== 0) {
        return cmp;
      }
    } else if (nameA) {
      return -1;
    } else if (nameB) {
      return 1;
    }

    const idA = typeof a.userId === "number" ? a.userId : Number.parseInt(String(a.userId ?? 0), 10) || 0;
    const idB = typeof b.userId === "number" ? b.userId : Number.parseInt(String(b.userId ?? 0), 10) || 0;
    return idA - idB;
  });
}

function extractNumericId(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}

interface PrincipalTabProps {
  principals: any[];
  setPrincipals: Dispatch<SetStateAction<any[]>>;
  searchTerm: string;
}

export default function PrincipalTab({ principals, setPrincipals, searchTerm }: PrincipalTabProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPrincipal, setSelectedPrincipal] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdAccount, setCreatedAccount] = useState<AccountCreatedInfo | null>(null);
  const [archivedCount, setArchivedCount] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPrincipalKeys, setSelectedPrincipalKeys] = useState<Set<string>>(new Set());
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [uploadedPasswords, setUploadedPasswords] = useState<Array<{name: string; email: string; password: string}>>([]);
  const [uploadedAccounts, setUploadedAccounts] = useState<AccountCreatedInfo[] | null>(null);

  const addPrincipalForm = useForm<AddPrincipalFormValues>({
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      suffix: "",
      email: "",
      phoneNumber: "",
    },
  });

  const getPrincipalKey = useCallback((principal: any) => {
    const fallbackIndex = principals.indexOf(principal);
    return String(
      principal.userId ??
        principal.user_id ??
        principal.principalId ??
        principal.principal_id ??
        principal.email ??
        fallbackIndex,
    );
  }, [principals]);

  const handleMenuAction = useCallback((action: AccountActionKey) => {
    if (action === "principal:add") {
      setSubmitError(null);
      setSuccessMessage(null);
      setArchiveError(null);
      addPrincipalForm.reset();
      setShowAddModal(true);
      return;
    }
    if (action === "principal:upload") {
      uploadInputRef.current?.click();
      return;
    }
    if (action === "principal:select") {
      setArchiveError(null);
      setSuccessMessage(null);
      setSelectMode(true);
      return;
    }

    console.log(`[Principal Tab] Action triggered: ${action}`);
  }, [addPrincipalForm]);

  const filteredPrincipals = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (query.length === 0) {
      return principals;
    }

    return principals.filter((principal) => {
      const nameMatch = principal.name?.toLowerCase().includes(query);
      const emailMatch = principal.email?.toLowerCase().includes(query);
      const idMatch = (principal.principalId ?? "").toLowerCase().includes(query);

      return Boolean(nameMatch || emailMatch || idMatch);
    });
  }, [principals, searchTerm]);

  const handleExport = useCallback(() => {
    void exportAccountRows({
      rows: filteredPrincipals,
      columns: PRINCIPAL_EXPORT_COLUMNS,
      baseFilename: "principal-accounts",
      sheetName: "Principal Accounts",
      emptyMessage: "No principal accounts available to export.",
    });
  }, [filteredPrincipals]);

  const handleShowDetails = (principal: any) => {
    setSelectedPrincipal(principal);
    setShowDetailModal(true);
  };

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false);
    setSubmitError(null);
    addPrincipalForm.reset();
  }, [addPrincipalForm]);

  const handleSubmitAdd = useCallback(async (values: AddPrincipalFormValues) => {
    const payload = {
      firstName: values.firstName.trim(),
      middleName: values.middleName.trim() || null,
      lastName: values.lastName.trim(),
      suffix: values.suffix.trim() || null,
      email: values.email.trim().toLowerCase(),
      phoneNumber: values.phoneNumber.replace(/\D/g, ""),
    };

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/super_admin/accounts/principal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? `Unable to add Principal (status ${response.status}).`);
      }

      const result = await response.json();
      const record = result?.record ?? null;
      const userId = result?.userId ?? record?.userId ?? null;
      const temporaryPassword = result?.temporaryPassword ?? null;

      const fallbackRecord = {
        userId,
        firstName: payload.firstName,
        middleName: payload.middleName,
        lastName: payload.lastName,
        suffix: payload.suffix,
        email: payload.email,
        contactNumber: payload.phoneNumber,
        phoneNumber: payload.phoneNumber,
        principalId: userId != null ? String(userId) : undefined,
        lastLogin: null,
      };

      const normalizedRecord = normalizePrincipalRecord(record ?? fallbackRecord);

      setPrincipals((prev: any[]) => {
        const withoutExisting = prev.filter((item: any) => item?.userId !== normalizedRecord.userId);
        return sortPrincipals([...withoutExisting, normalizedRecord]);
      });

      setShowAddModal(false);
      if (temporaryPassword) {
        setSuccessMessage(null);
        setCreatedAccount({
          name: normalizedRecord.name ?? "New Principal",
          email: normalizedRecord.email ?? payload.email,
          temporaryPassword,
          roleLabel: "Principal",
        });
      } else {
        setSuccessMessage(`${normalizedRecord.name ?? "New Principal"} added successfully.`);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to add Principal.");
    } finally {
      setIsSubmitting(false);
    }
  }, [setPrincipals]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = [".xlsx", ".xls"];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    if (!validTypes.includes(fileExtension)) {
      alert("Please upload only Excel files (.xlsx or .xls)");
      return;
    }

    setSelectedFile(file);
    setShowConfirmModal(true);
  }, []);

  const handleUploadConfirm = useCallback(() => {
    if (!selectedFile) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      void (async () => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });

          const normalizeHeader = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();

          const readField = (row: Record<string, any>, keys: string[]): string => {
            const normalizedRow: Record<string, any> = {};
            for (const [rawKey, rawValue] of Object.entries(row)) {
              normalizedRow[normalizeHeader(String(rawKey))] = rawValue;
            }

            for (const key of keys) {
              const normalizedKey = normalizeHeader(key);
              if (normalizedRow[normalizedKey] !== undefined && normalizedRow[normalizedKey] !== null) {
                const value = String(normalizedRow[normalizedKey]).trim();
                if (value.length > 0) {
                  return value;
                }
              }
            }
            return "";
          };

          let invalidRows = 0;
          const principalsPayload = jsonData
            .map((row) => {
              const firstName = readField(row, [
                "FIRSTNAME",
                "FIRST_NAME",
                "FIRST NAME",
                "First Name",
                "firstName",
              ]);
              const middleName = readField(row, [
                "MIDDLENAME",
                "MIDDLE_NAME",
                "MIDDLE NAME",
                "Middle Name",
                "middleName",
              ]);
              const lastName = readField(row, [
                "LASTNAME",
                "LAST_NAME",
                "LAST NAME",
                "Last Name",
                "lastName",
                "SURNAME",
              ]);
              const suffix = readField(row, [
                "SUFFIX",
                "Suffix",
                "suffix",
              ]);
              const email = readField(row, ["EMAIL", "Email", "email"]).toLowerCase();
              const contactRaw = readField(row, [
                "PHONE NUMBER",
                "PHHONE NUMBER",
                "PHONE_NUMBER",
                "PHHONE_NUMBER",
                "PHONENUMBER",
                "PHHONENUMBER",
                "Phone Number",
                "phoneNumber",
                "CONTACT NUMBER",
                "CONTACT_NUMBER",
                "CONTACTNUMBER",
                "Contact Number",
                "contactNumber",
                "CONTACT",
                "Contact",
              ]);
              const phoneNumber = contactRaw.replace(/\D/g, "");

              if (!firstName || !lastName || !email || phoneNumber.length < 10) {
                invalidRows += 1;
                return null;
              }

              return {
                firstName,
                middleName: middleName || null,
                lastName,
                suffix: suffix || null,
                email,
                phoneNumber,
              };
            })
            .filter((payload): payload is Required<typeof payload> => payload !== null);

          if (principalsPayload.length === 0) {
            setSuccessMessage(null);
            setArchiveError(
              invalidRows > 0
                ? "No valid rows found in the uploaded file. Check required columns (First Name, Last Name, Email, Phone Number)."
                : "The uploaded file does not contain any data.",
            );
            return;
          }

          setArchiveError(null);
          setSuccessMessage(null);

          const response = await fetch("/api/super_admin/accounts/principal/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ principals: principalsPayload }),
          });

          const result = await response.json().catch(() => ({}));
          const inserted = Array.isArray(result?.inserted) ? result.inserted : [];
          const failures = Array.isArray(result?.failures) ? result.failures : [];
          const normalizedRecords = inserted
            .map((entry: any) => normalizePrincipalRecord(entry?.record ?? {}))
            .filter((record: any) => record.userId !== null && record.userId !== undefined);

          if (normalizedRecords.length > 0) {
            setPrincipals((prev) => {
              const existingIds = new Set(normalizedRecords.map((record: any) => String(record.userId)));
              const remaining = prev.filter((item: any) => !existingIds.has(String(item.userId ?? item.principalId ?? item.email ?? "")));
              return sortPrincipals([...remaining, ...normalizedRecords]);
            });
          }

          let passwordMap: Array<{ name: string; email: string; password: string }> = [];
          if (inserted.length > 0) {
            passwordMap = inserted
              .map((entry: any) => ({
                name:
                  entry?.record?.name ??
                  (
                    ( (entry?.record?.firstName ?? entry?.record?.first_name ?? '').toString().trim() ||
                      (entry?.record?.lastName ?? entry?.record?.last_name ?? '').toString().trim()
                    )
                      ? `${(entry?.record?.firstName ?? entry?.record?.first_name ?? '').toString().trim()} ${(entry?.record?.lastName ?? entry?.record?.last_name ?? '').toString().trim()}`.trim()
                      : 'Unknown'
                  ),
                email: entry?.record?.email ?? '',
                password: entry?.temporaryPassword ?? '',
              }))
              .filter((item: any) => item.email && item.password);
            if (passwordMap.length > 0) {
              setUploadedPasswords(passwordMap);
              setUploadedAccounts(
                passwordMap.map((entry) => ({
                  name: entry.name,
                  email: entry.email,
                  temporaryPassword: entry.password,
                  roleLabel: "Principal",
                })),
              );
              console.info("Temporary passwords for imported Principal accounts:", passwordMap);
            }
          }

          const successCount = normalizedRecords.length;
          const failureCount = failures.length + invalidRows;

          if (successCount > 0 && passwordMap.length === 0) {
            setSuccessMessage(`Imported ${successCount} Principal${successCount === 1 ? "" : "s"} successfully.`);
          }

          if (!response.ok || (successCount === 0 && failureCount > 0)) {
            const responseError = typeof result?.error === "string" && result.error.trim().length > 0
              ? result.error
              : "Failed to import Principal accounts.";
            setArchiveError(failureCount > 0 ? `${responseError} (${failureCount} row${failureCount === 1 ? "" : "s"} failed).` : responseError);
          } else if (failureCount > 0) {
            setArchiveError(`${failureCount} row${failureCount === 1 ? "" : "s"} could not be imported. Check for duplicate emails or missing data.`);
          } else {
            setArchiveError(null);
          }
        } catch (error) {
          console.error("Failed to process upload", error);
          setSuccessMessage(null);
          setArchiveError("Error reading Excel file. Please check the format and column headers.");
        } finally {
          setSelectedFile(null);
          setShowConfirmModal(false);
          if (uploadInputRef.current) {
            uploadInputRef.current.value = "";
          }
        }
      })();
    };

    reader.readAsArrayBuffer(selectedFile);
  }, [
    selectedFile,
    setPrincipals,
    setArchiveError,
    setSuccessMessage,
    setSelectedFile,
    setShowConfirmModal,
  ]);

  const handleUploadCancel = useCallback(() => {
    setSelectedFile(null);
    setShowConfirmModal(false);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }, []);

  const handleSelectPrincipal = useCallback((id: string, checked: boolean) => {
    setSelectedPrincipalKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const keys = new Set(filteredPrincipals.map((principal: any) => getPrincipalKey(principal)));
      setSelectedPrincipalKeys(keys);
      return;
    }
    setSelectedPrincipalKeys(new Set());
  }, [filteredPrincipals, getPrincipalKey]);

  const handleCancelSelect = useCallback(() => {
    setSelectMode(false);
    setSelectedPrincipalKeys(new Set());
    setArchiveError(null);
  }, []);

  const handleArchiveSelected = useCallback(() => {
    if (selectedPrincipalKeys.size === 0) {
      return;
    }
    setArchiveError(null);
    setSuccessMessage(null);
    setShowArchiveModal(true);
  }, [selectedPrincipalKeys]);

  const handleConfirmArchiveSelected = useCallback(async () => {
    if (selectedPrincipalKeys.size === 0) {
      return;
    }

    const selectedRecords = principals.filter((principal: any) => selectedPrincipalKeys.has(getPrincipalKey(principal)));
    const userIds = selectedRecords
      .map((principal: any) => extractNumericId(principal.userId ?? principal.user_id ?? principal.principalId ?? principal.principal_id))
      .filter((value): value is number => value !== null);

    const uniqueUserIds = Array.from(new Set(userIds));

    if (uniqueUserIds.length === 0) {
      setArchiveError("Unable to determine user IDs for the selected Principals.");
      return;
    }

    setIsArchiving(true);
    setArchiveError(null);
    try {
      const response = await fetch("/api/super_admin/accounts/principal/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: uniqueUserIds }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? `Failed to archive Principals (status ${response.status}).`);
      }

      const payload = await response.json().catch(() => ({}));
      const archivedIds = Array.isArray(payload?.archived)
        ? payload.archived
            .map((item: any) => extractNumericId(item?.userId ?? item?.user_id))
            .filter((value: number | null): value is number => value !== null)
        : uniqueUserIds;

      const effectiveIds = archivedIds.length > 0 ? archivedIds : uniqueUserIds;

      setPrincipals((prev) => {
        const remaining = prev.filter((principal: any) => {
          const candidateId = extractNumericId(principal.userId ?? principal.user_id ?? principal.principalId ?? principal.principal_id);
          if (candidateId === null) {
            return true;
          }
          return !effectiveIds.includes(candidateId);
        });
        return sortPrincipals(remaining);
      });

      const archivedCount = effectiveIds.length;
      setSuccessMessage(null);
      setArchivedCount(archivedCount);
      setSelectedPrincipalKeys(new Set());
      setSelectMode(false);
      setShowArchiveModal(false);
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "Failed to archive the selected Principals.");
    } finally {
      setIsArchiving(false);
    }
  }, [getPrincipalKey, principals, selectedPrincipalKeys, setPrincipals]);

  const handleCloseArchiveModal = useCallback(() => {
    setShowArchiveModal(false);
    setArchiveError(null);
    setIsArchiving(false);
  }, []);

  const handleDownloadPasswords = useCallback(() => {
    if (uploadedPasswords.length === 0) return;

    const csvContent = [
      ['Name', 'Email', 'Temporary Password'].join(','),
      ...uploadedPasswords.map(item => 
        [item.name, item.email, item.password].map(val => `"${val}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `principal-passwords-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setUploadedPasswords([]);
  }, [uploadedPasswords]);

  const handleDownloadTemplate = useCallback(() => {
    const link = document.createElement('a');
    link.href = '/it_admin/accounts/principal/Principal List Template.xlsx';
    link.download = 'Principal List Template.xlsx';
    link.click();
  }, []);

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4 gap-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {principals.length}
        </p>
        <div className="flex items-center gap-3">
          {selectMode ? (
            <>
              <SecondaryButton small onClick={handleCancelSelect}>
                Cancel
              </SecondaryButton>
              <DangerButton
                small
                onClick={handleArchiveSelected}
                disabled={selectedPrincipalKeys.size === 0}
                className={selectedPrincipalKeys.size === 0 ? "opacity-60 cursor-not-allowed" : ""}
              >
                Archive ({selectedPrincipalKeys.size})
              </DangerButton>
            </>
          ) : (
            <AccountActionsMenu
              accountType="Principal"
              onAction={handleMenuAction}
              buttonAriaLabel="Open Principal actions"
              exportConfig={{
                onExport: handleExport,
                disabled: filteredPrincipals.length === 0,
              }}
              downloadPasswordsConfig={{
                onDownload: handleDownloadPasswords,
                disabled: uploadedPasswords.length === 0,
              }}
              downloadTemplateConfig={{
                onDownload: handleDownloadTemplate,
                disabled: false,
              }}
            />
          )}
        </div>
        <input
          ref={uploadInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {successMessage && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {archiveError && !showArchiveModal && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {archiveError}
        </div>
      )}

      <AddPrincipalModal
        show={showAddModal}
        onClose={handleCloseAddModal}
        onSubmit={handleSubmitAdd}
        form={addPrincipalForm}
        isSubmitting={isSubmitting}
        apiError={submitError}
      />

      <AccountCreatedModal
        show={!!createdAccount}
        onClose={() => setCreatedAccount(null)}
        account={createdAccount}
      />

      <AccountCreatedModal
        show={!!uploadedAccounts}
        onClose={() => setUploadedAccounts(null)}
        accounts={uploadedAccounts}
        title="Import Successful"
        message="Import completed successfully. You can download the CSV file for passwords."
      />

      <ConfirmationModal
        isOpen={archivedCount !== null}
        onClose={() => setArchivedCount(null)}
        onConfirm={() => setArchivedCount(null)}
        title="Archived Successfully"
        message={`Archived ${archivedCount ?? 0} Principal${archivedCount === 1 ? "" : "s"} successfully.`}
      />
      
      <PrincipalDetailsModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        principal={selectedPrincipal}
      />

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleUploadCancel}
        onConfirm={handleUploadConfirm}
        title="Confirm File Upload"
        message="Are you sure you want to upload this Excel file? This will import Principal data."
        fileName={selectedFile?.name}
      />

      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "principalId", title: "Principal ID", render: (row: any) => row.principalId ?? "—" },
          { key: "name", title: "Full Name", render: (row: any) => row.name ?? "—" },
          { key: "email", title: "Email", render: (row: any) => row.email ?? "—" },
          {
            key: "lastLogin",
            title: "Last Login",
            render: (row: any) => row.lastLoginDisplay ?? "—",
          },
        ]}
        data={filteredPrincipals.map((principal, idx) => ({
          ...principal,
          id: getPrincipalKey(principal),
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleShowDetails(row)} title="Click to view details">
            View
          </UtilityButton>
        )}
        selectable={selectMode}
        selectedItems={selectedPrincipalKeys}
        onSelectAll={handleSelectAll}
        onSelectItem={(id, checked) => handleSelectPrincipal(String(id), checked)}
        pageSize={10}
      />

      <DeleteConfirmationModal
        isOpen={showArchiveModal}
        onClose={handleCloseArchiveModal}
        onConfirm={handleConfirmArchiveSelected}
        title="Confirm Archive Selected"
        message={`Are you sure you want to archive ${selectedPrincipalKeys.size} selected Principal${selectedPrincipalKeys.size === 1 ? "" : "s"}? This will move them to the archive.`}
        confirmLabel="Archive"
        confirmDisabled={selectedPrincipalKeys.size === 0}
        isProcessing={isArchiving}
        errorMessage={archiveError}
      />
    </div>
  );
}