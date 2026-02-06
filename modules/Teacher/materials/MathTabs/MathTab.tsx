"use client";
import { useMemo, useRef, useState, useEffect, type ChangeEvent } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import { useTeacherMaterials } from "@/modules/Teacher/materials/useTeacherMaterials";
import type { MaterialStatus } from "@/lib/materials/shared";

export const MATH_LEVELS = [
  "Not Proficient",
  "Low Proficient",
  "Nearly Proficient",
  "Proficient",
  "Highly Proficient",
] as const;

export type MathLevel = (typeof MATH_LEVELS)[number];

const normalizeId = (value: number | string) => String(value);

const STATUS_LABELS: Record<MaterialStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const formatDate = (value: Date) =>
  value.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const buildStatusBadge = (status: MaterialStatus, rejectionReason: string | null) => {
  const baseClass = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold";
  switch (status) {
    case "approved":
      return <span className={`${baseClass} bg-green-100 text-green-700`}>{STATUS_LABELS[status]}</span>;
    case "rejected":
      return (
        <span className={`${baseClass} bg-red-100 text-red-700`} title={rejectionReason ?? undefined}>
          {STATUS_LABELS[status]}
        </span>
      );
    default:
      return <span className={`${baseClass} bg-yellow-100 text-yellow-700`}>{STATUS_LABELS[status]}</span>;
  }
};

interface MathTabProps {
  level: MathLevel;
  searchTerm?: string;
}

export default function MathTab({ level, searchTerm = "" }: MathTabProps) {
  const { materials, uploadFiles, deleteMaterials, loading, deleting, error } = useTeacherMaterials({
    subject: "Math",
    level,
  });

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredMaterials = useMemo(() => {
    if (!normalizedSearch) return materials;
    return materials.filter((material) => {
      const title = material.title?.toLowerCase() ?? "";
      const submitted = formatDate(material.submittedAt).toLowerCase();
      return title.includes(normalizedSearch) || submitted.includes(normalizedSearch);
    });
  }, [materials, normalizedSearch]);

  const rows = useMemo(
    () =>
      filteredMaterials.map((material, index) => ({
        id: material.id,
        no: index + 1,
        title: material.title,
        status: material.status,
        rejectionReason: material.rejectionReason,
        submittedAt: formatDate(material.submittedAt),
        attachmentUrl: material.attachmentUrl,
        files: material.files,
      })),
    [filteredMaterials]
  );

  useEffect(() => {
    if (!selectMode) return;
    const available = new Set(filteredMaterials.map((item) => normalizeId(item.id)));
    setSelectedIds((prev) => {
      const next = new Set<number>();
      prev.forEach((value) => {
        if (available.has(normalizeId(value))) {
          next.add(value);
        }
      });
      if (next.size === prev.size) {
        let identical = true;
        prev.forEach((value) => {
          if (!next.has(value)) {
            identical = false;
          }
        });
        if (identical) {
          return prev;
        }
      }
      return next;
    });
  }, [filteredMaterials, selectMode]);

  const handleSelectItem = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredMaterials.map((item) => Number(item.id))));
    } else {
      setSelectedIds(new Set());
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds).map((value) => Number(value)).filter((value) => Number.isFinite(value));
    if (!ids.length) return;
    await deleteMaterials(ids);
    exitSelectMode();
  };

  const handleUploadFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (!files || files.length === 0) return;
    setPendingFiles(Array.from(files));
    setShowUploadConfirm(true);
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const selectedCount = selectedIds.size;
  const pendingFileNames = useMemo(() => pendingFiles.map((file) => file.name).join(", "), [pendingFiles]);

  const handleUploadCancel = () => {
    setShowUploadConfirm(false);
    setPendingFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadConfirm = async () => {
    if (pendingFiles.length === 0) {
      handleUploadCancel();
      return;
    }
    await uploadFiles(pendingFiles);
    handleUploadCancel();
  };

  const handleViewMaterial = (row: any) => {
    const targetUrl = row.attachmentUrl || row.files?.[0]?.publicUrl;
    if (!targetUrl) return;
    const url = targetUrl.startsWith("http") ? targetUrl : `${window.location.origin}${targetUrl.startsWith("/") ? "" : "/"}${targetUrl}`;
    window.open(url, "_blank", "noopener");
  };

  const statusColumn = {
    key: "status",
    title: "Status",
    render: (row: any) => buildStatusBadge(row.status as MaterialStatus, row.rejectionReason ?? null),
  };

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div
        className="
        /* Mobile */
        flex flex-row justify-between items-center mb-4
        /* Tablet */
        sm:mb-6
        /* Desktop */
        md:mb-2
      "
      >
        <p className="text-gray-600 text-md font-medium">
          Total: {materials.length}
          {loading && <span className="ml-2 text-xs text-gray-400">Loading...</span>}
        </p>
        <div className="flex gap-2 items-center">
          {selectMode ? (
            <>
              <UtilityButton small onClick={exitSelectMode}>
                Cancel
              </UtilityButton>
              {selectedCount > 0 && (
                <DangerButton small onClick={handleDeleteSelected} disabled={deleting}>
                  Delete ({selectedCount})
                </DangerButton>
              )}
            </>
          ) : (
            <>
              <KebabMenu
                small
                renderItems={(close) => (
                  <div className="py-1">
                    <button
                      onClick={() => {
                        triggerUpload();
                        close();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="m17 8-5-5-5 5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      </svg>
                      Upload File
                    </button>
                    <button
                      onClick={() => {
                        setSelectMode(true);
                        close();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M9 12l2 2 4-4" />
                      </svg>
                      Select
                    </button>
                  </div>
                )}
              />
            </>
          )}
        </div>
      </div>
      <p className="mb-3 flex items-center gap-2 text-xs text-gray-500">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] italic font-semibold">i</span>
        <span>Max file size: 10MB per file.</span>
      </p>
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "title", title: "Title" },
          statusColumn,
          { key: "submittedAt", title: "Date Submitted" },
        ]}
        data={rows}
        actions={(row: any) => (
          <>
            <UtilityButton small onClick={() => handleViewMaterial(row)}>
              Open
            </UtilityButton>
          </>
        )}
        pageSize={10}
        selectable={selectMode}
        selectedItems={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectItem={handleSelectItem}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleUploadFiles}
        className="hidden"
      />
      <ConfirmationModal
        isOpen={showUploadConfirm}
        onClose={handleUploadCancel}
        onConfirm={() => {
          void handleUploadConfirm();
        }}
        title="Confirm File Upload"
        message="Upload the selected file(s) to this materials list?"
        fileName={pendingFileNames || undefined}
      />
    </div>
  );
}
