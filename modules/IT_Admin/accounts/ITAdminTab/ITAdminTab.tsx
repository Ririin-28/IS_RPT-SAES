import { useState, useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useForm } from "react-hook-form";
import TableList from "@/components/Common/Tables/TableList";
import ITAdminDetailsModal from "./Modals/ITAdminDetailsModal";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import AccountActionsMenu, { type AccountActionKey } from "../components/AccountActionsMenu";
import AddITAdminModal, { type AddITAdminFormValues } from "./Modals/AddITAdminModal";
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

  const handleMenuAction = useCallback((action: AccountActionKey) => {
    if (action === "it_admin:add") {
      setSubmitError(null);
      setSuccessMessage(null);
      addITAdminForm.reset();
      setShowAddModal(true);
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



  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4 gap-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {itAdmins.length}
        </p>
        <AccountActionsMenu
          accountType="IT Admin"
          onAction={handleMenuAction}
          buttonAriaLabel="Open IT Admin actions"
          exportConfig={{
            onExport: handleExport,
            disabled: filteredITAdmins.length === 0,
          }}
        />

      </div>

      {successMessage && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          {successMessage}
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
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleShowDetails(row)}>
            View Details
          </UtilityButton>
        )}
        pageSize={10}
      />
    </div>
  );
}