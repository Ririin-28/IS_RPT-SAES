"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MaterialDto, MaterialStatus } from "@/lib/materials/shared";
import {
  MATERIAL_SUBJECTS,
  normalizeMaterialStatus,
  normalizeMaterialSubject,
  normalizePublicPath,
} from "@/lib/materials/shared";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

export type CoordinatorMaterialRow = MaterialDto & {
  teacherName: string;
  source: "teacher" | "remedial";
  requestId: string | null;
};

const parseUserId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const buildTeacherName = (material: MaterialDto): string => {
  const parts = [material.teacher.firstName, material.teacher.middleName, material.teacher.lastName]
    .map((value) => (value ? value.trim() : ""))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : material.teacher.username ?? "Unknown";
};

export type UseCoordinatorMaterialsOptions = {
  subject: string;
  level: string;
  requestId?: string | number | null;
};

export type UseCoordinatorMaterialsResult = {
  reviewerUserId: number | null;
  materials: CoordinatorMaterialRow[];
  loading: boolean;
  updating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  approveMaterial: (material: CoordinatorMaterialRow, options?: UpdateOptions) => Promise<void>;
  rejectMaterial: (material: CoordinatorMaterialRow, reason: string, options?: UpdateOptions) => Promise<void>;
};

export type UpdateOptions = {
  skipRefresh?: boolean;
};

