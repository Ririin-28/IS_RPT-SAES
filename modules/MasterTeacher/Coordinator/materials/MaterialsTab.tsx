"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import TableList from "@/components/Common/Tables/TableList";
import { useCoordinatorMaterials } from "@/modules/MasterTeacher/Coordinator/materials/useCoordinatorMaterials";
import type { MaterialStatus } from "@/lib/materials/shared";

type MaterialItem = {
  id: number;
  title: string;
  dateAttached: string;
  domain?: string;
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
  const { materials, loading, updating, error, approveMaterial, rejectMaterial, refresh } = useCoordinatorMaterials({
    subject,
    level: category,
  });

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

  const handleReject = async (row: any) => {
    const reason = typeof window !== "undefined" ? window.prompt("Enter rejection reason", row.rejectionReason ?? "") : null;
    if (!reason) {
      return;
    }
    await rejectMaterial(row.id, reason.trim());
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
      </div>
      <TableList
        columns={tableColumns}
        data={tableData}
  actions={(row: MaterialItem & { no: number }) => (
          <>
            <UtilityButton small onClick={() => handleOpenMaterial(row)}>
              Open
            </UtilityButton>
            {row.status === "pending" && (
              <>
                <UtilityButton small disabled={updating} onClick={() => handleApprove(row)}>
                  Approve
                </UtilityButton>
                <DangerButton small disabled={updating} onClick={() => handleReject(row)}>
                  Reject
                </DangerButton>
              </>
            )}
          </>
        )}
        pageSize={10}
      />
    </div>
  );
}
