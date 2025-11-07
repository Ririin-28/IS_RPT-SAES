export const MATERIAL_SUBJECTS = ["English", "Filipino", "Math"] as const;
export type MaterialSubject = (typeof MATERIAL_SUBJECTS)[number];

export const MATERIAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

const SUBJECT_LOOKUP = new Set<string>(MATERIAL_SUBJECTS);
const STATUS_LOOKUP = new Set<string>(MATERIAL_STATUSES);

export type MaterialFileDto = {
  id: number;
  materialId: number;
  fileName: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
};

export type MaterialDto = {
  id: number;
  teacherUserId: number;
  subject: MaterialSubject;
  level: string;
  title: string;
  description: string | null;
  attachmentUrl: string | null;
  status: MaterialStatus;
  rejectionReason: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  teacher: {
    userId: number;
    username: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
  };
  reviewer: {
    userId: number;
    username: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
  } | null;
  files: MaterialFileDto[];
};

export function isValidMaterialSubject(value: unknown): value is MaterialSubject {
  return typeof value === "string" && SUBJECT_LOOKUP.has(value);
}

export function isValidMaterialStatus(value: unknown): value is MaterialStatus {
  return typeof value === "string" && STATUS_LOOKUP.has(value);
}

export function normalizeMaterialSubject(value: unknown): MaterialSubject | null {
  if (typeof value !== "string") return null;
  const match = MATERIAL_SUBJECTS.find((candidate) => candidate.toLowerCase() === value.toLowerCase().trim());
  return match ?? null;
}

export function normalizeMaterialStatus(value: unknown): MaterialStatus | null {
  if (typeof value !== "string") return null;
  const match = MATERIAL_STATUSES.find((candidate) => candidate.toLowerCase() === value.toLowerCase().trim());
  return match ?? null;
}

export function normalizePublicPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
