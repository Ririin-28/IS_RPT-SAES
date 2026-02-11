"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import type { MaterialDto, MaterialStatus } from "@/lib/materials/shared";
import { MATERIAL_SUBJECTS, normalizeMaterialStatus, normalizeMaterialSubject, normalizePublicPath } from "@/lib/materials/shared";

export type ArchiveTabProps = {
  subject: string;
  category: string;
  requestId?: string | number | null;
  activityTitle?: string | null;
  activityDate?: Date | null;
  loadingSubject?: boolean;
};

type ArchiveMaterialRow = MaterialDto & {
  teacherName: string;
  source: "teacher" | "remedial";
  requestId: string | null;
  activityTitle: string | null;
  activityDate: Date | null;
};

const normalizeLevelLabel = (value?: string | null): string => {
  if (!value) return "";
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "syllabe") return "syllable";
  return normalized;
};

const PHONEMIC_LEVEL_ORDER = ["nonreader", "syllable", "word", "phrase", "sentence", "paragraph"] as const;
const MATH_LEVEL_ORDER = ["notproficient", "lowproficient", "nearlyproficient", "proficient", "highlyproficient"] as const;

const getLevelSortIndex = (value?: string | null, order: readonly string[] = PHONEMIC_LEVEL_ORDER): number => {
  const normalized = normalizeLevelLabel(value);
  const index = order.indexOf(normalized);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { month: "??", day: "??", year: "??", date: parsed };
  return {
    month: parsed.toLocaleDateString("en-PH", { month: "short" }),
    day: parsed.toLocaleDateString("en-PH", { day: "numeric" }),
    year: parsed.getFullYear(),
    date: parsed,
  };
};

const buildTeacherName = (material: MaterialDto): string => {
  const parts = [material.teacher.firstName, material.teacher.middleName, material.teacher.lastName]
    .map((value) => (value ? value.trim() : ""))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : material.teacher.username ?? "Unknown";
};

const parseLevelMatch = (candidate: string | null | undefined, expected: string) => {
  const expectedNorm = normalizeLevelLabel(expected);
  const candidateNorm = normalizeLevelLabel(candidate);
  return expectedNorm.length > 0 && expectedNorm === candidateNorm;
};

