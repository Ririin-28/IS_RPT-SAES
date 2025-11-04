import { useState, useRef, useCallback, useMemo, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { useForm } from "react-hook-form";
import * as XLSX from "xlsx";
import TableList from "@/components/Common/Tables/TableList";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import AccountActionsMenu, { type AccountActionKey } from "../components/AccountActionsMenu";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import MasterTeacherDetailsModal from "./Modals/MasterTeacherDetailsModal";
import AddMasterTeacherModal, { type AddMasterTeacherFormValues } from "./Modals/AddMasterTeacherModal";
import { MASTER_TEACHER_EXPORT_COLUMNS, exportAccountRows } from "../utils/export-columns";

const NAME_COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function normalizeContactDigits(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 0) {
    return null;
  }

  let local = digits;
  if (local.startsWith("63")) {
    local = local.slice(2);
  } else if (local.startsWith("0")) {
    local = local.slice(1);
  }

  if (local.length > 10) {
    local = local.slice(-10);
  }

  return local.length > 0 ? local : null;
}

function extractInternationalDigits(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) {
    return null;
  }

  if (digits.startsWith("63")) {
    return digits.slice(0, 12);
  }

  if (digits.startsWith("0")) {
    return `63${digits.slice(1, 11)}`;
  }

  if (digits.length === 10) {
    return `63${digits}`;
  }

  return digits;
}

