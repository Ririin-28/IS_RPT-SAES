"use client";

import { useCallback, useMemo, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
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
  const { materials, loading, updating, error, approveMaterial, rejectMaterial, refresh } = useCoordinatorMaterials({
    subject,
    level: category,
    requestId,
  });

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [pendingRejectRow, setPendingRejectRow] = useState<CoordinatorMaterialRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectReasonError, setRejectReasonError] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

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
      await approveMaterial(material);
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
    await rejectMaterial(pendingRejectRow, normalizedReason);
    setShowRejectModal(false);
    setPendingRejectRow(null);
    setRejectReason("");
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

  const groupedMaterials = useMemo(() => {
    const groups: Record<string, CoordinatorMaterialRow[]> = {};
    materials.forEach((m) => {
      const level = m.level || "Uncategorized";
      if (!groups[level]) groups[level] = [];
      groups[level].push(m);
    });
    return groups;
  }, [materials]);

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
      <div className="flex justify-between items-center mb-2">
        <p className="text-md font-black text-[#013300]/50 uppercase tracking-[0.2em]">
          SUBMISSIONS ({materials.length})
        </p>
        {error && <span className="text-xs text-red-600 font-medium">{error}</span>}
      </div>

      <div className="flex flex-col gap-10">
        {Object.entries(groupedMaterials).map(([level, items]) => (
          <div key={level} className="space-y-4">
            {/* Level Separator */}
            <div className="flex items-center gap-4">
                <span className="text-sm font-black text-[#013300] uppercase tracking-[0.3em] whitespace-nowrap">
                    {level}
                </span>
                <div className="h-[1px] flex-1 bg-gray-100" />
            </div>

            <div className="flex flex-col gap-3">
                {items.map((material) => {
                const dateInfo = formatDate(material.createdAt);
                return (
                    <div
                    key={material.id}
                    className="group flex flex-row items-center justify-between w-full bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-[#013300]/20 transition-all duration-300"
                    >
                    <div className="flex items-center gap-4 min-w-0">
                        {/* Date Box */}
                        <div className="flex-shrink-0 flex flex-col items-center justify-center w-12 h-14 bg-gray-50 text-gray-500 rounded-lg border border-gray-100">
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

                    <div className="ml-4 flex-shrink-0 flex items-center gap-2">
                        <UtilityButton small onClick={() => handleOpenMaterial(material)} className="!px-4 !py-1.5 font-bold">
                        View
                        </UtilityButton>
                        
                        {material.status.toLowerCase() === "pending" && (
                        <div className="flex items-center gap-2 border-l border-gray-100 pl-2">
                            <PrimaryButton 
                            small 
                            onClick={() => handleApprove(material)} 
                            disabled={updating || bulkProcessing}
                            className="!px-4 !py-1.5 font-bold"
                            >
                            Approve
                            </PrimaryButton>
                            <DangerButton 
                            small 
                            onClick={() => openRejectModal(material)} 
                            disabled={updating || bulkProcessing}
                            className="!px-4 !py-1.5 font-bold"
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
    </div>
  );
}
