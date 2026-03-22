"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import ToastActivity from "@/components/ToastActivity";
import { useCoordinatorMaterials, type CoordinatorMaterialRow } from "@/modules/MasterTeacher/Coordinator/materials/useCoordinatorMaterials";
import type { MaterialStatus } from "@/lib/materials/shared";
import RejectConfirmationModal from "./RejectConfirmationModal";

type MaterialTabContentProps = {
  subject: string;
  category: string;
  columns?: { key: string; title: string }[];
  requestId?: string | number | null;
};

export default function MaterialTabContent({
  subject,
  category,
  requestId,
}: MaterialTabContentProps) {
  const { materials, loading, updating, error, refresh, approveMaterial, rejectMaterial } = useCoordinatorMaterials({
    subject,
    level: category,
    requestId,
  });

  const [statusFilter, setStatusFilter] = useState<MaterialStatus>("pending");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [pendingRejectRow, setPendingRejectRow] = useState<CoordinatorMaterialRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectReasonError, setRejectReasonError] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [statusToast, setStatusToast] = useState<{
    title: string;
    message: string;
    tone: "success" | "info" | "error";
  } | null>(null);

  useEffect(() => {
    if (!statusToast) return;
    const timerId = window.setTimeout(() => {
      setStatusToast(null);
    }, 3000);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [statusToast]);

  useEffect(() => {
    if (!error) return;
    setStatusToast({
      title: "Action Failed",
      message: error,
      tone: "error",
    });
  }, [error]);

  const formatDate = useCallback((value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return { month: "??", day: "??", year: "??", weekday: "??", date: parsed };
    return {
      month: parsed.toLocaleDateString("en-PH", { month: "short" }),
      day: parsed.toLocaleDateString("en-PH", { day: "numeric" }),
      year: parsed.getFullYear(),
      weekday: parsed.toLocaleDateString("en-PH", { weekday: "short" }),
      date: parsed
    };
  }, []);

  const buildStatusBadge = (status: MaterialStatus, rejectionReason: string | null) => {
    const baseClass = "inline-flex items-center px-2 py-0.5 rounded text-[0.6rem] font-bold uppercase tracking-wider";
    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
    switch (status.toLowerCase()) {
      case "approved":
        return <span className={`${baseClass} bg-green-100 text-green-700`}>{displayStatus}</span>;
      case "rejected":
        return (
          <span className={`${baseClass} bg-red-100 text-red-700`} title={rejectionReason ?? undefined}>
            {displayStatus}
          </span>
        );
      default:
        return <span className={`${baseClass} bg-yellow-100 text-yellow-700`}>{displayStatus}</span>;
    }
  };

  const handleApprove = async (material: CoordinatorMaterialRow) => {
    if (updating || bulkProcessing) return;
    setBulkProcessing(true);
    try {
      const result = await approveMaterial(material);
      if (result.success) {
        setStatusToast({
          title: "Material Approved",
          message: `Approved \"${material.title}\" successfully.`,
          tone: "success",
        });
      } else {
        setStatusToast({
          title: "Approval Failed",
          message: result.error ?? "Unable to approve material.",
          tone: "error",
        });
      }
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleApproveAll = async () => {
    if (updating || bulkProcessing) return;
    const pendingMaterials = filteredMaterials.filter((material) => material.status.toLowerCase() === "pending");
    if (pendingMaterials.length === 0) return;

    setBulkProcessing(true);
    try {
      let successCount = 0;
      let failedCount = 0;
      let firstError: string | null = null;

      for (const material of pendingMaterials) {
        const result = await approveMaterial(material, { skipRefresh: true });
        if (result.success) {
          successCount += 1;
        } else {
          failedCount += 1;
          if (!firstError && result.error) {
            firstError = result.error;
          }
        }
      }
      await refresh();

      if (failedCount === 0) {
        setStatusToast({
          title: "Bulk Approve Complete",
          message: `Approved ${successCount} material${successCount === 1 ? "" : "s"}.`,
          tone: "success",
        });
      } else {
        setStatusToast({
          title: "Bulk Approve Partial",
          message: `Approved ${successCount}, failed ${failedCount}.${firstError ? ` ${firstError}` : ""}`,
          tone: "info",
        });
      }
    } finally {
      setBulkProcessing(false);
    }
  };

  const openRejectModal = (material: CoordinatorMaterialRow) => {
    setPendingRejectRow(material);
    setRejectReason(material.rejectionReason ?? "");
    setRejectReasonError(null);
    setShowRejectModal(true);
  };

  const handleRejectCancel = () => {
    if (updating) return;
    setShowRejectModal(false);
    setPendingRejectRow(null);
    setRejectReason("");
    setRejectReasonError(null);
  };

  const handleRejectConfirm = async () => {
    if (updating || !pendingRejectRow) return;
    const normalizedReason = rejectReason.trim();
    if (normalizedReason.length === 0) {
      setRejectReasonError("Rejection reason is required.");
      return;
    }
    setRejectReasonError(null);
    const result = await rejectMaterial(pendingRejectRow, normalizedReason);
    setShowRejectModal(false);
    setPendingRejectRow(null);
    setRejectReason("");

    if (result.success) {
      setStatusToast({
        title: "Material Rejected",
        message: "Material has been rejected successfully.",
        tone: "success",
      });
    } else {
      setStatusToast({
        title: "Rejection Failed",
        message: result.error ?? "Unable to reject material.",
        tone: "error",
      });
    }
  };

  const handleOpenMaterial = (material: CoordinatorMaterialRow) => {
    const targetUrl = material.attachmentUrl || (material.files && material.files[0]?.publicUrl);
    if (!targetUrl || typeof window === "undefined") return;

    const absoluteUrl = /^https?:\/\//i.test(targetUrl)
      ? targetUrl
      : `${window.location.origin}${targetUrl.startsWith("/") ? "" : "/"}${targetUrl}`;

    // Check if it's an Office file to use Google Viewer
    const isOfficeFile = /\.(docx|doc|pptx|ppt|xlsx|xls)$/i.test(targetUrl);
    
    if (isOfficeFile) {
      window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(absoluteUrl)}&embedded=true`, '_blank');
    } else {
      window.open(absoluteUrl, '_blank');
    }
  };

  const statusCounts = useMemo(
    () =>
      materials.reduce(
        (acc, material) => {
          const key = material.status.toLowerCase() as MaterialStatus;
          if (key === "pending" || key === "approved" || key === "rejected") {
            acc[key] += 1;
          }
          return acc;
        },
        { pending: 0, approved: 0, rejected: 0 } as Record<MaterialStatus, number>,
      ),
    [materials],
  );

  const filteredMaterials = useMemo(
    () => materials.filter((material) => material.status.toLowerCase() === statusFilter),
    [materials, statusFilter],
  );

  const groupedMaterials = useMemo(() => {
    const groups: Record<string, CoordinatorMaterialRow[]> = {};
    filteredMaterials.forEach((m) => {
      const level = m.level || "Uncategorized";
      if (!groups[level]) groups[level] = [];
      groups[level].push(m);
    });
    return groups;
  }, [filteredMaterials]);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400 font-medium animate-pulse flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-[#013300] border-t-transparent rounded-full animate-spin" />
        Loading materials...
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-500 font-bold text-lg">No Materials for Review</p>
        <p className="text-gray-400 text-sm mt-1 max-w-xs">
          There are currently no submitted materials in this category.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-md font-black text-[#013300]/50 uppercase tracking-[0.2em]">
          SUBMISSIONS ({filteredMaterials.length})
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {statusFilter === "pending" && filteredMaterials.length > 0 && (
            <PrimaryButton
              small
              onClick={handleApproveAll}
              disabled={updating || bulkProcessing}
              className="px-4! py-1.5! font-bold"
            >
              {bulkProcessing ? "Approving all..." : "Approve All Materials"}
            </PrimaryButton>
          )}
          <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-white p-1">
            {(
              [
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
              ] as Array<{ value: MaterialStatus; label: string }>
            ).map((item) => {
              const isActive = statusFilter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStatusFilter(item.value)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    isActive
                      ? "bg-[#013300] text-white shadow"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[0.65rem] ${
                      isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {statusCounts[item.value]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {materials.length > 0 && filteredMaterials.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-6 text-center text-sm text-gray-500">
          No {statusFilter} materials in this category yet.
        </div>
      )}

      <div className="flex flex-col gap-10">
        {Object.entries(groupedMaterials).map(([level, items]) => (
          <div key={level} className="space-y-4">
            {/* Level Separator */}
            <div className="flex items-center gap-4">
                <span className="text-sm font-black text-[#013300] uppercase tracking-[0.3em] whitespace-nowrap">
                    {level}
                </span>
                <div className="h-px flex-1 bg-gray-100" />
            </div>

            <div className="flex flex-col gap-3">
                {items.map((material) => {
                const dateInfo = formatDate(material.createdAt);
                return (
                    <div
                    key={`${material.source}-${material.status}-${material.id}-${material.requestId ?? "none"}-${material.createdAt}`}
                    className="group flex flex-row items-center justify-between w-full bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-[#013300]/20 transition-all duration-300"
                    >
                    <div className="flex items-center gap-4 min-w-0">
                        {/* Date Box */}
                        <div className="shrink-0 flex flex-col items-center justify-center w-12 h-14 bg-gray-50 text-gray-500 rounded-lg border border-gray-100">
                        <span className="text-[0.6rem] font-bold uppercase tracking-wide leading-none">{dateInfo.month}</span>
                        <span className="text-lg font-black leading-none mt-1 text-[#013300]">{dateInfo.day}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                            {buildStatusBadge(material.status, material.rejectionReason)}
                            <span className="text-[0.65rem] font-bold text-gray-300 uppercase tracking-tighter">
                            {dateInfo.year}
                            </span>
                        </div>
                        
                        <h4 className="text-base font-black text-[#013300] truncate leading-tight">
                            {material.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-[0.7rem] text-gray-500">
                            <span className="inline-flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Submitted by: <span className="font-bold text-gray-700">{material.teacherName}</span>
                            </span>
                        </div>
                        </div>
                    </div>

                    <div className="ml-4 shrink-0 flex items-center gap-2">
                      <UtilityButton small onClick={() => handleOpenMaterial(material)} className="px-4! py-1.5! font-bold">
                        View
                        </UtilityButton>
                        
                        {material.status.toLowerCase() === "pending" && (
                        <div className="flex items-center gap-2 border-l border-gray-100 pl-2">
                            <PrimaryButton 
                            small 
                            onClick={() => handleApprove(material)} 
                            disabled={updating || bulkProcessing}
                            className="px-4! py-1.5! font-bold"
                            >
                            Approve
                            </PrimaryButton>
                            <DangerButton 
                            small 
                            onClick={() => openRejectModal(material)} 
                            disabled={updating || bulkProcessing}
                            className="px-4! py-1.5! font-bold"
                            >
                            Reject
                            </DangerButton>
                        </div>
                        )}
                    </div>
                    </div>
                );
                })}
            </div>
          </div>
        ))}
      </div>

      <RejectConfirmationModal
        show={showRejectModal}
        onClose={handleRejectCancel}
        onConfirm={handleRejectConfirm}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        isProcessing={updating}
        errorMessage={rejectReasonError}
        materialTitle={pendingRejectRow?.title}
      />

      {statusToast && (
        <ToastActivity
          title={statusToast.title}
          message={statusToast.message}
          tone={statusToast.tone}
          onClose={() => setStatusToast(null)}
          timeoutMs={3000}
        />
      )}
    </div>
  );
}
