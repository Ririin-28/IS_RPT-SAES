import { useState, useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import { useForm } from "react-hook-form";
import TableList from "@/components/Common/Tables/TableList";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import AccountActionsMenu, { type AccountActionKey } from "../components/AccountActionsMenu";
import AddPrincipalModal, { type AddPrincipalFormValues } from "./Modals/AddPrincipalModal";
import PrincipalDetailsModal from "./Modals/PrincipalDetailsModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import { exportRowsToExcel } from "@/lib/utils/export-to-excel";
import { buildAccountsExportFilename, PRINCIPAL_EXPORT_COLUMNS } from "../utils/export-columns";

const NAME_COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function normalizeContact(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const asString = typeof value === "string" ? value : String(value);
  const digits = asString.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function formatContactNumberForDisplay(value: unknown): string | null {
  const digits = normalizeContact(value);
  if (digits && digits.length === 11) {
    if (digits.startsWith("6332")) {
      const local = digits.slice(4);
      const firstSegment = local.slice(0, 3);
      const secondSegment = local.slice(3, 7);
      return `+63 32 ${firstSegment} ${secondSegment}`;
    }

    const country = digits.slice(0, 2);
    const area = digits.slice(2, 5);
    const remainder = digits.slice(5);
    const middle = remainder.slice(0, Math.max(remainder.length - 4, 0));
    const tail = remainder.slice(Math.max(remainder.length - 4, 0));
    if (middle.length > 0 && tail.length > 0) {
      return `+${country} ${area} ${middle} ${tail}`;
    }
    return `+${country} ${area} ${remainder}`.trim();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
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

interface PrincipalTabProps {
  principals: any[];
  setPrincipals: Dispatch<SetStateAction<any[]>>;
  searchTerm: string;
}

export default function PrincipalTab({ principals, setPrincipals, searchTerm }: PrincipalTabProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPrincipal, setSelectedPrincipal] = useState<any>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPrincipalKeys, setSelectedPrincipalKeys] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const addPrincipalForm = useForm<AddPrincipalFormValues>({
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
    },
  });

  const getPrincipalKey = useCallback((principal: any) => {
    const fallbackIndex = principals.indexOf(principal);
    return String(principal.id ?? principal.principalId ?? principal.email ?? principal.contactNumber ?? principal.name ?? fallbackIndex);
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
    if (action === "principal:select") {
      setArchiveError(null);
      setSuccessMessage(null);
      setSelectMode(true);
      return;
    }
  }, [addPrincipalForm]);

  const handleAddPrincipal = useCallback(async (values: AddPrincipalFormValues) => {
    const formattedPhone = values.phoneNumber.trim();
    const normalizedPhoneDigits = normalizeContact(formattedPhone);
    if (!normalizedPhoneDigits) {
      setSubmitError("Phone number is required.");
      return;
    }

    const payload = {
      firstName: values.firstName.trim(),
      middleName: values.middleName.trim() || null,
      lastName: values.lastName.trim(),
      email: values.email.trim().toLowerCase(),
      phoneNumber: formattedPhone,
    };

    setSubmitError(null);
    setSuccessMessage(null);
    setArchiveError(null);
    const emailToCheck = payload.email;
    const phoneToCheck = normalizedPhoneDigits;

    const hasDuplicate = principals.some((principal: any) => {
      const emailMatch = typeof principal.email === "string" && principal.email.trim().toLowerCase() === emailToCheck;
      const existingDigits =
        typeof principal.contactNumberRaw === "string"
          ? normalizeContact(principal.contactNumberRaw)
          : normalizeContact(
              principal.contactNumber ??
                principal.contact_number ??
                principal.phoneNumber ??
                principal.phone_number,
            );
      const phoneMatch = existingDigits && phoneToCheck ? existingDigits === phoneToCheck : false;
      return emailMatch || phoneMatch;
    });

    if (hasDuplicate) {
      setSubmitError("A principal with the same email or contact number already exists.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/it_admin/principals", {
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
      const contactNumberRaw = normalizeContact(record?.contactNumberRaw ?? record?.contactNumber ?? formattedPhone) ?? normalizedPhoneDigits;

      const fallbackRecord = {
        userId,
        firstName: payload.firstName,
        middleName: payload.middleName,
        lastName: payload.lastName,
        email: payload.email,
        contactNumber: formattedPhone,
        contactNumberRaw,
        principalId: userId != null ? String(userId) : undefined,
        lastLogin: null,
        name: [payload.firstName, payload.middleName, payload.lastName].filter(Boolean).join(" "),
      };

      const normalizedRecord: any = record ? { ...record } : fallbackRecord;

      if (!normalizedRecord.contactNumberRaw) {
        normalizedRecord.contactNumberRaw = contactNumberRaw;
      }
      if (!normalizedRecord.contactNumber) {
        normalizedRecord.contactNumber = formattedPhone;
      }

      const withoutExisting = principals.filter((principal: any) => {
        if (normalizedRecord.userId == null) {
          return true;
        }
        return principal.userId !== normalizedRecord.userId;
      });
      const updated = sortPrincipals([...withoutExisting, normalizedRecord]);
      setPrincipals(updated);

      addPrincipalForm.reset();
      setShowAddModal(false);
      if (result?.temporaryPassword) {
        setSuccessMessage(
          `${normalizedRecord.name ?? "New Principal"} added successfully. Temporary password: ${result.temporaryPassword}`,
        );
      } else {
        setSuccessMessage(`${normalizedRecord.name ?? "New Principal"} added successfully.`);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to add Principal.");
    } finally {
      setIsSubmitting(false);
    }
  }, [addPrincipalForm, principals, setPrincipals]);

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false);
    setSubmitError(null);
    addPrincipalForm.reset();
  }, [addPrincipalForm]);

  const filteredPrincipals = useMemo(() => principals.filter((principal) => {
    const matchSearch = searchTerm === "" || 
      principal.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      principal.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      principal.principalId?.toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchSearch;
  }), [principals, searchTerm]);


  const handleExport = useCallback(() => {
    if (filteredPrincipals.length === 0) {
      window.alert("No principal accounts available to export.");
      return;
    }

    const filename = buildAccountsExportFilename("principal-accounts");
    void exportRowsToExcel({
      rows: filteredPrincipals,
      columns: PRINCIPAL_EXPORT_COLUMNS,
      filename,
      sheetName: "Principal Accounts",
    });
  }, [filteredPrincipals]);
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
    if (selectedPrincipalKeys.size === 0) return;
    setArchiveError(null);
    setSuccessMessage(null);
    setShowDeleteModal(true);
  }, [selectedPrincipalKeys]);

  const handleConfirmArchiveSelected = useCallback(async () => {
    if (selectedPrincipalKeys.size === 0) {
      return;
    }

    const selectedRecords = principals.filter((principal: any) => selectedPrincipalKeys.has(getPrincipalKey(principal)));
    const userIds = selectedRecords
      .map((principal: any) => {
        return (
          extractNumericId(principal.userId ?? principal.user_id) ??
          extractNumericId(principal.principalId ?? principal.principal_id)
        );
      })
      .filter((value): value is number => value !== null);

    const uniqueUserIds = Array.from(new Set(userIds));

    if (uniqueUserIds.length === 0) {
      setArchiveError("Unable to determine user IDs for the selected principals.");
      return;
    }

    setIsArchiving(true);
    setArchiveError(null);
    try {
      const response = await fetch("/api/it_admin/principals/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: uniqueUserIds }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? `Failed to archive principals (status ${response.status}).`);
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
          const candidateId =
            extractNumericId(principal.userId ?? principal.user_id) ??
            extractNumericId(principal.principalId ?? principal.principal_id);
          if (candidateId === null) {
            return true;
          }
          return !effectiveIds.includes(candidateId);
        });
        return sortPrincipals(remaining);
      });

      const archivedCount = effectiveIds.length;
      setSuccessMessage(`Archived ${archivedCount} principal${archivedCount === 1 ? "" : "s"} successfully.`);
      setSelectedPrincipalKeys(new Set());
      setSelectMode(false);
      setShowDeleteModal(false);
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "Failed to archive the selected principals.");
    } finally {
      setIsArchiving(false);
    }
  }, [getPrincipalKey, principals, selectedPrincipalKeys, setPrincipals]);

  const handleCloseDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
    setArchiveError(null);
    setIsArchiving(false);
  }, []);

  const handleShowDetails = (principal: any) => {
    setSelectedPrincipal(principal);
    setShowDetailModal(true);
  };

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
              buttonAriaLabel="Open principal actions"
              exportConfig={{
                onExport: handleExport,
                disabled: filteredPrincipals.length === 0,
              }}
            />
          )}
        </div>
      </div>
      
      <PrincipalDetailsModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        principal={selectedPrincipal}
      />

      <AddPrincipalModal
        show={showAddModal}
        onClose={handleCloseAddModal}
        onSubmit={handleAddPrincipal}
        form={addPrincipalForm}
        isSubmitting={isSubmitting}
        apiError={submitError}
      />

      {successMessage && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "principalId", title: "Principal ID" },
          { key: "name", title: "Full Name" },
          { key: "email", title: "Email" },
          { key: "contactNumber", title: "Contact Number" },
        ]}
        data={filteredPrincipals.map((principal: any, idx: number) => {
          const rawDigits =
            typeof principal.contactNumberRaw === "string"
              ? normalizeContact(principal.contactNumberRaw)
              : normalizeContact(
                  principal.contactNumber ??
                    principal.contact_number ??
                    principal.phoneNumber ??
                    principal.phone_number,
                );

          return {
            ...principal,
            contactNumberRaw: rawDigits ?? principal.contactNumberRaw ?? null,
            id: getPrincipalKey(principal),
            no: idx + 1,
            contactNumber: formatContactNumberForDisplay(
              principal.contactNumber ??
                principal.contact_number ??
                principal.contactNumberRaw ??
                principal.phoneNumber ??
                principal.phone_number ??
                rawDigits ?? undefined,
            ) ?? "—",
          };
        })}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleShowDetails(row)}>
            View Details
          </UtilityButton>
        )}
        selectable={selectMode}
        selectedItems={selectedPrincipalKeys}
        onSelectAll={handleSelectAll}
        onSelectItem={(id, checked) => handleSelectPrincipal(String(id), checked)}
        pageSize={10}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmArchiveSelected}
        title="Confirm Archive Selected"
        message={`Are you sure you want to archive ${selectedPrincipalKeys.size} selected principal${selectedPrincipalKeys.size === 1 ? "" : "s"}? This will move them to the archive.`}
        confirmLabel="Archive"
        confirmDisabled={selectedPrincipalKeys.size === 0}
        isProcessing={isArchiving}
        errorMessage={archiveError}
      />
    </div>
  );
}