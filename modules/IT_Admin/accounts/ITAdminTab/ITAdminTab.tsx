import { useState, useCallback, useMemo, useRef, type ChangeEvent } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useForm } from "react-hook-form";
import * as XLSX from "xlsx";
import TableList from "@/components/Common/Tables/TableList";
import ITAdminDetailsModal from "./Modals/ITAdminDetailsModal";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import AccountActionsMenu, { type AccountActionKey } from "../components/AccountActionsMenu";
import AddITAdminModal, { type AddITAdminFormValues } from "./Modals/AddITAdminModal";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import { exportAccountRows, IT_ADMIN_EXPORT_COLUMNS } from "../utils/export-columns";

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

function normalizeItAdminRecord(record: any) {
  const userId = record.userId ?? record.user_id ?? null;
  const normalized: any = {
    ...record,
    userId,
  };

  normalized.name = toStringOrNull(record.name ?? record.fullName ?? record.full_name) ?? (() => {
    const first = toStringOrNull(record.firstName ?? record.first_name);
    const middle = toStringOrNull(record.middleName ?? record.middle_name);
    const last = toStringOrNull(record.lastName ?? record.last_name);
    return [first, middle, last].filter(Boolean).join(" ") || toStringOrNull(record.email ?? record.user_email) || (userId != null ? `User ${userId}` : "Unknown User");
  })();

  normalized.email = toStringOrNull(record.email ?? record.user_email);
  normalized.contactNumber = toStringOrNull(record.contactNumber ?? record.contact_number ?? record.phoneNumber);
  normalized.status = toStringOrNull(record.status) ?? "Active";
  normalized.lastLogin = record.lastLogin ?? null;
  normalized.lastLoginDisplay = formatTimestamp(record.lastLogin ?? null);

  if (userId !== null && userId !== undefined) {
    const userIdString = String(userId);
    normalized.adminId = toStringOrNull(record.adminId) ?? userIdString;
  } else {
    normalized.adminId = toStringOrNull(record.adminId);
  }

  return normalized;
}

