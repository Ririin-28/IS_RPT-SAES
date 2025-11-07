import { useState, useCallback, useMemo, useRef, type ChangeEvent } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useForm } from "react-hook-form";
import * as XLSX from "xlsx";
import TableList from "@/components/Common/Tables/TableList";
import TeacherDetailsModal from "./Modals/TeacherDetailsModal";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import AccountActionsMenu, { type AccountActionKey } from "../components/AccountActionsMenu";
import AddTeacherModal, { type AddTeacherFormValues } from "./Modals/AddTeacherModal";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import { exportAccountRows, TEACHER_EXPORT_COLUMNS } from "../utils/export-columns";

const NAME_COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const DEFAULT_SUBJECTS = ["English", "Filipino", "Math"] as const;
const DEFAULT_SUBJECTS_STRING = DEFAULT_SUBJECTS.join(", ");

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

function normalizeTeacherRecord(record: any) {
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
  normalized.grade = toStringOrNull(
    record.grade ??
      record.handledGrade ??
      record.handled_grade ??
      record.gradeLevel ??
      record.grade_level ??
      record.yearLevel ??
      record.year_level ??
      record.remedialGrade ??
      record.remedial_grade ??
      record.remedial_teacher_grade,
  );
  normalized.section = toStringOrNull(record.section);
  normalized.subjects = DEFAULT_SUBJECTS_STRING;
  normalized.status = toStringOrNull(record.status) ?? "Active";
  normalized.lastLogin = record.lastLogin ?? null;
  normalized.lastLoginDisplay = formatTimestamp(record.lastLogin ?? null);

  if (userId !== null && userId !== undefined) {
    const userIdString = String(userId);
    normalized.teacherId = toStringOrNull(record.teacherId) ?? userIdString;
  } else {
    normalized.teacherId = toStringOrNull(record.teacherId);
  }

  return normalized;
}

