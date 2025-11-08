"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { normalizeMaterialSubject, type MaterialSubject } from "@/lib/materials/shared";

export type CoordinatorStudent = {
  id: number;
  studentId: string;
  name: string;
  grade: string;
  section: string;
  age: string;
  guardian: string;
  guardianContact: string;
  address: string;
  relationship: string;
  englishPhonemic: string;
  filipinoPhonemic: string;
  mathProficiency: string;
};

type CreateStudentPayload = {
  studentId?: string;
  name: string;
  grade?: string;
  section?: string;
  guardian?: string;
  guardianContact?: string;
  address?: string;
  age?: string;
  relationship?: string;
  englishPhonemic?: string;
  filipinoPhonemic?: string;
  mathProficiency?: string;
};

const SUBJECT_FALLBACK: MaterialSubject = "English";

const transformApiRecord = (record: any): CoordinatorStudent => ({
  id: Number(record.id),
  studentId: record.studentIdentifier ?? "",
  name: record.fullName ?? record.name ?? "Unnamed Student",
  grade: record.gradeLevel ?? record.grade ?? "",
  section: record.section ?? "",
  age: record.age ?? "",
  guardian: record.guardianName ?? record.guardian ?? "",
  guardianContact: record.guardianContact ?? "",
  address: record.address ?? "",
  relationship: record.relationship ?? "",
  englishPhonemic: record.englishPhonemic ?? "",
  filipinoPhonemic: record.filipinoPhonemic ?? "",
  mathProficiency: record.mathProficiency ?? "",
});

