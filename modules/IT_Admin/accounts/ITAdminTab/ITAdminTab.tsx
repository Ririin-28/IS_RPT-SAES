import { useState, useCallback, useMemo, useRef, useEffect, type ChangeEvent } from "react";
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
import { getStoredUserProfile, USER_PROFILE_EVENT, type StoredUserProfile } from "@/lib/utils/user-profile";

const NAME_COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const SELF_ARCHIVE_BLOCK_MESSAGE = "You cannot archive your own account.";

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function normalizePhoneDigits(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  let digits = String(raw).replace(/\D/g, "");
  if (digits.length === 0) {
    return null;
  }

  if (digits.startsWith("63")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  if (digits.length !== 10) {
    return null;
  }

  return `0${digits}`;
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

function normalizeItAdminRecord(record: any) {
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
  const [uploadedPasswords, setUploadedPasswords] = useState<Array<{name: string; email: string; password: string}>>([]);
  const [currentUserIdentifiers, setCurrentUserIdentifiers] = useState<{ id: string | null; email: string | null }>({ id: null, email: null });

  const clearSelfArchiveError = useCallback(() => {
    setArchiveError((prev) => (prev === SELF_ARCHIVE_BLOCK_MESSAGE ? null : prev));
  }, [setArchiveError]);

  const addITAdminForm = useForm<AddITAdminFormValues>({
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

  useEffect(() => {
    const updateProfileState = (profile: StoredUserProfile | null) => {
      const nextId = profile?.userId != null ? String(profile.userId) : null;
      const nextEmail = typeof profile?.email === "string" ? profile.email.toLowerCase() : null;

      setCurrentUserIdentifiers((prev) => {
        if (prev.id === nextId && prev.email === nextEmail) {
          return prev;
        }
        return { id: nextId, email: nextEmail };
      });
    };

    updateProfileState(getStoredUserProfile());

    if (typeof window === "undefined") {
      return;
    }

    const handleProfileUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<StoredUserProfile | null>;
      updateProfileState(customEvent.detail ?? null);
    };

    window.addEventListener(USER_PROFILE_EVENT, handleProfileUpdate);
    return () => {
      window.removeEventListener(USER_PROFILE_EVENT, handleProfileUpdate);
    };
  }, []);


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

  const currentUserProtectedKeys = useMemo(() => {
    if (!currentUserIdentifiers.id && !currentUserIdentifiers.email) {
      return new Set<string>();
    }

    const matches: string[] = [];
    for (const admin of itAdmins) {
      const candidateId = admin.userId ?? admin.user_id ?? admin.adminId ?? admin.admin_id;
      const candidateIdString = candidateId != null ? String(candidateId) : null;
      const candidateEmailSource = admin.email ?? admin.user_email ?? null;
      const candidateEmail = typeof candidateEmailSource === "string" ? candidateEmailSource.toLowerCase() : null;

      if (
        (currentUserIdentifiers.id && candidateIdString === currentUserIdentifiers.id) ||
        (currentUserIdentifiers.email && candidateEmail === currentUserIdentifiers.email)
      ) {
        matches.push(getItAdminKey(admin));
      }
    }

    return new Set(matches);
  }, [currentUserIdentifiers, getItAdminKey, itAdmins]);

  useEffect(() => {
    if (currentUserProtectedKeys.size === 0) {
      return;
    }

    setSelectedITAdminKeys((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((key) => {
        if (!currentUserProtectedKeys.has(key)) {
          next.add(key);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [currentUserProtectedKeys]);

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
  suffix: values.suffix.trim() || null,
  email: values.email.trim().toLowerCase(),
  phoneNumber: normalizePhoneDigits(values.phoneNumber) ?? "",
    };

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/it_admin/accounts/it_admin", {
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
        suffix: payload.suffix,
        email: payload.email,
        contactNumber: payload.phoneNumber,
        phoneNumber: payload.phoneNumber,
        adminId: userId != null ? String(userId) : undefined,
        lastLogin: null,
      };

  const normalizedRecord = normalizeItAdminRecord(record ?? fallbackRecord);

      setITAdmins((prev: any[]) => {
        const withoutExisting = prev.filter((item: any) => item?.userId !== normalizedRecord.userId);
        return sortItAdmins([...withoutExisting, normalizedRecord]);
      });

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

          const readField = (row: Record<string, any>, keys: string[]): string => {
            for (const key of keys) {
              if (row[key] !== undefined && row[key] !== null) {
                const value = String(row[key]).trim();
                if (value.length > 0) {
                  return value;
                }
              }
            }
            return "";
          };

          let invalidRows = 0;
          const adminsPayload = jsonData
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
                "CONTACT NUMBER",
                "CONTACT_NUMBER",
                "CONTACTNUMBER",
                "Contact Number",
                "contactNumber",
                "CONTACT",
                "Contact",
              ]);
              const normalizedPhone = normalizePhoneDigits(contactRaw);

              if (!firstName || !lastName || !email || !normalizedPhone) {
                invalidRows += 1;
                return null;
              }

              return {
                firstName,
                middleName: middleName || null,
                lastName,
                suffix: suffix || null,
                email,
                phoneNumber: normalizedPhone,
              };
            })
            .filter((payload): payload is Required<typeof payload> => payload !== null);

          if (adminsPayload.length === 0) {
            setSuccessMessage(null);
            setArchiveError(
              invalidRows > 0
                ? "No valid rows found in the uploaded file. Check required columns (First Name, Last Name, Email, Contact Number)."
                : "The uploaded file does not contain any data.",
            );
            return;
          }

          setArchiveError(null);
          setSuccessMessage(null);

          const response = await fetch("/api/it_admin/accounts/it_admin/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ admins: adminsPayload }),
          });

          const result = await response.json().catch(() => ({}));
          const inserted = Array.isArray(result?.inserted) ? result.inserted : [];
          const failures = Array.isArray(result?.failures) ? result.failures : [];
          
          if (failures.length > 0) {
            console.warn("IT Admin upload skipped rows:", failures);
          }
          const normalizedRecords = inserted
            .map((entry: any) => normalizeItAdminRecord(entry?.record ?? {}))
            .filter((record: any) => record.userId !== null && record.userId !== undefined);

          if (normalizedRecords.length > 0) {
            setITAdmins((prev) => {
              const existingIds = new Set(normalizedRecords.map((record: any) => String(record.userId)));
              const remaining = prev.filter((item: any) => !existingIds.has(String(item.userId ?? item.adminId ?? item.email ?? "")));
              return sortItAdmins([...remaining, ...normalizedRecords]);
            });
          }

          if (inserted.length > 0) {
            const passwordMap = inserted
                .map((entry: any) => ({
                  name: (() => {
                    const rec = entry?.record ?? {};
                    const explicitName = toStringOrNull(rec.name);
                    if (explicitName) return explicitName;
                    const first = toStringOrNull(rec.firstName ?? rec.first_name) ?? "";
                    const last = toStringOrNull(rec.lastName ?? rec.last_name) ?? "";
                    const composed = `${first} ${last}`.trim();
                    return composed.length > 0 ? composed : "Unknown";
                  })(),
                  email: entry?.record?.email ?? '',
                  password: entry?.temporaryPassword ?? '',
                }))
                .filter((item: any) => item.email && item.password);
            if (passwordMap.length > 0) {
              setUploadedPasswords(passwordMap);
              console.info("Temporary passwords for imported IT Admin accounts:", passwordMap);
            }
          }

          const successCount = normalizedRecords.length;
          const failureCount = failures.length + invalidRows;

          if (successCount > 0) {
            const parts: string[] = [];
            parts.push(`Imported ${successCount} IT Admin${successCount === 1 ? "" : "s"} successfully.`);
            if (failureCount > 0) {
              parts.push(`${failureCount} row${failureCount === 1 ? "" : "s"} skipped.`);
            }
            if (inserted.length > 0) {
              parts.push("Download the CSV file to view passwords.");
            }
            setSuccessMessage(parts.join(" "));
          }

          if (!response.ok || (successCount === 0 && failureCount > 0)) {
            const responseError = typeof result?.error === "string" && result.error.trim().length > 0
              ? result.error
              : "Failed to import IT Admin accounts.";
            const failurePreview = failures.slice(0, 3).map((failure: any) => {
              const label = failure?.email ? `${failure.email}` : `Row ${Number(failure?.index ?? 0) + 1}`;
              return `${label}: ${failure?.error ?? "Unknown error"}`;
            });
            const details = failurePreview.length > 0 ? ` Details: ${failurePreview.join("; ")}` : "";
            setArchiveError(`${responseError} (${failureCount} row${failureCount === 1 ? "" : "s"} failed).${details}`.trim());
          } else if (failureCount > 0) {
            const failurePreview = failures.slice(0, 3).map((failure: any) => {
              const label = failure?.email ? `${failure.email}` : `Row ${Number(failure?.index ?? 0) + 1}`;
              return `${label}: ${failure?.error ?? "Unknown error"}`;
            });
            const detailText = failurePreview.length > 0 ? ` Details: ${failurePreview.join("; ")}` : "";
            setArchiveError(`${failureCount} row${failureCount === 1 ? "" : "s"} could not be imported. Check for duplicate emails or missing data.${detailText}`.trim());
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
    setITAdmins,
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

  const handleSelectItAdmin = useCallback((id: string, checked: boolean) => {
    if (currentUserProtectedKeys.has(id)) {
      setArchiveError(SELF_ARCHIVE_BLOCK_MESSAGE);
      return;
    }

    clearSelfArchiveError();

    setSelectedITAdminKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, [clearSelfArchiveError, currentUserProtectedKeys, setArchiveError]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const allKeys = filteredITAdmins.map((admin: any) => getItAdminKey(admin));
      const allowedKeys = allKeys.filter((key) => !currentUserProtectedKeys.has(key));

      if (allowedKeys.length !== allKeys.length && currentUserProtectedKeys.size > 0) {
        setArchiveError(SELF_ARCHIVE_BLOCK_MESSAGE);
      } else {
        clearSelfArchiveError();
      }

      setSelectedITAdminKeys(new Set(allowedKeys));
      return;
    }

    clearSelfArchiveError();
    setSelectedITAdminKeys(new Set());
  }, [clearSelfArchiveError, currentUserProtectedKeys, filteredITAdmins, getItAdminKey, setArchiveError]);

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
    const archiveCandidates = selectedRecords.filter((admin: any) => !currentUserProtectedKeys.has(getItAdminKey(admin)));

    if (archiveCandidates.length !== selectedRecords.length) {
      setArchiveError(SELF_ARCHIVE_BLOCK_MESSAGE);
      setSelectedITAdminKeys(new Set(archiveCandidates.map((admin: any) => getItAdminKey(admin))));
      return;
    }

    const userIds = archiveCandidates
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
  const response = await fetch("/api/it_admin/accounts/it_admin/archive", {
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
  }, [currentUserProtectedKeys, getItAdminKey, itAdmins, selectedITAdminKeys, setArchiveError, setITAdmins]);

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
    link.setAttribute('download', `it-admin-passwords-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setUploadedPasswords([]);
  }, [uploadedPasswords]);

  const handleDownloadTemplate = useCallback(() => {
    const link = document.createElement('a');
    link.href = '/it_admin/accounts/it_admin/IT Admin List  Template.xlsx';
    link.download = 'IT Admin List Template.xlsx';
    link.click();
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
          <UtilityButton small onClick={() => handleShowDetails(row)} title="Click to view details">
            View
          </UtilityButton>       
        )}
        selectable={selectMode}
        selectedItems={selectedITAdminKeys}
        onSelectAll={handleSelectAll}
        onSelectItem={(id, checked) => handleSelectItAdmin(String(id), checked)}
        nonSelectableIds={currentUserProtectedKeys}
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