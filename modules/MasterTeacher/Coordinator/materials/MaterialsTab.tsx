"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import TableList from "@/components/Common/Tables/TableList";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import { useCoordinatorMaterials } from "@/modules/MasterTeacher/Coordinator/materials/useCoordinatorMaterials";
import type { MaterialStatus } from "@/lib/materials/shared";
import RejectConfirmationModal from "./RejectConfirmationModal";

type MaterialItem = {
  id: number;
  title: string;
  dateAttached: string;
  domain?: string;
  status?: MaterialStatus;
  rejectionReason?: string | null;
  submittedBy?: string;
  attachmentUrl?: string | null;
  files?: Array<{ publicUrl?: string | null }>; 
  [key: string]: unknown;
};

type TableColumn = {
  key: string;
  title: string;
  render?: (row: any) => ReactNode;
};

type MaterialTabContentProps = {
  subject: string;
  category: string;
  columns?: TableColumn[];
};

export default function MaterialTabContent({
  subject,
  category,
  columns,
}: MaterialTabContentProps) {
  const { materials, loading, updating, error, approveMaterial, rejectMaterial } = useCoordinatorMaterials({
    subject,
    level: category,
  });

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [pendingRejectRow, setPendingRejectRow] = useState<(MaterialItem & { no: number }) | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectReasonError, setRejectReasonError] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<number>>(new Set());
  const [selectAction, setSelectAction] = useState<"approve" | "reject" | null>(null);

  const formatDate = useCallback(
    (value: string) => {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime())
        ? value
        : parsed.toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
    },
    [],
  );

  const buildStatusBadge = useCallback((status: MaterialStatus, rejectionReason: string | null) => {
    const baseClass = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold";
    switch (status) {
      case "approved":
        return <span className={`${baseClass} bg-green-100 text-green-700`}>Approved</span>;
      case "rejected":
        return (
          <span className={`${baseClass} bg-red-100 text-red-700`} title={rejectionReason ?? undefined}>
            Rejected
          </span>
        );
      default:
        return <span className={`${baseClass} bg-yellow-100 text-yellow-700`}>Pending</span>;
    }
  }, []);

  const tableColumns: TableColumn[] = useMemo(() => {
    const base: TableColumn[] = (columns ?? [
      { key: "no", title: "No#" },
      { key: "title", title: "Title" },
      { key: "dateAttached", title: "Date Submitted" },
    ]).map((column) => {
      if (column.key === "dateAttached") {
        return {
          ...column,
          render: (row: any) => formatDate(row.dateAttached),
        } satisfies TableColumn;
      }
      if (column.key === "domain") {
        return {
          ...column,
          render: (row: any) => row.domain ?? "-",
        } satisfies TableColumn;
      }
      return column;
    });

    base.push({ key: "submittedBy", title: "Submitted By" });
    base.push({
      key: "status",
      title: "Status",
      render: (row: any) => buildStatusBadge(row.status as MaterialStatus, row.rejectionReason ?? null),
    });

    return base;
  }, [columns, buildStatusBadge, formatDate]);

  const tableData = useMemo(
    () =>
      materials.map((material, index) => ({
        id: material.id,
        no: index + 1,
        title: material.title,
        dateAttached: material.createdAt,
        domain: material.level,
        submittedBy: material.teacherName,
        status: material.status,
        rejectionReason: material.rejectionReason,
        attachmentUrl: material.attachmentUrl,
        files: material.files,
      })),
    [materials],
  );

  const handleApprove = async (row: any) => {
    await approveMaterial(row.id);
  };

  const handleSelectMaterial = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedMaterials);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedMaterials(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pendingIds = tableData.filter(m => m.status === "pending").map(m => m.id);
      setSelectedMaterials(new Set(pendingIds));
    } else {
      setSelectedMaterials(new Set());
    }
  };

  const handleEnterSelectMode = (action: "approve" | "reject") => {
    setSelectMode(true);
    setSelectAction(action);
    setSelectedMaterials(new Set());
  };

  const handleCancelSelect = () => {
    setSelectMode(false);
    setSelectAction(null);
    setSelectedMaterials(new Set());
  };

  const handleApproveSelected = async () => {
    if (selectedMaterials.size === 0) return;
    for (const id of Array.from(selectedMaterials)) {
      await approveMaterial(id);
    }
    handleCancelSelect();
  };

  const handleRejectSelected = () => {
    if (selectedMaterials.size === 0) return;
    const firstSelected = tableData.find(m => selectedMaterials.has(m.id));
    if (firstSelected) {
      setPendingRejectRow(firstSelected);
      setRejectReason("");
      setRejectReasonError(null);
      setShowRejectModal(true);
    }
  };

  const openRejectModal = (row: MaterialItem & { no: number }) => {
    setPendingRejectRow(row);
    setRejectReason(row.rejectionReason ?? "");
    setRejectReasonError(null);
    setShowRejectModal(true);
  };

  const handleRejectCancel = () => {
    if (updating) {
      return;
    }
    setShowRejectModal(false);
    setPendingRejectRow(null);
    setRejectReason("");
    setRejectReasonError(null);
  };

  const handleRejectConfirm = async () => {
    if (updating || !pendingRejectRow) {
      return;
    }
    const normalizedReason = rejectReason.trim();
    if (normalizedReason.length === 0) {
      setRejectReasonError("Rejection reason is required.");
      return;
    }

    setRejectReasonError(null);
    
    if (selectMode && selectedMaterials.size > 0) {
      for (const id of Array.from(selectedMaterials)) {
        await rejectMaterial(id, normalizedReason);
      }
      handleCancelSelect();
    } else {
      await rejectMaterial(pendingRejectRow.id, normalizedReason);
    }
    
    setShowRejectModal(false);
    setPendingRejectRow(null);
    setRejectReason("");
  };

  const handleRejectReasonChange = (value: string) => {
    if (rejectReasonError) {
      setRejectReasonError(null);
    }
    setRejectReason(value);
  };

  const handleOpenMaterial = (row: any) => {
    const targetUrl = row.attachmentUrl || row.files?.[0]?.publicUrl;
    if (!targetUrl || typeof window === "undefined") return;
    const url = targetUrl.startsWith("http")
      ? targetUrl
      : `${window.location.origin}${targetUrl.startsWith("/") ? "" : "/"}${targetUrl}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <div>
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
        <div className="flex flex-col gap-1">
          <p className="text-gray-600 text-md font-medium">
            Total: {materials.length}
            {loading && <span className="ml-2 text-xs text-gray-400">Loading...</span>}
          </p>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
        
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <SecondaryButton small onClick={handleCancelSelect}>
                Cancel
              </SecondaryButton>
              {selectedMaterials.size > 0 && (
                <>
                  {selectAction === "approve" && (
                    <UtilityButton small onClick={handleApproveSelected} disabled={updating}>
                      Approve ({selectedMaterials.size})
                    </UtilityButton>
                  )}
                  {selectAction === "reject" && (
                    <DangerButton small onClick={handleRejectSelected} disabled={updating}>
                      Reject ({selectedMaterials.size})
                    </DangerButton>
                  )}
                </>
              )}
            </>
          ) : (
            <KebabMenu
              small
              align="right"
              renderItems={(close) => (
                <div className="py-1">
                  <button
                    disabled={updating}
                    onClick={() => {
                      if (updating) return;
                      handleEnterSelectMode("approve");
                      close();
                    }}
                    className={`w-full px-4 py-2 text-left text-sm text-[#013300] flex items-center gap-2 ${updating ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Approve
                  </button>
                  <button
                    disabled={updating}
                    onClick={() => {
                      if (updating) return;
                      handleEnterSelectMode("reject");
                      close();
                    }}
                    className={`w-full px-4 py-2 text-left text-sm text-red-600 flex items-center gap-2 ${updating ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject
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
        actions={(row: MaterialItem & { no: number }) => (
          <UtilityButton small onClick={() => handleOpenMaterial(row)}>
            Open
          </UtilityButton>
        )}
        selectable={selectMode}
        selectedItems={selectedMaterials}
        onSelectAll={handleSelectAll}
        onSelectItem={handleSelectMaterial}
        pageSize={10}
      />

      <RejectConfirmationModal
        show={showRejectModal}
        onClose={handleRejectCancel}
        onConfirm={handleRejectConfirm}
        reason={rejectReason}
        onReasonChange={handleRejectReasonChange}
        isProcessing={updating}
        errorMessage={rejectReasonError}
        materialTitle={selectMode && selectedMaterials.size > 1 ? `${selectedMaterials.size} materials` : pendingRejectRow?.title}
      />
    </div>
  );
}
