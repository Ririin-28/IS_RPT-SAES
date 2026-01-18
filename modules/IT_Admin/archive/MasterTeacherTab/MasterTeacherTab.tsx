import { useMemo, useCallback, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import TableList from "@/components/Common/Tables/TableList";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import AccountRestoredModal, { type RestoredAccountInfo } from "@/components/Common/Modals/AccountRestoredModal";
import { useArchiveRestoreDelete } from "../Common/useArchiveRestoreDelete";
import { ensureArchiveRowKey } from "../Common/archiveRowKey";
import { exportArchiveRows } from "../utils/export-columns";
import MasterTeacherDetailsModal from "@/modules/IT_Admin/accounts/MasterTeacherTab/Modals/MasterTeacherDetailsModal";

type ColumnConfig = {
  key: string;
  title: string;
  render?: (row: any) => ReactNode;
};

interface MasterTeacherArchiveTabProps {
  teachers: any[];
  setTeachers: Dispatch<SetStateAction<any[]>>;
  searchTerm: string;
  gradeFilter?: number;
  gradeLabel?: string;
  onEntriesRemoved?: (archiveIds: number[]) => void;
}

const matchesGrade = (teacher: any, gradeFilter?: number) => {
  if (gradeFilter === undefined) {
    return true;
  }
  const gradeValue = teacher.grade;
  if (gradeValue === null || gradeValue === undefined) {
    return false;
  }
  return gradeValue === gradeFilter || gradeValue === String(gradeFilter);
};

export default function MasterTeacherTab({
  teachers,
  setTeachers,
  searchTerm,
  gradeFilter,
  gradeLabel,
  onEntriesRemoved,
}: MasterTeacherArchiveTabProps) {
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [restoredAccounts, setRestoredAccounts] = useState<RestoredAccountInfo[]>([]);
  const normalizedLabel = gradeLabel ?? (gradeFilter ? `Grade ${gradeFilter}` : "All Grades");

  const resolveTeacherId = useCallback((teacher: any) => {
    return (
      teacher?.masterTeacherId ??
      teacher?.master_teacher_id ??
      teacher?.teacherId ??
      teacher?.teacher_id ??
      teacher?.user_code ??
      teacher?.userId ??
      teacher?.user_id ??
      ""
    );
  }, []);

  const keySelector = useCallback((item: any) => {
    if (!item) {
      return undefined;
    }
    if (item.archiveId != null) {
      return String(item.archiveId);
    }
    if (item.archive_id != null) {
      return String(item.archive_id);
    }
    return ensureArchiveRowKey(item);
  }, []);

  const resolveRecordsByKeys = useCallback(
    (keys: string[]) => {
      if (!keys.length) {
        return [];
      }
      const keySet = new Set(keys.map(String));
      return teachers.filter((item: any) => {
        const key = keySelector(item);
        return key ? keySet.has(String(key)) : false;
      });
    },
    [teachers, keySelector],
  );

  const handleRestoreAction = useCallback(
    async (selectedKeys: string[], resetSelection: () => void) => {
      const selectedRecords = resolveRecordsByKeys(selectedKeys);
      const archiveIds = Array.from(
        new Set(
          selectedRecords
            .map((record) => {
              const value = record?.archiveId ?? record?.archive_id;
              const numeric = Number(value);
              return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
            })
            .filter((value: number | null): value is number => value !== null),
        ),
      );

      if (archiveIds.length === 0) {
        if (selectedRecords.length > 0 && typeof window !== "undefined") {
          window.alert("Selected archive entries are missing identifiers. Please refresh and try again.");
        }
        resetSelection();
        return;
      }

      try {
        const response = await fetch("/api/it_admin/archive/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archiveIds }),
        });

        const data: any = await response.json();

        if (!response.ok) {
          const message = typeof data?.error === "string" && data.error.trim().length > 0
            ? data.error
            : "Failed to restore archived accounts.";
          throw new Error(message);
        }

        const restoredEntries: Array<{
          archiveId: number;
          userId: number;
          name?: string;
          email?: string;
          temporaryPassword?: string;
        }> = Array.isArray(data?.restored) ? data.restored : [];

        const restoredArchiveIds = restoredEntries
          .map((entry) => Number(entry.archiveId))
          .filter((value) => Number.isInteger(value) && value > 0);

        if (restoredArchiveIds.length > 0) {
          const removedSet = new Set(restoredArchiveIds);
          setTeachers((prev) =>
            prev.filter((entry: any) => {
              const value = entry?.archiveId ?? entry?.archive_id;
              return !(typeof value === "number" && removedSet.has(value));
            }),
          );
          onEntriesRemoved?.(restoredArchiveIds);
        }

        if (restoredEntries.length > 0) {
          setRestoredAccounts(
            restoredEntries.map((entry) => ({
              name: entry.name || entry.email || `User ${entry.userId}`,
              email: entry.email ?? "",
              temporaryPassword: entry.temporaryPassword ?? "",
            })),
          );
        }

        if (Array.isArray(data?.errors) && data.errors.length > 0) {
          console.warn("Some archive entries failed to restore:", data.errors);
          if (restoredEntries.length === 0 && typeof window !== "undefined") {
            const errorLines = data.errors
              .map((err: any) => `#${err?.archiveId ?? "?"}: ${err?.message ?? "Unable to restore."}`)
              .join("\n");
            window.alert(`Unable to restore the selected accounts.\n\n${errorLines}`);
          }
        }

        if (restoredEntries.length > 0) {
          resetSelection();
        }
      } catch (error) {
        console.error("Failed to restore archived Master Teacher accounts", error);
        if (typeof window !== "undefined") {
          const message = error instanceof Error ? error.message : "Failed to restore archived accounts.";
          window.alert(message);
        }
      }
    },
    [resolveRecordsByKeys, setTeachers, onEntriesRemoved],
  );

  const handleDeleteAction = useCallback(
    async (selectedKeys: string[], resetSelection: () => void) => {
      const selectedRecords = resolveRecordsByKeys(selectedKeys);
      const archiveIds = Array.from(
        new Set(
          selectedRecords
            .map((record) => {
              const value = record?.archiveId ?? record?.archive_id;
              const numeric = Number(value);
              return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
            })
            .filter((value: number | null): value is number => value !== null),
        ),
      );

      if (archiveIds.length === 0) {
        if (selectedRecords.length > 0 && typeof window !== "undefined") {
          window.alert("Selected archive entries are missing identifiers. Please refresh and try again.");
        }
        resetSelection();
        return;
      }

      try {
        const response = await fetch("/api/it_admin/archive/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archiveIds }),
        });

        const data: any = await response.json();

        if (!response.ok) {
          const message = typeof data?.error === "string" && data.error.trim().length > 0
            ? data.error
            : "Failed to delete archived accounts.";
          throw new Error(message);
        }

        const deletedArchiveIds: number[] = Array.isArray(data?.deletedArchiveIds)
          ? data.deletedArchiveIds
              .map((value: unknown) => {
                const numeric = Number(value);
                return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
              })
              .filter((value: number | null): value is number => value !== null)
          : [];

        if (deletedArchiveIds.length > 0) {
          const removedSet = new Set(deletedArchiveIds);
          setTeachers((prev) =>
            prev.filter((entry: any) => {
              const value = entry?.archiveId ?? entry?.archive_id;
              return !(typeof value === "number" && removedSet.has(value));
            }),
          );
          onEntriesRemoved?.(deletedArchiveIds);
        }

        if (deletedArchiveIds.length > 0 && typeof window !== "undefined") {
          window.alert(
            `Deleted ${deletedArchiveIds.length} archived account${deletedArchiveIds.length === 1 ? "" : "s"}.`,
          );
        }

        resetSelection();
      } catch (error) {
        console.error("Failed to delete archived Master Teacher accounts", error);
        if (typeof window !== "undefined") {
          const message = error instanceof Error ? error.message : "Failed to delete archived accounts.";
          window.alert(message);
        }
      }
    },
    [resolveRecordsByKeys, setTeachers, onEntriesRemoved],
  );

  const {
    action,
    selectMode,
    selectedKeys,
    selectedCount,
    enterAction,
    cancelSelection,
    toggleItem,
    toggleAll,
    requestConfirmation,
    restoreModalOpen,
    deleteModalOpen,
    setRestoreModalOpen,
    setDeleteModalOpen,
    confirmRestore,
    confirmDelete,
  } = useArchiveRestoreDelete(setTeachers, {
    keySelector,
    onRestore: handleRestoreAction,
    onDelete: handleDeleteAction,
  });

  const scopedTeachers = useMemo(
    () => teachers.filter((teacher: any) => matchesGrade(teacher, gradeFilter)),
    [teachers, gradeFilter],
  );

  const filteredTeachers = useMemo(() => {
    const loweredSearch = searchTerm.trim().toLowerCase();
    return scopedTeachers.filter((teacher) => {
      const teacherId = String(resolveTeacherId(teacher));
      return (
        loweredSearch.length === 0 ||
        teacher.name?.toLowerCase().includes(loweredSearch) ||
        teacherId.toLowerCase().includes(loweredSearch)
      );
    });
  }, [resolveTeacherId, scopedTeachers, searchTerm]);

  const handleViewDetails = useCallback((teacher: any) => {
    const resolvedTeacherId = resolveTeacherId(teacher);
    setSelectedTeacher({
      ...teacher,
      teacherId: resolvedTeacherId || teacher?.teacherId,
      masterTeacherId:
        teacher?.masterTeacherId ??
        teacher?.master_teacher_id ??
        resolvedTeacherId,
    });
    setShowDetailsModal(true);
  }, [resolveTeacherId]);

  const handleCloseDetails = useCallback(() => {
    setShowDetailsModal(false);
    setSelectedTeacher(null);
  }, []);

  const tableData = useMemo(
    () =>
      filteredTeachers.map((teacher, idx) => {
        const archiveKey = keySelector(teacher) ?? ensureArchiveRowKey(teacher);
        return {
          ...teacher,
          id: archiveKey,
          no: idx + 1,
        };
      }),
    [filteredTeachers, keySelector],
  );

  const exportEmptyMessage =
    normalizedLabel === "All Grades"
      ? "No master teacher archive records available to export."
      : `No ${normalizedLabel} master teacher archive records available to export.`;

  const handleExport = () => {
    void exportArchiveRows({
      rows: filteredTeachers,
      accountLabel: "Master Teacher",
      gradeLabel: normalizedLabel,
      emptyMessage: exportEmptyMessage,
    });
  };

  const tableColumns = useMemo<ColumnConfig[]>(() => {
    const baseColumns: ColumnConfig[] = [
      { key: "no", title: "No#" },
      { 
        key: "teacherId", 
        title: "Teacher ID",
        render: (row: any) =>
          row.masterTeacherId ??
          row.master_teacher_id ??
          row.teacherId ??
          row.teacher_id ??
          row.user_code ??
          row.userId ??
          row.user_id ??
          "—",
      },
      { key: "name", title: "Full Name" },
      {
        key: "archivedDate",
        title: "Archived Date",
        render: (row: any) => row.archivedDateDisplay ?? "—",
      },
    ];

    return baseColumns;
  }, []);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <p className="text-gray-600 text-md font-medium">Total: {scopedTeachers.length}</p>

        <div className="flex items-center gap-2 sm:justify-end">
            {selectMode ? (
              <>
                <SecondaryButton small onClick={cancelSelection}>
                  Cancel
                </SecondaryButton>
                {action === "restore" ? (
                  <PrimaryButton
                    small
                    disabled={selectedCount === 0}
                    onClick={requestConfirmation}
                    className="flex items-center gap-2"
                  >
                    Restore ({selectedCount})
                  </PrimaryButton>
                ) : (
                  <DangerButton
                    small
                    disabled={selectedCount === 0}
                    onClick={requestConfirmation}
                    className="flex items-center gap-2"
                  >
                    Delete ({selectedCount})
                  </DangerButton>
                )}
              </>
            ) : (
              <KebabMenu
                small
                align="right"
                renderItems={(close) => (
                  <div className="py-1">
                    <button
                      onClick={() => {
                        enterAction("restore");
                        close();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-archive-restore-icon lucide-archive-restore"
                      >
                        <rect width="20" height="5" x="2" y="3" rx="1" />
                        <path d="M4 8v11a2 2 0 0 0 2 2h2" />
                        <path d="M20 8v11a2 2 0 0 1-2 2h-2" />
                        <path d="m9 15 3-3 3 3" />
                        <path d="M12 12v9" />
                      </svg>
                      Restore
                    </button>
                    <button
                      onClick={() => {
                        enterAction("delete");
                        close();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-trash-icon lucide-trash"
                      >
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!filteredTeachers.length) {
                          return;
                        }
                        handleExport();
                        close();
                      }}
                      className={`mt-1 flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                        filteredTeachers.length === 0 ? "text-gray-300 cursor-not-allowed" : "text-[#013300] hover:bg-gray-50"
                      }`}
                      aria-disabled={filteredTeachers.length === 0}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
                      </svg>
                      Export to Excel
                    </button>
                  </div>
                )}
              />
            )}
        </div>
      </div>

      <TableList
        columns={tableColumns}
        data={tableData}
        actions={(row: any) => (
          <UtilityButton small onClick={() => handleViewDetails(row)}>
            View
          </UtilityButton>
        )}
        pageSize={10}
        selectable={selectMode}
        selectedItems={selectedKeys}
        onSelectAll={(checked) => toggleAll(tableData.map((row) => row.id ?? ""), checked)}
        onSelectItem={(id, checked) => toggleItem(id, checked)}
      />

      <ConfirmationModal
        isOpen={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        onConfirm={confirmRestore}
        title="Restore Accounts"
        message={`Restore ${selectedCount} archived account${selectedCount === 1 ? "" : "s"}? They will return to the active list.`}
      />
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Archived Accounts"
        message={`Permanently delete ${selectedCount} archived account${selectedCount === 1 ? "" : "s"}? This action cannot be undone.`}
      />

      <MasterTeacherDetailsModal
        show={showDetailsModal}
        onClose={handleCloseDetails}
        masterTeacher={selectedTeacher}
      />

      <AccountRestoredModal
        show={restoredAccounts.length > 0}
        onClose={() => setRestoredAccounts([])}
        accounts={restoredAccounts}
        roleLabel="Master Teacher"
      />
    </div>
  );
}