export default function ArchiveTab({
  subject,
  category,
  requestId,
  activityTitle,
  activityDate,
  loadingSubject,
}: ArchiveTabProps) {
  const [materials, setMaterials] = useState<ArchiveMaterialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedSubject = useMemo(() => normalizeMaterialSubject(subject) ?? MATERIAL_SUBJECTS[0], [subject]);
  const normalizedLevel = useMemo(() => category.trim(), [category]);

  const normalizedRequestId = useMemo(() => {
    if (requestId === null || requestId === undefined) return null;
    const text = String(requestId).trim();
    return text.length ? text : null;
  }, [requestId]);

  const fetchTeacherMaterials = useCallback(async (): Promise<ArchiveMaterialRow[]> => {
    if (!normalizedLevel) return [];

    const params = new URLSearchParams({
      subject: normalizedSubject,
      level: normalizedLevel,
      status: "rejected",
      pageSize: "100",
    });

    const response = await fetch(`/api/materials?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch teacher materials (${response.status})`);
    }

    const data = await response.json();
    const rows: MaterialDto[] = Array.isArray(data?.data) ? data.data : [];

    return rows.map((row) => ({
      ...row,
      teacherName: buildTeacherName(row),
      source: "teacher",
      requestId: null,
      activityTitle: null,
      activityDate: null,
    }));
  }, [normalizedLevel, normalizedSubject]);

  const fetchRemedialMaterials = useCallback(async (): Promise<ArchiveMaterialRow[]> => {
    if (!normalizedRequestId) return [];

    const response = await fetch(
      `/api/remedial-materials?requestId=${encodeURIComponent(normalizedRequestId)}&status=rejected`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return [];
    }

    const payload = await response.json().catch(() => null);
    const items: Array<Record<string, any>> = Array.isArray(payload?.materials) ? payload.materials : [];

    return items
      .map((item, index): ArchiveMaterialRow | null => {
        const status = (normalizeMaterialStatus(
          item.status ?? item.Status ?? item.STATUS ?? item.material_status,
        ) ?? "rejected") as MaterialStatus;
        if (status !== "rejected") return null;

        const levelName = typeof item.level_name === "string" && item.level_name.trim().length
          ? item.level_name.trim()
          : normalizedLevel;
        if (!parseLevelMatch(levelName, normalizedLevel)) return null;

        const submissionPath =
          item.file_path ?? item.material_file ?? item.materialFile ?? item.filePath ?? item.storage_path ?? null;
        const attachmentUrl = normalizePublicPath(typeof submissionPath === "string" ? submissionPath : null);
        const submittedByRaw = item.submitted_by ?? item.submittedBy ?? null;
        const submittedBy = submittedByRaw ? String(submittedByRaw) : null;
        const submittedName = item.submitted_by_name ? String(item.submitted_by_name) : submittedBy;
        const materialId = Number.parseInt(String(item.material_id ?? item.id ?? index + 1), 10);

        if (!Number.isFinite(materialId)) return null;

        return {
          id: materialId,
          teacherUserId: submittedBy ? Number.parseInt(submittedBy, 10) : 0,
          subject: normalizedSubject,
          level: levelName,
          title: item.title ?? item.file_name ?? item.fileName ?? `Material ${materialId}`,
          description: null,
          attachmentUrl,
          status,
          rejectionReason: item.rejection_reason ?? item.rejectionReason ?? null,
          reviewedBy: item.approved_by ? Number.parseInt(String(item.approved_by), 10) : null,
          reviewedAt: null,
          createdAt: item.submitted_at ?? item.submittedAt ?? new Date().toISOString(),
          updatedAt: item.updated_at ?? item.updatedAt ?? item.submitted_at ?? new Date().toISOString(),
          teacher: {
            userId: submittedBy ? Number.parseInt(submittedBy, 10) : 0,
            username: submittedBy,
            firstName: null,
            middleName: null,
            lastName: null,
          },
          reviewer: null,
          files: [],
          teacherName: submittedName ?? "Remedial Teacher",
          source: "remedial",
          requestId: normalizedRequestId,
          activityTitle: activityTitle ?? null,
          activityDate: activityDate ?? null,
        };
      })
      .filter((item): item is ArchiveMaterialRow => item !== null);
  }, [activityDate, activityTitle, normalizedLevel, normalizedRequestId, normalizedSubject]);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [teacherRows, remedialRows] = await Promise.all([
        normalizedRequestId ? Promise.resolve([] as ArchiveMaterialRow[]) : fetchTeacherMaterials(),
        fetchRemedialMaterials(),
      ]);

      const combined = [...teacherRows, ...remedialRows].sort((a, b) => {
        const isMath = normalizedSubject.toLowerCase() === "math";
        const order = isMath ? MATH_LEVEL_ORDER : PHONEMIC_LEVEL_ORDER;
        const aLevel = getLevelSortIndex(a.level, order);
        const bLevel = getLevelSortIndex(b.level, order);
        if (aLevel !== bLevel) return aLevel - bLevel;
        const aDate = new Date(a.createdAt).getTime();
        const bDate = new Date(b.createdAt).getTime();
        return bDate - aDate;
      });

      setMaterials(combined);
    } catch (err) {
      setError("Unable to load archived materials.");
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [fetchTeacherMaterials, fetchRemedialMaterials]);

  useEffect(() => {
    if (!normalizedLevel || loadingSubject) return;
    void fetchMaterials();
  }, [fetchMaterials, loadingSubject, normalizedLevel]);

  const handleOpenMaterial = (material: ArchiveMaterialRow) => {
    const targetUrl = material.attachmentUrl || (material.files && material.files[0]?.publicUrl);
    if (!targetUrl || typeof window === "undefined") return;

    const absoluteUrl = /^https?:\/\//i.test(targetUrl)
      ? targetUrl
      : `${window.location.origin}${targetUrl.startsWith("/") ? "" : "/"}${targetUrl}`;

    const isOfficeFile = /\.(docx|doc|pptx|ppt|xlsx|xls)$/i.test(targetUrl);

    if (isOfficeFile) {
      window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(absoluteUrl)}&embedded=true`, "_blank");
    } else {
      window.open(absoluteUrl, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400 font-medium animate-pulse flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-[#013300] border-t-transparent rounded-full animate-spin" />
        Loading archived materials...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 p-4 border border-red-100 bg-red-50 text-red-600 rounded-lg text-sm">
        {error}
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
        <p className="text-gray-500 font-bold text-lg">No Archived Materials</p>
        <p className="text-gray-400 text-sm mt-1 max-w-xs">
          Rejected materials for {category} will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center mb-2">
        <p className="text-md font-black text-[#013300]/50 uppercase tracking-[0.2em]">
          ARCHIVED ({materials.length})
        </p>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm font-black text-[#013300] uppercase tracking-[0.3em] whitespace-nowrap">
          {category}
        </span>
        <div className="h-[1px] flex-1 bg-gray-100" />
      </div>

      <div className="flex flex-col gap-4">
        {materials.map((material) => {
          const dateInfo = formatDate(material.createdAt);
          return (
            <div
              key={`${material.source}-${material.id}-${material.requestId ?? "none"}`}
              className="group flex flex-row items-center justify-between w-full bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-[#013300]/20 transition-all duration-300"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex-shrink-0 flex flex-col items-center justify-center w-12 h-14 bg-gray-50 text-gray-500 rounded-lg border border-gray-100">
                  <span className="text-[0.6rem] font-bold uppercase tracking-wide leading-none">{dateInfo.month}</span>
                  <span className="text-lg font-black leading-none mt-1 text-[#013300]">{dateInfo.day}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.6rem] font-bold uppercase tracking-wider bg-red-100 text-red-700">
                      Rejected
                    </span>
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
                  {material.rejectionReason && (
                    <p className="text-xs text-red-500 mt-2">Reason: {material.rejectionReason}</p>
                  )}
                </div>
              </div>

              <div className="ml-4 flex-shrink-0 flex items-center gap-2">
                <UtilityButton small onClick={() => handleOpenMaterial(material)} className="!px-4 !py-1.5 font-bold">
                  View
                </UtilityButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