function sortTeachers(records: any[]) {
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

interface TeacherTabProps {
  teachers: any[];
  setTeachers: Dispatch<SetStateAction<any[]>>;
  searchTerm: string;
}

export default function TeacherTab({ teachers, setTeachers, searchTerm }: TeacherTabProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTeacherKeys, setSelectedTeacherKeys] = useState<Set<string>>(new Set());
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [uploadedPasswords, setUploadedPasswords] = useState<Array<{name: string; email: string; password: string}>>([]);

  const addTeacherForm = useForm<AddTeacherFormValues>({
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      suffix: "",
      email: "",
      phoneNumber: "",
      grade: "",
      subjects: [...DEFAULT_SUBJECTS],
    },
  });

  const getTeacherKey = useCallback((teacher: any) => {
    const fallbackIndex = teachers.indexOf(teacher);
    return String(
      teacher.userId ??
        teacher.user_id ??
        teacher.teacherId ??
        teacher.teacher_id ??
        teacher.email ??
        fallbackIndex,
    );
  }, [teachers]);

  const handleMenuAction = useCallback((action: AccountActionKey) => {
    if (action === "teacher:add") {
      setSubmitError(null);
      setSuccessMessage(null);
      setArchiveError(null);
      addTeacherForm.reset();
      setShowAddModal(true);
      return;
    }
    if (action === "teacher:upload") {
      uploadInputRef.current?.click();
      return;
    }
    if (action === "teacher:select") {
      setArchiveError(null);
      setSuccessMessage(null);
      setSelectMode(true);
      return;
    }

    console.log(`[Teacher Tab] Action triggered: ${action}`);
  }, [addTeacherForm]);

  const filteredTeachers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (query.length === 0) {
      return teachers;
    }

    return teachers.filter((teacher) => {
      const nameMatch = teacher.name?.toLowerCase().includes(query);
      const emailMatch = teacher.email?.toLowerCase().includes(query);
      const idMatch = (teacher.teacherId ?? "").toLowerCase().includes(query);

      return Boolean(nameMatch || emailMatch || idMatch);
    });
  }, [teachers, searchTerm]);

  const handleExport = useCallback(() => {
    void exportAccountRows({
      rows: filteredTeachers,
      columns: TEACHER_EXPORT_COLUMNS,
      baseFilename: "teacher-accounts",
      sheetName: "Teacher Accounts",
      emptyMessage: "No teacher accounts available to export.",
    });
  }, [filteredTeachers]);

  const handleShowDetails = (teacher: any) => {
    setSelectedTeacher(teacher);
    setShowDetailModal(true);
  };

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false);
    setSubmitError(null);
    addTeacherForm.reset();
  }, [addTeacherForm]);

  const handleSubmitAdd = useCallback(async (values: AddTeacherFormValues) => {
    const payload = {
      firstName: values.firstName.trim(),
      middleName: values.middleName.trim() || null,
      lastName: values.lastName.trim(),
      suffix: values.suffix.trim() || null,
      email: values.email.trim().toLowerCase(),
      phoneNumber: values.phoneNumber.replace(/\D/g, ""),
      grade: values.grade.trim(),
  subjects: DEFAULT_SUBJECTS_STRING,
    };

    setIsSubmitting(true);
    setSubmitError(null);
    try {
  const response = await fetch("/api/it_admin/accounts/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? `Unable to add Teacher (status ${response.status}).`);
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
        grade: payload.grade,
        subjects: payload.subjects,
        teacherId: userId != null ? String(userId) : undefined,
        lastLogin: null,
      };

      const normalizedRecord = normalizeTeacherRecord(record ?? fallbackRecord);

      setTeachers((prev: any[]) => {
        const withoutExisting = prev.filter((item: any) => item?.userId !== normalizedRecord.userId);
        return sortTeachers([...withoutExisting, normalizedRecord]);
      });

      setShowAddModal(false);
      if (temporaryPassword) {
        setSuccessMessage(
          `${normalizedRecord.name ?? "New Teacher"} added successfully. Temporary password: ${temporaryPassword}`,
        );
      } else {
        setSuccessMessage(`${normalizedRecord.name ?? "New Teacher"} added successfully.`);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to add Teacher.");
    } finally {
      setIsSubmitting(false);
    }
  }, [setTeachers]);

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
          const teachersPayload = jsonData
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
              const grade = readField(row, [
                "GRADE",
                "Grade",
                "grade",
                "HANDLED GRADE",
                "handled_grade",
                "handledGrade",
              ]);
              const phoneNumber = contactRaw.replace(/\D/g, "");

              if (!firstName || !lastName || !email || !grade || phoneNumber.length < 10) {
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
                grade,
                subjects: DEFAULT_SUBJECTS_STRING,
              };
            })
            .filter((payload): payload is Required<typeof payload> => payload !== null);

          if (teachersPayload.length === 0) {
            setSuccessMessage(null);
            setArchiveError(
              invalidRows > 0
                ? "No valid rows found in the uploaded file. Check required columns (First Name, Last Name, Email, Grade, Contact Number)."
                : "The uploaded file does not contain any data.",
            );
            return;
          }

          setArchiveError(null);
          setSuccessMessage(null);

          const response = await fetch("/api/it_admin/accounts/teachers/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teachers: teachersPayload }),
          });

          const result = await response.json().catch(() => ({}));
          const inserted = Array.isArray(result?.inserted) ? result.inserted : [];
          const failures = Array.isArray(result?.failures) ? result.failures : [];
          const normalizedRecords = inserted
            .map((entry: any) => normalizeTeacherRecord(entry?.record ?? {}))
            .filter((record: any) => record.userId !== null && record.userId !== undefined);

          if (normalizedRecords.length > 0) {
            setTeachers((prev) => {
              const existingIds = new Set(normalizedRecords.map((record: any) => String(record.userId)));
              const remaining = prev.filter((item: any) => !existingIds.has(String(item.userId ?? item.teacherId ?? item.email ?? "")));
              return sortTeachers([...remaining, ...normalizedRecords]);
            });
          }

          if (inserted.length > 0) {
            const passwordMap = inserted
              .map((entry: any) => {
                const rec = entry?.record ?? {};
                // Prefer the provided full name; otherwise compose from first/last if available; fallback to 'Unknown'
                const providedName = rec.name ?? null;
                if (providedName && String(providedName).trim().length > 0) {
                  return {
                    name: String(providedName),
                    email: rec.email ?? '',
                    password: entry?.temporaryPassword ?? '',
                  };
                }
                const first = rec.firstName ?? rec.first_name ?? '';
                const last = rec.lastName ?? rec.last_name ?? '';
                const composed = `${first} ${last}`.trim();
                return {
                  name: composed.length > 0 ? composed : 'Unknown',
                  email: rec.email ?? '',
                  password: entry?.temporaryPassword ?? '',
                };
              })
              .filter((item: any) => item.email && item.password);
            if (passwordMap.length > 0) {
              setUploadedPasswords(passwordMap);
              console.info("Temporary passwords for imported Teacher accounts:", passwordMap);
            }
          }

          const successCount = normalizedRecords.length;
          const failureCount = failures.length + invalidRows;

          if (successCount > 0) {
            const parts: string[] = [];
            parts.push(`Imported ${successCount} Teacher${successCount === 1 ? "" : "s"} successfully.`);
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
              : "Failed to import Teacher accounts.";
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
    setTeachers,
    setArchiveError,
    setSuccessMessage,
    setSelectedFile,
    setShowConfirmModal,
  ]);

  const handleUploadCancel = useCallback(() => {
    setSelectedFile(null);
    setShowConfirmModal(false);
    const input = uploadInputRef.current;
    if (input) {
      input.value = "";
    }
  }, []);

  const handleSelectTeacher = useCallback((id: string, checked: boolean) => {
    setSelectedTeacherKeys((prev) => {
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
      const keys = new Set(filteredTeachers.map((teacher: any) => getTeacherKey(teacher)));
      setSelectedTeacherKeys(keys);
      return;
    }
    setSelectedTeacherKeys(new Set());
  }, [filteredTeachers, getTeacherKey]);

  const handleCancelSelect = useCallback(() => {
    setSelectMode(false);
    setSelectedTeacherKeys(new Set());
    setArchiveError(null);
  }, []);

  const handleArchiveSelected = useCallback(() => {
    if (selectedTeacherKeys.size === 0) {
      return;
    }
    setArchiveError(null);
    setSuccessMessage(null);
    setShowArchiveModal(true);
  }, [selectedTeacherKeys]);

  const handleConfirmArchiveSelected = useCallback(async () => {
    if (selectedTeacherKeys.size === 0) {
      return;
    }

    const selectedRecords = teachers.filter((teacher: any) => selectedTeacherKeys.has(getTeacherKey(teacher)));
    const userIds = selectedRecords
      .map((teacher: any) => extractNumericId(teacher.userId ?? teacher.user_id ?? teacher.teacherId ?? teacher.teacher_id))
      .filter((value): value is number => value !== null);

    const uniqueUserIds = Array.from(new Set(userIds));

    if (uniqueUserIds.length === 0) {
      setArchiveError("Unable to determine user IDs for the selected Teachers.");
      return;
    }

    setIsArchiving(true);
    setArchiveError(null);
    try {
  const response = await fetch("/api/it_admin/accounts/teachers/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: uniqueUserIds }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? `Failed to archive Teachers (status ${response.status}).`);
      }

      const payload = await response.json().catch(() => ({}));
      const archivedIds = Array.isArray(payload?.archived)
        ? payload.archived
            .map((item: any) => extractNumericId(item?.userId ?? item?.user_id))
            .filter((value: number | null): value is number => value !== null)
        : uniqueUserIds;

      const effectiveIds = archivedIds.length > 0 ? archivedIds : uniqueUserIds;

      setTeachers((prev) => {
        const remaining = prev.filter((teacher: any) => {
          const candidateId = extractNumericId(teacher.userId ?? teacher.user_id ?? teacher.teacherId ?? teacher.teacher_id);
          if (candidateId === null) {
            return true;
          }
          return !effectiveIds.includes(candidateId);
        });
        return sortTeachers(remaining);
      });

      const archivedCount = effectiveIds.length;
      setSuccessMessage(`Archived ${archivedCount} Teacher${archivedCount === 1 ? "" : "s"} successfully.`);
      setSelectedTeacherKeys(new Set());
      setSelectMode(false);
      setShowArchiveModal(false);
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "Failed to archive the selected Teachers.");
    } finally {
      setIsArchiving(false);
    }
  }, [getTeacherKey, teachers, selectedTeacherKeys, setTeachers]);

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
    link.setAttribute('download', `teacher-passwords-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setUploadedPasswords([]);
  }, [uploadedPasswords]);

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4 gap-4">
        <p className="text-gray-600 text-md font-medium">
          Total: {teachers.length}
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
                disabled={selectedTeacherKeys.size === 0}
                className={selectedTeacherKeys.size === 0 ? "opacity-60 cursor-not-allowed" : ""}
              >
                Archive ({selectedTeacherKeys.size})
              </DangerButton>
            </>
          ) : (
            <AccountActionsMenu
              accountType="Teachers"
              onAction={handleMenuAction}
              buttonAriaLabel="Open Teacher actions"
              exportConfig={{
                onExport: handleExport,
                disabled: filteredTeachers.length === 0,
              }}
              downloadPasswordsConfig={{
                onDownload: handleDownloadPasswords,
                disabled: uploadedPasswords.length === 0,
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

      <AddTeacherModal
        show={showAddModal}
        onClose={handleCloseAddModal}
        onSubmit={handleSubmitAdd}
        form={addTeacherForm}
        isSubmitting={isSubmitting}
        apiError={submitError}
      />
      
      <TeacherDetailsModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        teacher={selectedTeacher}
      />

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleUploadCancel}
        onConfirm={handleUploadConfirm}
        title="Confirm File Upload"
        message="Are you sure you want to upload this Excel file? This will import Teacher data."
        fileName={selectedFile?.name}
      />

      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "teacherId", title: "Teacher ID", render: (row: any) => row.teacherId ?? "—" },
          { key: "name", title: "Full Name", render: (row: any) => row.name ?? "—" },
          { key: "email", title: "Email", render: (row: any) => row.email ?? "—" },
          { key: "grade", title: "Grade", render: (row: any) => row.grade ?? "—" },
          {
            key: "lastLogin",
            title: "Last Login",
            render: (row: any) => row.lastLoginDisplay ?? "—",
          },
        ]}
        data={filteredTeachers.map((teacher, idx) => ({
          ...teacher,
          id: getTeacherKey(teacher),
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleShowDetails(row)}>
            View Details
          </UtilityButton>
        )}
        selectable={selectMode}
        selectedItems={selectedTeacherKeys}
        onSelectAll={handleSelectAll}
        onSelectItem={(id, checked) => handleSelectTeacher(String(id), checked)}
        pageSize={10}
      />

      <DeleteConfirmationModal
        isOpen={showArchiveModal}
        onClose={handleCloseArchiveModal}
        onConfirm={handleConfirmArchiveSelected}
        title="Confirm Archive Selected"
        message={`Are you sure you want to archive ${selectedTeacherKeys.size} selected Teacher${selectedTeacherKeys.size === 1 ? "" : "s"}? This will move them to the archive.`}
        confirmLabel="Archive"
        confirmDisabled={selectedTeacherKeys.size === 0}
        isProcessing={isArchiving}
        errorMessage={archiveError}
      />
    </div>
  );
}