function sortItAdmins(records: any[]) {
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

interface ITAdminTabProps {
  itAdmins: any[];
  setITAdmins: Dispatch<SetStateAction<any[]>>;
  searchTerm: string;
}

export default function ITAdminTab({ itAdmins, setITAdmins, searchTerm }: ITAdminTabProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedITAdmin, setSelectedITAdmin] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedITAdminKeys, setSelectedITAdminKeys] = useState<Set<string>>(new Set());
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const addITAdminForm = useForm<AddITAdminFormValues>({
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
    },
  });

  const getItAdminKey = useCallback((admin: any) => {
    const fallbackIndex = itAdmins.indexOf(admin);
    return String(
      admin.userId ??
        admin.user_id ??
        admin.adminId ??
        admin.admin_id ??
        admin.email ??
        fallbackIndex,
    );
  }, [itAdmins]);

  const handleMenuAction = useCallback((action: AccountActionKey) => {
    if (action === "it_admin:add") {
      setSubmitError(null);
      setSuccessMessage(null);
      setArchiveError(null);
      addITAdminForm.reset();
      setShowAddModal(true);
      return;
    }
    if (action === "it_admin:upload") {
      uploadInputRef.current?.click();
      return;
    }
    if (action === "it_admin:select") {
      setArchiveError(null);
      setSuccessMessage(null);
      setSelectMode(true);
      return;
    }

    console.log(`[IT Admin Tab] Action triggered: ${action}`);
  }, [addITAdminForm]);


  const filteredITAdmins = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (query.length === 0) {
      return itAdmins;
    }

    return itAdmins.filter((admin) => {
      const nameMatch = admin.name?.toLowerCase().includes(query);
      const emailMatch = admin.email?.toLowerCase().includes(query);
      const idMatch = (admin.adminId ?? "").toLowerCase().includes(query);

      return Boolean(nameMatch || emailMatch || idMatch);
    });
  }, [itAdmins, searchTerm]);

  const handleExport = useCallback(() => {
    void exportAccountRows({
      rows: filteredITAdmins,
      columns: IT_ADMIN_EXPORT_COLUMNS,
      baseFilename: "it-admin-accounts",
      sheetName: "IT Admin Accounts",
      emptyMessage: "No IT Admin accounts available to export.",
    });
  }, [filteredITAdmins]);

  const handleShowDetails = (admin: any) => {
    setSelectedITAdmin(admin);
    setShowDetailModal(true);
  };

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false);
    setSubmitError(null);
    addITAdminForm.reset();
  }, [addITAdminForm]);

  const handleSubmitAdd = useCallback(async (values: AddITAdminFormValues) => {
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
      const response = await fetch("/api/it_admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? `Unable to add IT Admin (status ${response.status}).`);
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
        email: payload.email,
        contactNumber: payload.phoneNumber,
        adminId: userId != null ? String(userId) : undefined,
        lastLogin: null,
      };

      const normalizedRecord = normalizeItAdminRecord(record ?? fallbackRecord);

      setITAdmins((prev: any[]) => {
        const withoutExisting = prev.filter((item: any) => item?.userId !== normalizedRecord.userId);
        const updated = sortItAdmins([...withoutExisting, normalizedRecord]);
        return updated;
      });

      addITAdminForm.reset();
      setShowAddModal(false);
      if (temporaryPassword) {
        setSuccessMessage(
          `${normalizedRecord.name ?? "New IT Admin"} added successfully. Temporary password: ${temporaryPassword}`,
        );
      } else {
        setSuccessMessage(`${normalizedRecord.name ?? "New IT Admin"} added successfully.`);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to add IT Admin.");
    } finally {
      setIsSubmitting(false);
    }
  }, [addITAdminForm, setITAdmins]);

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
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const newAdmins = jsonData.map((row: any, index: number) => {
          const fullName = `${row.FIRSTNAME || ""} ${row.MIDDLENAME || ""} ${row.LASTNAME || ""}`.trim();
          
          return normalizeItAdminRecord({
            userId: Date.now() + index,
            adminId: row["ADMIN ID"] || "",
            name: fullName,
            email: row["EMAIL"] || "",
            contactNumber: row["CONTACT NUMBER"] || "",
            status: "Active",
            lastLogin: null,
          });
        });

        setITAdmins((prev) => sortItAdmins([...prev, ...newAdmins]));
        alert(`Successfully imported ${newAdmins.length} IT Admins`);
      } catch (error) {
        console.error(error);
        alert("Error reading Excel file. Please check the format and column headers.");
      }
    };
    reader.readAsArrayBuffer(selectedFile);
    setSelectedFile(null);
    setShowConfirmModal(false);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }, [selectedFile, setITAdmins]);

  const handleUploadCancel = useCallback(() => {
    setSelectedFile(null);
    setShowConfirmModal(false);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }, []);

  const handleSelectItAdmin = useCallback((id: string, checked: boolean) => {
    setSelectedITAdminKeys((prev) => {
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
      const keys = new Set(filteredITAdmins.map((admin: any) => getItAdminKey(admin)));
      setSelectedITAdminKeys(keys);
      return;
    }
    setSelectedITAdminKeys(new Set());
  }, [filteredITAdmins, getItAdminKey]);

  const handleCancelSelect = useCallback(() => {
    setSelectMode(false);
    setSelectedITAdminKeys(new Set());
    setArchiveError(null);
  }, []);

  const handleArchiveSelected = useCallback(() => {
    if (selectedITAdminKeys.size === 0) {
      return;
    }
    setArchiveError(null);
    setSuccessMessage(null);
    setShowArchiveModal(true);
  }, [selectedITAdminKeys]);

  const handleConfirmArchiveSelected = useCallback(async () => {
    if (selectedITAdminKeys.size === 0) {
      return;
    }

    const selectedRecords = itAdmins.filter((admin: any) => selectedITAdminKeys.has(getItAdminKey(admin)));
    const userIds = selectedRecords
      .map((admin: any) => extractNumericId(admin.userId ?? admin.user_id ?? admin.adminId ?? admin.admin_id))
      .filter((value): value is number => value !== null);

    const uniqueUserIds = Array.from(new Set(userIds));

    if (uniqueUserIds.length === 0) {
      setArchiveError("Unable to determine user IDs for the selected IT Admins.");
      return;
    }

    setIsArchiving(true);
    setArchiveError(null);
    try {
      const response = await fetch("/api/it_admin/accounts/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: uniqueUserIds }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? `Failed to archive IT Admins (status ${response.status}).`);
      }

      const payload = await response.json().catch(() => ({}));
      const archivedIds = Array.isArray(payload?.archived)
        ? payload.archived
            .map((item: any) => extractNumericId(item?.userId ?? item?.user_id))
            .filter((value: number | null): value is number => value !== null)
        : uniqueUserIds;

      const effectiveIds = archivedIds.length > 0 ? archivedIds : uniqueUserIds;

      setITAdmins((prev) => {
        const remaining = prev.filter((admin: any) => {
          const candidateId = extractNumericId(admin.userId ?? admin.user_id ?? admin.adminId ?? admin.admin_id);
          if (candidateId === null) {
            return true;
          }
          return !effectiveIds.includes(candidateId);
        });
        return sortItAdmins(remaining);
      });

      const archivedCount = effectiveIds.length;
      setSuccessMessage(`Archived ${archivedCount} IT Admin${archivedCount === 1 ? "" : "s"} successfully.`);
      setSelectedITAdminKeys(new Set());
      setSelectMode(false);
      setShowArchiveModal(false);
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "Failed to archive the selected IT Admins.");
    } finally {
      setIsArchiving(false);
    }
  }, [getItAdminKey, itAdmins, selectedITAdminKeys, setITAdmins]);

  const handleCloseArchiveModal = useCallback(() => {
    setShowArchiveModal(false);
    setArchiveError(null);
    setIsArchiving(false);
  }, []);



  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4 gap-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {itAdmins.length}
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
                disabled={selectedITAdminKeys.size === 0}
                className={selectedITAdminKeys.size === 0 ? "opacity-60 cursor-not-allowed" : ""}
              >
                Archive ({selectedITAdminKeys.size})
              </DangerButton>
            </>
          ) : (
            <AccountActionsMenu
              accountType="IT Admin"
              onAction={handleMenuAction}
              buttonAriaLabel="Open IT Admin actions"
              exportConfig={{
                onExport: handleExport,
                disabled: filteredITAdmins.length === 0,
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

      <AddITAdminModal
        show={showAddModal}
        onClose={handleCloseAddModal}
        onSubmit={handleSubmitAdd}
        form={addITAdminForm}
        isSubmitting={isSubmitting}
        apiError={submitError}
      />
      
      <ITAdminDetailsModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        itAdmin={selectedITAdmin}
      />

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleUploadCancel}
        onConfirm={handleUploadConfirm}
        title="Confirm File Upload"
        message="Are you sure you want to upload this Excel file? This will import IT Admin data."
        fileName={selectedFile?.name}
      />

      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "adminId", title: "Admin ID", render: (row: any) => row.adminId ?? "—" },
          { key: "name", title: "Full Name", render: (row: any) => row.name ?? "—" },
          { key: "email", title: "Email", render: (row: any) => row.email ?? "—" },
          {
            key: "lastLogin",
            title: "Last Login",
            render: (row: any) => row.lastLoginDisplay ?? "—",
          },
        ]}
        data={filteredITAdmins.map((admin, idx) => ({
          ...admin,
          id: getItAdminKey(admin),
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleShowDetails(row)}>
            View Details
          </UtilityButton>
        )}
        selectable={selectMode}
        selectedItems={selectedITAdminKeys}
        onSelectAll={handleSelectAll}
        onSelectItem={(id, checked) => handleSelectItAdmin(String(id), checked)}
        pageSize={10}
      />

      <DeleteConfirmationModal
        isOpen={showArchiveModal}
        onClose={handleCloseArchiveModal}
        onConfirm={handleConfirmArchiveSelected}
        title="Confirm Archive Selected"
        message={`Are you sure you want to archive ${selectedITAdminKeys.size} selected IT Admin${selectedITAdminKeys.size === 1 ? "" : "s"}? This will move them to the archive.`}
        confirmLabel="Archive"
        confirmDisabled={selectedITAdminKeys.size === 0}
        isProcessing={isArchiving}
        errorMessage={archiveError}
      />
    </div>
  );
}