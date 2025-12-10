"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MaterialDto, MaterialStatus } from "@/lib/materials/shared";
import { MATERIAL_SUBJECTS, normalizeMaterialSubject } from "@/lib/materials/shared";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

export type CoordinatorMaterialRow = MaterialDto & {
  teacherName: string;
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
};

export type UseCoordinatorMaterialsResult = {
  reviewerUserId: number | null;
  materials: CoordinatorMaterialRow[];
  loading: boolean;
  updating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  approveMaterial: (materialId: number) => Promise<void>;
  rejectMaterial: (materialId: number, reason: string) => Promise<void>;
};

export function useCoordinatorMaterials({ subject, level }: UseCoordinatorMaterialsOptions): UseCoordinatorMaterialsResult {
  const [reviewerUserId, setReviewerUserId] = useState<number | null>(null);
  const [materials, setMaterials] = useState<CoordinatorMaterialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedSubject = useMemo(() => normalizeMaterialSubject(subject) ?? MATERIAL_SUBJECTS[0], [subject]);
  const normalizedLevel = useMemo(() => level.trim(), [level]);

  useEffect(() => {
    const profile = getStoredUserProfile();
    const userId = parseUserId(profile?.userId ?? null);
    setReviewerUserId(userId);
  }, []);

  const fetchMaterials = useCallback(async () => {
    if (!normalizedLevel) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        subject: normalizedSubject,
        level: normalizedLevel,
        pageSize: "100",
      });
      const response = await fetch(`/api/master_teacher/coordinator/materials?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to fetch materials (${response.status})`);
      }
  const data = await response.json();
  const rows: MaterialDto[] = Array.isArray(data?.data) ? data.data : [];
  const visibleRows = rows.filter((row) => row.status !== "rejected");
  setMaterials(visibleRows.map((row) => ({ ...row, teacherName: buildTeacherName(row) })));
    } catch (err) {
      console.error("Failed to load coordinator materials", err);
      setError("Unable to load materials");
    } finally {
      setLoading(false);
    }
  }, [normalizedSubject, normalizedLevel]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const refresh = useCallback(async () => {
    await fetchMaterials();
  }, [fetchMaterials]);

  const updateMaterialStatus = useCallback(
    async (materialId: number, status: MaterialStatus, rejectionReason?: string | null) => {
      if (!reviewerUserId) {
        setError("Missing reviewer profile. Please re-login.");
        return;
      }
      setUpdating(true);
      setError(null);
      try {
        const response = await fetch(`/api/materials/${materialId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            reviewedBy: reviewerUserId,
            rejectionReason: rejectionReason ?? null,
          }),
        });
        if (!response.ok) {
          const { error: updateError } = await response.json().catch(() => ({ error: "Update failed" }));
          throw new Error(updateError ?? "Update failed");
        }
        await fetchMaterials();
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
    async (materialId: number) => {
      await updateMaterialStatus(materialId, "approved");
    },
    [updateMaterialStatus],
  );

  const rejectMaterial = useCallback(
    async (materialId: number, reason: string) => {
      await updateMaterialStatus(materialId, "rejected", reason || "Rejected");
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
