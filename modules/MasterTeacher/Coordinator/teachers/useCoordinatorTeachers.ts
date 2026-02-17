"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { normalizeMaterialSubject, type MaterialSubject } from "@/lib/materials/shared";

export type CoordinatorTeacher = {
  id: number;
  userId: number | null;
  teacherId: string;
  masterTeacherId?: string | null;
  name: string;
  email: string;
  contactNumber: string;
  grade: string | null;
  sections: string | null;
  subjects: string | null;
};

type ProfileResult = {
  subject: MaterialSubject | null;
  subjectLabel: string | null;
  gradeLabel: string | null;
  gradeKey: string | null;
  success: boolean;
};

const SUBJECT_FALLBACK: MaterialSubject = "English";

function toNumericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeGradeKey(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  if (trimmed.length === 0) {
    return null;
  }
  const digitMatch = trimmed.match(/\d+/);
  if (digitMatch) {
    return digitMatch[0];
  }
  return trimmed.toLowerCase();
}

function sanitizeLabel(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function transformTeacherRecord(record: any, index: number): CoordinatorTeacher {
  const userId = toNumericId(record?.userId ?? record?.user_id);
  const teacherIdRaw = record?.teacherId ?? record?.teacher_id ?? userId ?? null;
  const teacherId = teacherIdRaw != null ? String(teacherIdRaw) : `T-${index + 1}`;
  const numericTeacherId = toNumericId(teacherIdRaw);
  const fallbackId = numericTeacherId ?? userId ?? index + 1;

  const contactNumber: string = sanitizeLabel(record?.contactNumberDisplay)
    ?? sanitizeLabel(record?.contactNumber)
    ?? sanitizeLabel(record?.phoneNumber)
    ?? "";

  return {
    id: fallbackId,
    userId: userId ?? null,
    teacherId,
    name: sanitizeLabel(record?.name) ?? "Unnamed Teacher",
    email: sanitizeLabel(record?.email) ?? "",
    contactNumber,
    grade: sanitizeLabel(record?.grade),
    sections: sanitizeLabel(record?.sections) ?? sanitizeLabel(record?.section),
    subjects: sanitizeLabel(record?.subjects),
  };
}

export type UseCoordinatorTeachersResult = {
  subject: MaterialSubject;
  subjectLabel: string | null;
  gradeLabel: string | null;
  teachers: CoordinatorTeacher[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useCoordinatorTeachers(): UseCoordinatorTeachersResult {
  const [subject, setSubject] = useState<MaterialSubject>(SUBJECT_FALLBACK);
  const [subjectLabel, setSubjectLabel] = useState<string | null>(null);
  const [gradeLabel, setGradeLabel] = useState<string | null>(null);
  const [gradeKey, setGradeKey] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<CoordinatorTeacher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const userProfile = useMemo(() => getStoredUserProfile(), []);
  const userId = useMemo(() => {
    const raw = userProfile?.userId;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === "string") {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }, [userProfile]);

  const fetchProfile = useCallback(async (): Promise<ProfileResult> => {
    if (!userId) {
      setError("Missing coordinator profile. Please log in again.");
      setGradeLabel(null);
      setGradeKey(null);
      setSubject(SUBJECT_FALLBACK);
      setSubjectLabel(null);
      return {
        subject: SUBJECT_FALLBACK,
        subjectLabel: null,
        gradeLabel: null,
        gradeKey: null,
        success: false,
      };
    }

    try {
      const response = await fetch(`/api/master_teacher/coordinator/profile?userId=${encodeURIComponent(String(userId))}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to load coordinator profile.");
      }

      const coordinator = payload?.coordinator ?? {};
      const gradeCandidate = coordinator?.gradeLevel ?? coordinator?.grade ?? null;
      const gradeLabelValue = sanitizeLabel(gradeCandidate);
      const gradeKeyValue = normalizeGradeKey(gradeLabelValue);

      const coordinatorSubjectRaw = coordinator?.coordinatorSubject ?? coordinator?.subjectsHandled ?? null;
      const subjectNormalized = normalizeMaterialSubject(coordinatorSubjectRaw) ?? SUBJECT_FALLBACK;
      const subjectLabelValue = sanitizeLabel(coordinatorSubjectRaw) ?? subjectNormalized;

      setSubject(subjectNormalized);
      setSubjectLabel(subjectLabelValue);
      setGradeLabel(gradeLabelValue);
      setGradeKey(gradeKeyValue);
  setError(null);

      return {
        subject: subjectNormalized,
        subjectLabel: subjectLabelValue,
        gradeLabel: gradeLabelValue,
        gradeKey: gradeKeyValue,
        success: true,
      };
    } catch (err) {
      console.error("Failed to load coordinator profile", err);
      setError(err instanceof Error ? err.message : "Unable to load coordinator profile.");
      setSubject(SUBJECT_FALLBACK);
      setSubjectLabel(null);
      setGradeLabel(null);
      setGradeKey(null);
      return {
        subject: SUBJECT_FALLBACK,
        subjectLabel: null,
        gradeLabel: null,
        gradeKey: null,
        success: false,
      };
    }
  }, [userId]);

  const fetchTeachers = useCallback(async (gradeKeyOverride?: string | null) => {
    try {
      // Coordinator should not call the super-admin-only endpoint (it returns "Not authenticated").
      // Use the principal-facing teachers API which returns the same teacher records shape we need.
      const response = await fetch("/api/principal/teachers", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? `Failed to fetch teachers (${response.status}).`);
      }

      // Support multiple API shapes:
      // - Super-admin endpoint: { records: [...] }
      // - Principal endpoint: { teachers: [...] }
      const records: any[] = Array.isArray(payload?.records)
        ? payload.records
        : Array.isArray(payload?.teachers)
        ? payload.teachers
        : [];

      const effectiveGradeKey = gradeKeyOverride ?? gradeKey;

      const filtered = effectiveGradeKey
        ? records.filter((record) => normalizeGradeKey(record?.grade) === effectiveGradeKey)
        : records;

      setTeachers(filtered.map((record, index) => transformTeacherRecord(record, index)));
      setError(null);
    } catch (err) {
      console.error("Failed to fetch coordinator teachers", err);
      setError(err instanceof Error ? err.message : "Unable to load teachers.");
      setTeachers([]);
    }
  }, [gradeKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await fetchProfile();
      if (!profile.success) {
        setTeachers([]);
        return;
      }
      await fetchTeachers(profile.gradeKey);
    } finally {
      setLoading(false);
    }
  }, [fetchProfile, fetchTeachers]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return {
    subject,
    subjectLabel,
    gradeLabel,
    teachers,
    loading,
    error,
    refresh,
  };
}