export function useCoordinatorMaterials({ subject, level, requestId }: UseCoordinatorMaterialsOptions): UseCoordinatorMaterialsResult {
  const [reviewerUserId, setReviewerUserId] = useState<number | null>(null);
  const [materials, setMaterials] = useState<CoordinatorMaterialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedSubject = useMemo(() => normalizeMaterialSubject(subject) ?? MATERIAL_SUBJECTS[0], [subject]);
  const normalizedLevel = useMemo(() => level.trim(), [level]);
  const normalizedRequestId = useMemo(() => {
    if (requestId === null || requestId === undefined) return null;
    const text = String(requestId).trim();
    return text.length ? text : null;
  }, [requestId]);

  useEffect(() => {
    const profile = getStoredUserProfile();
    const userId = parseUserId(profile?.userId ?? null);
    setReviewerUserId(userId);
  }, []);

  const fetchTeacherMaterials = useCallback(async (): Promise<CoordinatorMaterialRow[]> => {
    if (!normalizedLevel) return [];

    const params = new URLSearchParams({
      subject: normalizedSubject,
      level: normalizedLevel,
      status: "pending",
      pageSize: "100",
    });

    const response = await fetch(`/api/materials?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch teacher materials (${response.status})`);
    }

    const data = await response.json();
    const rows: MaterialDto[] = Array.isArray(data?.data) ? data.data : [];
    const visibleRows = rows.filter((row) => row.status !== "rejected");

    return visibleRows.map((row) => ({
      ...row,
      teacherName: buildTeacherName(row),
      source: "teacher" as const,
      requestId: null,
    }));
  }, [normalizedSubject, normalizedLevel]);

  const fetchRemedialMaterials = useCallback(async (): Promise<CoordinatorMaterialRow[]> => {
    if (!normalizedRequestId) return [];

    const response = await fetch(`/api/remedial-materials?requestId=${encodeURIComponent(normalizedRequestId)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const { error: fetchError } = await response.json().catch(() => ({ error: "Unable to load remedial materials" }));
      throw new Error(fetchError ?? "Unable to load remedial materials");
    }

    const payload = await response.json();
    const items: Array<Record<string, any>> = Array.isArray(payload?.materials) ? payload.materials : [];

    return items
      .map((item, index): CoordinatorMaterialRow | null => {
        const status = (normalizeMaterialStatus(
          item.status ?? item.Status ?? item.STATUS ?? item.material_status,
        ) ?? "pending") as MaterialStatus;
        const submissionPath =
          item.file_path ?? item.material_file ?? item.materialFile ?? item.filePath ?? item.storage_path ?? null;
        const attachmentUrl = normalizePublicPath(typeof submissionPath === "string" ? submissionPath : null);
        const submittedByRaw = item.submitted_by ?? item.submittedBy ?? null;
        const submittedBy = submittedByRaw ? String(submittedByRaw) : null;
        const submittedName = item.submitted_by_name ? String(item.submitted_by_name) : submittedBy;
        const levelName = typeof item.level_name === "string" && item.level_name.trim().length ? item.level_name.trim() : normalizedLevel;
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
          source: "remedial" as const,
          requestId: normalizedRequestId,
        } satisfies CoordinatorMaterialRow;
      })
      .filter((item): item is CoordinatorMaterialRow => item !== null);
  }, [normalizedLevel, normalizedRequestId, normalizedSubject]);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [teacherRows, remedialRows] = await Promise.all([
        fetchTeacherMaterials().catch((error) => {
          console.error("Failed to load teacher materials", error);
          throw error;
        }),
        fetchRemedialMaterials().catch((error) => {
          console.error("Failed to load remedial materials", error);
          return [] as CoordinatorMaterialRow[];
        }),
      ]);

      const combined = [...teacherRows, ...remedialRows]
        .filter((row) => row.status !== "rejected")
        .sort((a, b) => {
        const aDate = new Date(a.createdAt).getTime();
        const bDate = new Date(b.createdAt).getTime();
        return bDate - aDate;
      });

      setMaterials(combined);
    } catch (err) {
      console.error("Failed to load coordinator materials", err);
      setError("Unable to load materials");
    } finally {
      setLoading(false);
    }
  }, [fetchTeacherMaterials, fetchRemedialMaterials]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const refresh = useCallback(async () => {
    await fetchMaterials();
  }, [fetchMaterials]);

  const updateMaterialStatus = useCallback(
    async (material: CoordinatorMaterialRow, status: MaterialStatus, rejectionReason?: string | null, options?: UpdateOptions) => {
      if (!reviewerUserId) {
        setError("Missing reviewer profile. Please re-login.");
        return;
      }
      setUpdating(true);
      setError(null);
      try {
        if (material.source === "remedial") {
          const response = await fetch("/api/remedial-materials", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: material.id,
              status,
              rejectionReason: rejectionReason ?? null,
              approvedBy: reviewerUserId,
            }),
          });

          if (!response.ok) {
            const { error: updateError } = await response.json().catch(() => ({ error: "Update failed" }));
            throw new Error(updateError ?? "Update failed");
          }
        } else {
          const response = await fetch(`/api/materials/${material.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status,
              reviewedBy: reviewerUserId,
              rejectionReason: rejectionReason ?? null,
              subject: material.subject,
            }),
          });

          if (!response.ok) {
            const { error: updateError } = await response.json().catch(() => ({ error: "Update failed" }));
            throw new Error(updateError ?? "Update failed");
          }
        }
        if (!options?.skipRefresh) {
          await fetchMaterials();
        }
      } catch (err) {
        console.error("Failed to update material", err);
        setError(err instanceof Error ? err.message : "Failed to update material");
      } finally {
        setUpdating(false);
      }
    },
    [reviewerUserId, fetchMaterials],
  );

  const approveMaterial = useCallback(
    async (material: CoordinatorMaterialRow, options?: UpdateOptions) => {
      await updateMaterialStatus(material, "approved", null, options);
    },
    [updateMaterialStatus],
  );

  const rejectMaterial = useCallback(
    async (material: CoordinatorMaterialRow, reason: string, options?: UpdateOptions) => {
      await updateMaterialStatus(material, "rejected", reason || "Rejected", options);
    },
    [updateMaterialStatus],
  );

  return {
    reviewerUserId,
    materials,
    loading,
    updating,
    error,
    refresh,
    approveMaterial,
    rejectMaterial,
  };
}