export type UseCoordinatorStudentsResult = {
  subject: MaterialSubject;
  gradeLevel: string | null;
  students: CoordinatorStudent[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addStudent: (student: CreateStudentPayload) => Promise<void>;
  updateStudent: (id: number, student: CreateStudentPayload) => Promise<void>;
  importStudents: (students: CreateStudentPayload[]) => Promise<void>;
  deleteStudents: (ids: number[]) => Promise<void>;
};

export function useCoordinatorStudents(): UseCoordinatorStudentsResult {
  const [subject, setSubject] = useState<MaterialSubject>(SUBJECT_FALLBACK);
  const [gradeLevel, setGradeLevel] = useState<string | null>(null);
  const [students, setStudents] = useState<CoordinatorStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userProfile = useMemo(() => getStoredUserProfile(), []);
  const userId = useMemo(() => {
    const raw = userProfile?.userId;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }, [userProfile]);

  const fetchSubject = useCallback(async (): Promise<MaterialSubject> => {
    if (!userId) {
      setError("Missing coordinator profile. Please log in again.");
      setGradeLevel(null);
      return SUBJECT_FALLBACK;
    }

    try {
      const response = await fetch(`/api/master_teacher/coordinator/profile?userId=${encodeURIComponent(String(userId))}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to determine coordinator subject.");
      }
      const subjectCandidate = payload.coordinator?.coordinatorSubject ?? payload.coordinator?.subjectsHandled ?? null;
      const resolved = normalizeMaterialSubject(subjectCandidate) ?? SUBJECT_FALLBACK;
      const gradeCandidate = payload.coordinator?.gradeLevel ?? null;
      const normalizedGrade = typeof gradeCandidate === "string"
        ? gradeCandidate.trim() || null
        : gradeCandidate !== null && gradeCandidate !== undefined
          ? String(gradeCandidate).trim() || null
          : null;
      setGradeLevel(normalizedGrade);
      setSubject(resolved);
      return resolved;
    } catch (err) {
      console.error("Failed to load coordinator subject", err);
      setError(err instanceof Error ? err.message : "Unable to determine subject.");
      setGradeLevel(null);
      setSubject(SUBJECT_FALLBACK);
      return SUBJECT_FALLBACK;
    }
  }, [userId]);

  const fetchStudents = useCallback(
    async (resolvedSubject?: MaterialSubject) => {
      const subjectToUse = resolvedSubject ?? subject;
      if (!userId) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/students?subject=${encodeURIComponent(subjectToUse)}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch students (${response.status})`);
        }
        const payload = await response.json();
        const data = Array.isArray(payload?.data) ? payload.data : [];
        setStudents(data.map(transformApiRecord));
      } catch (err) {
        console.error("Failed to fetch coordinator students", err);
        setError(err instanceof Error ? err.message : "Unable to load students.");
      } finally {
        setLoading(false);
      }
    },
    [subject, userId],
  );

  useEffect(() => {
    (async () => {
      const resolved = await fetchSubject();
      await fetchStudents(resolved);
    })();
  }, [fetchSubject, fetchStudents]);

  const refresh = useCallback(async () => {
    await fetchStudents();
  }, [fetchStudents]);

  const persistStudents = useCallback(
    async (studentsPayload: CreateStudentPayload[]) => {
      if (!userId) {
        setError("Missing coordinator profile. Please log in again.");
        return;
      }
      if (studentsPayload.length === 0) {
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const response = await fetch("/api/students", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            createdBy: userId,
            subject,
            students: studentsPayload.map((student) => ({
              studentIdentifier: student.studentId ?? null,
              fullName: student.name,
              gradeLevel: student.grade ?? null,
              section: student.section ?? null,
              age: student.age ?? null,
              guardianName: student.guardian ?? null,
              guardianContact: student.guardianContact ?? null,
              relationship: student.relationship ?? null,
              address: student.address ?? null,
              englishPhonemic: student.englishPhonemic ?? null,
              filipinoPhonemic: student.filipinoPhonemic ?? null,
              mathProficiency: student.mathProficiency ?? null,
            })),
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Failed to save students");
        }
        await fetchStudents();
      } catch (err) {
        console.error("Failed to persist students", err);
        setError(err instanceof Error ? err.message : "Failed to save students.");
      } finally {
        setSaving(false);
      }
    },
    [fetchStudents, subject, userId],
  );

  const addStudent = useCallback(async (student: CreateStudentPayload) => {
    await persistStudents([student]);
  }, [persistStudents]);

  const updateStudent = useCallback(async (id: number, student: CreateStudentPayload) => {
    if (!userId) {
      setError("Missing coordinator profile. Please log in again.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/students/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          studentIdentifier: student.studentId ?? null,
          fullName: student.name,
          gradeLevel: student.grade ?? null,
          section: student.section ?? null,
          age: student.age ?? null,
          guardianName: student.guardian ?? null,
          guardianContact: student.guardianContact ?? null,
          relationship: student.relationship ?? null,
          address: student.address ?? null,
          englishPhonemic: student.englishPhonemic ?? null,
          filipinoPhonemic: student.filipinoPhonemic ?? null,
          mathProficiency: student.mathProficiency ?? null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to update student");
      }
      await fetchStudents();
    } catch (err) {
      console.error("Failed to update student", err);
      setError(err instanceof Error ? err.message : "Failed to update student.");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [fetchStudents, userId]);

  const importStudents = useCallback(async (studentList: CreateStudentPayload[]) => {
    await persistStudents(studentList);
  }, [persistStudents]);

  const deleteStudentsHandler = useCallback(async (ids: number[]) => {
    if (!userId || ids.length === 0) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(`/api/students/${id}?userId=${encodeURIComponent(String(userId))}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error ?? "Failed to delete student");
          }
        }),
      );
      await fetchStudents();
    } catch (err) {
      console.error("Failed to delete students", err);
      setError(err instanceof Error ? err.message : "Failed to delete students.");
    } finally {
      setSaving(false);
    }
  }, [fetchStudents, userId]);

  return {
    subject,
    gradeLevel,
    students,
    loading,
    saving,
    error,
    refresh,
    addStudent,
    updateStudent,
    importStudents,
    deleteStudents: deleteStudentsHandler,
  };
}
