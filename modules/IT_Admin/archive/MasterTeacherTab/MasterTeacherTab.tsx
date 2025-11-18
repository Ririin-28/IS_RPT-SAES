import { useMemo, useCallback, type Dispatch, type SetStateAction, type ReactNode } from "react";
import TableList from "@/components/Common/Tables/TableList";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import { useArchiveRestoreDelete } from "../Common/useArchiveRestoreDelete";
import { ensureArchiveRowKey } from "../Common/archiveRowKey";
import { exportArchiveRows } from "../utils/export-columns";

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
}: MasterTeacherArchiveTabProps) {
  const normalizedLabel = gradeLabel ?? (gradeFilter ? `Grade ${gradeFilter}` : "All Grades");

  const keySelector = (item: any) => ensureArchiveRowKey(item);

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
  } = useArchiveRestoreDelete(setTeachers, { keySelector });

  const scopedTeachers = useMemo(
    () => teachers.filter((teacher: any) => matchesGrade(teacher, gradeFilter)),
    [teachers, gradeFilter],
  );

  const filteredTeachers = useMemo(() => {
    const loweredSearch = searchTerm.trim().toLowerCase();
    return scopedTeachers.filter((teacher) => {
      const teacherId = String(teacher?.userId ?? teacher?.user_id ?? teacher?.teacherId ?? "");
      return (
        loweredSearch.length === 0 ||
        teacher.name?.toLowerCase().includes(loweredSearch) ||
        teacherId.toLowerCase().includes(loweredSearch)
      );
    });
  }, [scopedTeachers, searchTerm]);

  const handleViewDetails = useCallback((teacher: any) => {
    console.log("View details:", teacher);
    // TODO: Implement details modal
  }, []);

  const tableData = useMemo(
    () =>
      filteredTeachers.map((teacher, idx) => {
        const archiveKey = ensureArchiveRowKey(teacher);
        return {
          ...teacher,
          id: archiveKey,
          no: idx + 1,
        };
      }),
    [filteredTeachers],
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
        render: (row: any) => row.userId ?? row.user_id ?? row.teacherId ?? "—"
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
    </div>
  );
}