function formatContactNumberForDisplay(value: unknown): string | null {
  const digits = normalizeContactDigits(value);
  if (digits && digits.length >= 9) {
    const local = digits.padStart(10, digits);
    const area = local.slice(0, 3);
    const middle = local.slice(3, 6);
    const tail = local.slice(6, 10);
    return `+63 ${area} ${middle} ${tail}`.trim();
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
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function sortMasterTeachers(records: any[]) {
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

const matchesGrade = (teacher: any, gradeFilter?: number) => {
  if (gradeFilter === undefined) {
    return true;
  }
  const gradeValue = teacher.grade;
  return gradeValue === gradeFilter || gradeValue === String(gradeFilter);
};

interface MasterTeacherTabProps {
  teachers: any[];
  setTeachers: Dispatch<SetStateAction<any[]>>;
  searchTerm: string;
  gradeFilter?: number;
  gradeLabel?: string;
  enableExport?: boolean;
}

export default function MasterTeacherTab({
  teachers,
  setTeachers,
  searchTerm,
  gradeFilter,
  gradeLabel,
  enableExport,
}: MasterTeacherTabProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedMasterTeacher, setSelectedMasterTeacher] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTeacherKeys, setSelectedTeacherKeys] = useState<Set<string>>(new Set());
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const normalizedLabel = gradeLabel ?? (gradeFilter ? `Grade ${gradeFilter}` : "All Grades");

  const addMasterTeacherForm = useForm<AddMasterTeacherFormValues>({
    mode: "onTouched",
    defaultValues: {
      teacherId: "",
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      grade: gradeFilter ? String(gradeFilter) : "",
      subjects: ["English", "Filipino", "Math"],
    },
  });

  const getTeacherKey = useCallback(
    (teacher: any) => {
      const fallbackIndex = teachers.indexOf(teacher);
      return String(
        teacher.id ??
          teacher.masterTeacherId ??
          teacher.teacherId ??
          teacher.email ??
          teacher.contactNumber ??
          teacher.name ??
          fallbackIndex,
      );
    },
    [teachers],
  );

  const handleMenuAction = useCallback(
    (action: AccountActionKey) => {
      if (action === "master-teacher:upload") {
        uploadInputRef.current?.click();
        return;
      }
      if (action === "master-teacher:add") {
        setSubmitError(null);
        setSuccessMessage(null);
        setArchiveError(null);
        addMasterTeacherForm.reset({
          teacherId: "",
          firstName: "",
          middleName: "",
          lastName: "",
          email: "",
          phoneNumber: "",
          grade: gradeFilter ? String(gradeFilter) : "",
          subjects: ["English", "Filipino", "Math"],
        });
        setShowAddModal(true);
        return;
      }
      if (action === "master-teacher:select") {
        setArchiveError(null);
        setSuccessMessage(null);
        setSelectMode(true);
        return;
      }
      console.log(`[Master Teacher ${normalizedLabel}] Action triggered: ${action}`);
    },
    [addMasterTeacherForm, gradeFilter, normalizedLabel],
  );

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false);
    setSubmitError(null);
    addMasterTeacherForm.reset({
      teacherId: "",
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      grade: gradeFilter ? String(gradeFilter) : "",
      subjects: ["English", "Filipino", "Math"],
    });
  }, [addMasterTeacherForm, gradeFilter]);

  const handleAddMasterTeacher = useCallback(
    async (values: AddMasterTeacherFormValues) => {
      const payload = {
        firstName: values.firstName.trim(),
        middleName: values.middleName.trim() || null,
        lastName: values.lastName.trim(),
        email: values.email.trim().toLowerCase(),
        phoneNumber: values.phoneNumber.trim(),
        grade: values.grade.trim(),
        subjects: values.subjects || ["English", "Filipino", "Math"],
        teacherId: values.teacherId.trim() || null,
      };

      const normalizedPhoneDigits = normalizeContactDigits(payload.phoneNumber);
      if (!normalizedPhoneDigits) {
        setSubmitError("Contact number is required.");
        return;
      }

      const emailToCheck = payload.email;

      const hasDuplicate = teachers.some((teacher: any) => {
        const emailMatch =
          typeof teacher.email === "string" && teacher.email.trim().toLowerCase() === emailToCheck;
        const existingDigits = normalizeContactDigits(
          teacher.contactNumberRaw ??
            teacher.contactNumber ??
            teacher.phoneNumber ??
            teacher.phone_number ??
            teacher.contact_number,
        );
        const phoneMatch = existingDigits && normalizedPhoneDigits ? existingDigits === normalizedPhoneDigits : false;
        return emailMatch || phoneMatch;
      });

      if (hasDuplicate) {
        setSubmitError("A master teacher with the same email or contact number already exists.");
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);
      setSuccessMessage(null);
      setArchiveError(null);

      try {
        const response = await fetch("/api/it_admin/master-teachers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload?.error ?? `Unable to add Master Teacher (status ${response.status}).`);
        }

        const result = await response.json();
        const record = result?.record ?? null;
        const userId = result?.userId ?? record?.userId ?? null;
        const temporaryPassword = result?.temporaryPassword ?? null;
        const internationalDigits = extractInternationalDigits(payload.phoneNumber) ?? "";
        const fallbackRecord = {
          userId,
          teacherId: payload.teacherId ?? (userId != null ? String(userId) : undefined),
          masterTeacherId: payload.teacherId ?? (userId != null ? String(userId) : undefined),
          firstName: payload.firstName,
          middleName: payload.middleName,
          lastName: payload.lastName,
          name: [payload.firstName, payload.middleName, payload.lastName].filter(Boolean).join(" "),
          email: payload.email,
          contactNumber: payload.phoneNumber,
          contactNumberRaw: normalizedPhoneDigits,
          contactNumberInternational: internationalDigits,
          grade: payload.grade,
          subjects: payload.subjects,
          status: "Active",
          lastLogin: null,
        };

        const normalizedRecord: any = record ? { ...record } : fallbackRecord;

        const recordDigits = normalizeContactDigits(
          normalizedRecord.contactNumberRaw ??
            normalizedRecord.contactNumber ??
            normalizedRecord.phoneNumber ??
            normalizedRecord.phone_number,
        );

        if (!normalizedRecord.contactNumberRaw && recordDigits) {
          normalizedRecord.contactNumberRaw = recordDigits;
        }

        if (!normalizedRecord.contactNumber) {
          normalizedRecord.contactNumber = payload.phoneNumber;
        }

        if (!normalizedRecord.grade) {
          normalizedRecord.grade = payload.grade;
        }

        setTeachers((prev: any[]) => {
          const withoutExisting = prev.filter((item: any) => {
            if (normalizedRecord.userId == null) {
              return true;
            }
            return item.userId !== normalizedRecord.userId;
          });
          return sortMasterTeachers([...withoutExisting, normalizedRecord]);
        });

        addMasterTeacherForm.reset({
          teacherId: "",
          firstName: "",
          middleName: "",
          lastName: "",
          email: "",
          phoneNumber: "",
          grade: gradeFilter ? String(gradeFilter) : "",
          subjects: ["English", "Filipino", "Math"],
        });
        setShowAddModal(false);
        if (temporaryPassword) {
          setSuccessMessage(
            `${normalizedRecord.name ?? "New Master Teacher"} added successfully. Temporary password: ${temporaryPassword}`,
          );
        } else {
          setSuccessMessage(`${normalizedRecord.name ?? "New Master Teacher"} added successfully.`);
        }
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Unable to add Master Teacher.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [addMasterTeacherForm, gradeFilter, setTeachers, teachers],
  );

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

        const newTeachers = jsonData.map((row: any, index: number) => {
          const fullName = `${row.FIRSTNAME || ""} ${row.MIDDLENAME || ""} ${row.SURNAME || ""}`.trim();
          const derivedGrade = gradeFilter !== undefined ? gradeFilter : row["HANDLED GRADE"] || row.grade;

          return {
            id: Date.now() + index,
            teacherId: row["TEACHER ID"] || "",
            name: fullName,
            email: row["EMAIL"] || "",
            contactNumber: row["CONTACT NUMBER"] || "",
            grade: derivedGrade ?? "",
            handledGrade: row["HANDLED GRADE"] || "",
            handledSubjects: row["HANDLED SUBJECTS"] || "",
          };
        });

        setTeachers((prev) => sortMasterTeachers([...prev, ...newTeachers]));
        alert(`Successfully imported ${newTeachers.length} teachers`);
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
  }, [gradeFilter, selectedFile, setTeachers]);

  const handleUploadCancel = useCallback(() => {
    setSelectedFile(null);
    setShowConfirmModal(false);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }, []);

  const scopedTeachers = useMemo(
    () => teachers.filter((teacher: any) => matchesGrade(teacher, gradeFilter)),
    [teachers, gradeFilter],
  );

  const filteredTeachers = useMemo(() => {
    return scopedTeachers.filter((teacher: any) => {
      const loweredSearch = searchTerm.toLowerCase();
      const matchSearch =
        searchTerm === "" ||
        teacher.name?.toLowerCase().includes(loweredSearch) ||
        teacher.email?.toLowerCase().includes(loweredSearch) ||
        teacher.teacherId?.toLowerCase().includes(loweredSearch) ||
        teacher.masterTeacherId?.toLowerCase().includes(loweredSearch);

      return matchSearch;
    });
  }, [scopedTeachers, searchTerm]);

  const handleShowDetails = (teacher: any) => {
    setSelectedMasterTeacher(teacher);
    setShowDetailModal(true);
  };

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

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const keys = new Set(filteredTeachers.map((teacher: any) => getTeacherKey(teacher)));
        setSelectedTeacherKeys(keys);
        return;
      }
      setSelectedTeacherKeys(new Set());
    },
    [filteredTeachers, getTeacherKey],
  );

  const handleCancelSelect = useCallback(() => {
    setSelectMode(false);
    setSelectedTeacherKeys(new Set());
    setArchiveError(null);
  }, []);

  const handleArchiveSelected = useCallback(() => {
    if (selectedTeacherKeys.size === 0) return;
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
      .map((teacher: any) => {
        return (
          extractNumericId(teacher.userId ?? teacher.user_id) ??
          extractNumericId(teacher.masterTeacherId ?? teacher.master_teacher_id ?? teacher.teacherId)
        );
      })
      .filter((value): value is number => value !== null);

    const uniqueUserIds = Array.from(new Set(userIds));

    if (uniqueUserIds.length === 0) {
      setArchiveError("Unable to determine user IDs for the selected master teachers.");
      return;
    }

    setIsArchiving(true);
    setArchiveError(null);
    try {
      const response = await fetch("/api/it_admin/master-teachers/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: uniqueUserIds }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error ?? `Failed to archive master teachers (status ${response.status}).`);
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
          const candidateId =
            extractNumericId(teacher.userId ?? teacher.user_id) ??
            extractNumericId(teacher.masterTeacherId ?? teacher.master_teacher_id ?? teacher.teacherId);
          if (candidateId === null) {
            return true;
          }
          return !effectiveIds.includes(candidateId);
        });
        return sortMasterTeachers(remaining);
      });

      const archivedCount = effectiveIds.length;
      setSuccessMessage(`Archived ${archivedCount} master teacher${archivedCount === 1 ? "" : "s"} successfully.`);
      setSelectedTeacherKeys(new Set());
      setSelectMode(false);
      setShowArchiveModal(false);
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "Failed to archive the selected master teachers.");
    } finally {
      setIsArchiving(false);
    }
  }, [getTeacherKey, selectedTeacherKeys, setTeachers, teachers]);

  const handleCloseArchiveModal = useCallback(() => {
    setShowArchiveModal(false);
    setArchiveError(null);
    setIsArchiving(false);
  }, []);

  const handleExport = useCallback(() => {
    void exportAccountRows({
      rows: filteredTeachers,
      columns: MASTER_TEACHER_EXPORT_COLUMNS,
      baseFilename: "master-teacher-accounts",
      sheetName: "Master Teacher Accounts",
      emptyMessage: "No master teacher accounts available to export.",
    });
  }, [filteredTeachers]);

  const totalLabel = gradeFilter ? `Total` : "Total";

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <p className="text-gray-600 text-md font-medium">
          {totalLabel}: {scopedTeachers.length}
        </p>
        <div className="flex items-center justify-end gap-3">
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
              accountType="Master Teachers"
              onAction={handleMenuAction}
              buttonAriaLabel="Open master teacher actions"
              exportConfig={
                enableExport
                  ? {
                      onExport: handleExport,
                      disabled: filteredTeachers.length === 0,
                    }
                  : undefined
              }
            />
          )}
          <input
            ref={uploadInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <MasterTeacherDetailsModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        masterTeacher={selectedMasterTeacher}
      />

      <AddMasterTeacherModal
        show={showAddModal}
        onClose={handleCloseAddModal}
        onSubmit={handleAddMasterTeacher}
        form={addMasterTeacherForm}
        isSubmitting={isSubmitting}
        apiError={submitError}
      />

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleUploadCancel}
        onConfirm={handleUploadConfirm}
        title="Confirm File Upload"
        message="Are you sure you want to upload this Excel file? This will import teacher data."
        fileName={selectedFile?.name}
      />

      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "teacherId", title: "Teacher ID" },
          { key: "name", title: "Full Name" },
          { key: "email", title: "Email" },
          { key: "grade", title: "Grade", render: (row: any) => row.grade ?? "—" },
          { key: "contactNumber", title: "Contact Number" },
        ]}
        data={filteredTeachers.map((teacher: any, idx: number) => {
          const contactDigits = normalizeContactDigits(
            teacher.contactNumberRaw ??
              teacher.contactNumber ??
              teacher.phoneNumber ??
              teacher.phone_number ??
              teacher.contact_number,
          );

          return {
            ...teacher,
            id: getTeacherKey(teacher),
            no: idx + 1,
            grade: teacher.grade ?? teacher.handledGrade ?? teacher.handled_grade ?? "—",
            contactNumber: formatContactNumberForDisplay(
              teacher.contactNumber ??
                teacher.contact_number ??
                teacher.phoneNumber ??
                teacher.phone_number ??
                teacher.contactNumberRaw ??
                contactDigits ??
                undefined,
            ) ?? "—",
          };
        })}
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
        message={`Are you sure you want to archive ${selectedTeacherKeys.size} selected master teacher${selectedTeacherKeys.size === 1 ? "" : "s"}? This will move them to the archive.`}
        confirmLabel="Archive"
        confirmDisabled={selectedTeacherKeys.size === 0}
        isProcessing={isArchiving}
        errorMessage={archiveError}
      />
    </div>
  );
}