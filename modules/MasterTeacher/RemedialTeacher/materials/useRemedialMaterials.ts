"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MaterialDto, MaterialFileDto, MaterialStatus } from "@/lib/materials/shared";
import { MATERIAL_SUBJECTS, type MaterialSubject } from "@/lib/materials/shared";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

export type RemedialMaterialListItem = {
  id: number;
  title: string;
  status: MaterialStatus;
  submittedAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  attachmentUrl: string | null;
  files: MaterialFileDto[];
};

const MAX_UPLOAD_BATCH = 5;

const isPptxFile = (file: File): boolean => file.name.toLowerCase().endsWith(".pptx");

type UploadedFileDescriptor = {
  fileName: string;
  storedFileName: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string | null;
  fileSize: number;
};

const parseUserId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const mapMaterial = (material: MaterialDto): RemedialMaterialListItem => {
  return {
    id: material.id,
    title: material.title,
    status: material.status,
    submittedAt: new Date(material.createdAt),
    updatedAt: new Date(material.updatedAt),
    reviewedAt: material.reviewedAt ? new Date(material.reviewedAt) : null,
    rejectionReason: material.rejectionReason,
    attachmentUrl: material.attachmentUrl,
    files: material.files,
  };
};

const formatSubject = (subject: string): MaterialSubject => {
  const found = MATERIAL_SUBJECTS.find((candidate) => candidate.toLowerCase() === subject.toLowerCase());
  return found ?? "English";
};

export type UseRemedialMaterialsOptions = {
  subject: string;
  level: string;
};

export type UploadMaterialsOptions = {
  titlePrefix?: string | null;
  activityDate?: string | null;
};

export type UseRemedialMaterialsResult = {
  teacherUserId: number | null;
  materials: RemedialMaterialListItem[];
  loading: boolean;
  uploading: boolean;
  deleting: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  uploadFiles: (files: File[], options?: UploadMaterialsOptions) => Promise<void>;
  deleteMaterials: (materialIds: number[]) => Promise<void>;
};

export function useRemedialMaterials({ subject, level }: UseRemedialMaterialsOptions): UseRemedialMaterialsResult {
  const [teacherUserId, setTeacherUserId] = useState<number | null>(null);
  const [materials, setMaterials] = useState<RemedialMaterialListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedSubject = useMemo(() => formatSubject(subject), [subject]);
  const normalizedLevel = useMemo(() => level.trim(), [level]);

  useEffect(() => {
    const profile = getStoredUserProfile();
    const userId = parseUserId(profile?.userId ?? null);
    setTeacherUserId(userId);
  }, []);

  const fetchMaterials = useCallback(async () => {
    if (!teacherUserId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        subject: normalizedSubject,
        level: normalizedLevel,
        teacherUserId: String(teacherUserId),
        pageSize: "100",
      });
      const response = await fetch(`/api/materials?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to load materials (${response.status})`);
      const data = await response.json();
      const list = Array.isArray(data?.data) ? (data.data as MaterialDto[]) : [];
      setMaterials(list.map(mapMaterial));
    } catch (err) {
      console.error("Failed to fetch remedial materials", err);
      setError("Unable to load materials. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [teacherUserId, normalizedSubject, normalizedLevel]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const refresh = useCallback(async () => {
    await fetchMaterials();
  }, [fetchMaterials]);

  const uploadFiles = useCallback(
    async (files: File[], options?: UploadMaterialsOptions) => {
      if (!teacherUserId) {
        setError("Missing teacher profile. Please re-login.");
        return;
      }
      if (!files.length) return;
      if (files.length > MAX_UPLOAD_BATCH) {
        setError(`Please upload at most ${MAX_UPLOAD_BATCH} files at a time.`);
        return;
      }

      const invalidFile = files.find((file) => !isPptxFile(file));
      if (invalidFile) {
        setError(`Only .pptx files are supported. "${invalidFile.name}" is not a PPTX file.`);
        return;
      }

      const maxFileMb = Number(process.env.NEXT_PUBLIC_MATERIALS_MAX_FILE_MB ?? 10);
      const maxFileBytes = Math.max(1, Math.floor(maxFileMb * 1024 * 1024));
      const tooLarge = files.find((file) => file.size > maxFileBytes);
      if (tooLarge) {
        setError(`File "${tooLarge.name}" exceeds the ${maxFileMb}MB limit.`);
        return;
      }

      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        const uploadResponse = await fetch("/api/materials/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadResponse.ok) {
          const { error: uploadError } = await uploadResponse.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(uploadError ?? "Upload failed");
        }
        const uploadResult = await uploadResponse.json();
        const uploadedFiles: UploadedFileDescriptor[] = Array.isArray(uploadResult?.files)
          ? (uploadResult.files as UploadedFileDescriptor[])
          : [];
        if (!uploadedFiles.length) throw new Error("Files could not be saved");

        for (const uploaded of uploadedFiles) {
          const displayTitle = [options?.titlePrefix, uploaded.fileName || "Untitled Material"].filter(Boolean).join(" - ");
          const response = await fetch("/api/materials", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teacherUserId,
              subject: normalizedSubject,
              level: normalizedLevel,
              title: displayTitle,
              attachmentUrl: uploaded.storagePath,
              status: "pending",
              activityDate: options?.activityDate ?? null,
              files: [
                {
                  fileName: uploaded.fileName,
                  storagePath: uploaded.storagePath,
                  mimeType: uploaded.mimeType ?? null,
                  fileSize: uploaded.fileSize ?? null,
                },
              ],
            }),
          });
          if (!response.ok) {
            const { error: createError } = await response.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(createError ?? "Failed to create material");
          }
        }

        await fetchMaterials();
      } catch (err) {
        console.error("Failed to upload materials", err);
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [teacherUserId, normalizedSubject, normalizedLevel, fetchMaterials],
  );

  const deleteMaterials = useCallback(
    async (materialIds: number[]) => {
      if (!teacherUserId || materialIds.length === 0) return;
      setDeleting(true);
      setError(null);
      try {
        await Promise.all(
          materialIds.map(async (materialId) => {
            const response = await fetch(`/api/materials/${materialId}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ teacherUserId }),
            });
            if (!response.ok) {
              const { error: deleteError } = await response.json().catch(() => ({ error: "Failed to delete" }));
              throw new Error(deleteError ?? "Failed to delete material");
            }
          }),
        );
        await fetchMaterials();
      } catch (err) {
        console.error("Failed to delete materials", err);
        setError(err instanceof Error ? err.message : "Failed to delete materials");
      } finally {
        setDeleting(false);
      }
    },
    [teacherUserId, fetchMaterials],
  );

  return {
    teacherUserId,
    materials,
    loading,
    uploading,
    deleting,
    error,
    refresh,
    uploadFiles,
    deleteMaterials,
  };
}
