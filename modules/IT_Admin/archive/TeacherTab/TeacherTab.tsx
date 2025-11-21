import { useMemo, useCallback, type Dispatch, type SetStateAction } from "react";
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

const ExportIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
  </svg>
);

interface TeacherArchiveTabProps {
  teachers: any[];
  setTeachers: Dispatch<SetStateAction<any[]>>;
  searchTerm: string;
  gradeFilter?: number;
  gradeLabel?: string;
}

const extractGradeNumber = (raw: unknown): number | null => {
  if (raw === null || raw === undefined) {
    return null;
  }
  const value = String(raw).trim();
  if (value.length === 0) {
    return null;
  }
  const direct = Number.parseInt(value, 10);
  if (!Number.isNaN(direct)) {
    return direct;
  }
  const match = value.match(/(\d+)/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const matchesGrade = (teacher: any, gradeFilter?: number) => {
  if (gradeFilter === undefined) {
    return true;
  }

  const gradeCandidate =
    teacher.grade ??
    teacher.grade_level ??
    teacher.gradeLevel ??
    teacher.year_level ??
    teacher.handledGrade ??
    teacher.handled_grade ??
    teacher.remedial_grade ??
    teacher.remedial_teacher_grade;

  const numeric = extractGradeNumber(gradeCandidate);
  return numeric === gradeFilter;
};

export default function TeacherArchiveTab({
  teachers,
  setTeachers,
  searchTerm,
  gradeFilter,
  gradeLabel,
}: TeacherArchiveTabProps) {
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
        const resolvedGrade =
          teacher.grade ??
          teacher.grade_level ??
          teacher.gradeLevel ??
          teacher.year_level ??
          teacher.handled_grade ??
          teacher.handledGrade ??
          teacher.remedial_grade ??
          teacher.remedial_teacher_grade ??
          null;
        const resolvedSection = teacher.section ?? teacher.section_name ?? teacher.class_section ?? null;
        const resolvedContact =
          teacher.contactNumber ??
          teacher.contact_number ??
          teacher.phoneNumber ??
          teacher.phone_number ??
          null;

        const teacherIdValue =
          teacher.teacherId ??
          teacher.teacher_id ??
          teacher.userId ??
          teacher.user_id ??
          null;

        return {
          ...teacher,
          id: archiveKey,
          no: idx + 1,
          teacherId: teacherIdValue,
          grade: resolvedGrade,
          section: resolvedSection,
          contactNumber: resolvedContact,
        };
      }),
    [filteredTeachers],
  );

  const handleExport = () => {
    void exportArchiveRows({
      rows: filteredTeachers,
      accountLabel: "Teacher",
      gradeLabel: normalizedLabel,
      emptyMessage: "No teacher archive records available to export.",
    });
  };

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
                        className="lucide lucide-archive-restore"
                      >
                        <rect width="20" height="5" x="2" y="3" rx="1" />
                        <path d="M4 8v11a2 2 0 0 0 2 2h2" />
                        <path d="M20 8v11a 2 2 0 0 1-2 2h-2" />
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
                        className="lucide lucide-trash"
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
                      <ExportIcon />
                      Export to Excel
                    </button>
                  </div>
                )}
              />
            )}
        </div>
      </div>

      <TableList
        columns={[
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
        ]}
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
