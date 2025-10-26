import { useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import TableList from "@/components/Common/Tables/TableList";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import AccountActionsMenu, { type AccountActionKey } from "../components/AccountActionsMenu";
import AddPrincipalModal, { type AddPrincipalFormValues } from "./Modals/AddPrincipalModal";
import PrincipalDetailsModal from "./Modals/PrincipalDetailsModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";

const NAME_COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : null;
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
  setPrincipals: (principals: any[]) => void;
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
      addPrincipalForm.reset();
      setShowAddModal(true);
      return;
    }
    if (action === "principal:select") {
      setSelectMode(true);
      return;
    }
  }, [addPrincipalForm]);

  const handleAddPrincipal = useCallback(async (values: AddPrincipalFormValues) => {
    const payload = {
      firstName: values.firstName.trim(),
      middleName: values.middleName.trim() || null,
      lastName: values.lastName.trim(),
      email: values.email.trim().toLowerCase(),
      phoneNumber: values.phoneNumber.replace(/\D/g, ""),
    };

    setIsSubmitting(true);
    setSubmitError(null);
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

      const fallbackRecord = {
        userId,
        firstName: payload.firstName,
        middleName: payload.middleName,
        lastName: payload.lastName,
        email: payload.email,
        contactNumber: payload.phoneNumber,
        principalId: userId != null ? String(userId) : undefined,
        lastLogin: null,
        name: [payload.firstName, payload.middleName, payload.lastName].filter(Boolean).join(" "),
      };

      const normalizedRecord = record ?? fallbackRecord;

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
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedPrincipalKeys.size === 0) return;
    setShowDeleteModal(true);
  }, [selectedPrincipalKeys]);

  const handleConfirmDeleteSelected = useCallback(() => {
    const remaining = principals.filter((principal: any) => !selectedPrincipalKeys.has(getPrincipalKey(principal)));
    setPrincipals(remaining);
    setSelectedPrincipalKeys(new Set());
    setSelectMode(false);
    setShowDeleteModal(false);
  }, [getPrincipalKey, principals, selectedPrincipalKeys, setPrincipals]);

  const handleCloseDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
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
                onClick={handleDeleteSelected}
                disabled={selectedPrincipalKeys.size === 0}
                className={selectedPrincipalKeys.size === 0 ? "opacity-60 cursor-not-allowed" : ""}
              >
                Delete ({selectedPrincipalKeys.size})
              </DangerButton>
            </>
          ) : (
            <AccountActionsMenu
              accountType="Principal"
              onAction={handleMenuAction}
              buttonAriaLabel="Open principal actions"
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
        data={filteredPrincipals.map((principal: any, idx: number) => ({
          ...principal,
          id: getPrincipalKey(principal),
          no: idx + 1,
        }))}
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
        onConfirm={handleConfirmDeleteSelected}
        title="Confirm Delete Selected"
        message={`Are you sure you want to delete ${selectedPrincipalKeys.size} selected principal${selectedPrincipalKeys.size === 1 ? "" : "s"}? This action cannot be undone.`}
      />
    </div>
  );
}