"use client";
import Sidebar from "@/components/MasterTeacher/Coordinator/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import BaseModal from "@/components/Common/Modals/BaseModal";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import { FaTimes } from "react-icons/fa";
import { useCallback, useEffect, useMemo, useState } from "react";
import StudentTab, { type CoordinatorStudent } from "./StudentsTab";
import { type MaterialSubject } from "@/lib/materials/shared";
import { useCoordinatorTeachers, type CoordinatorTeacher } from "../teachers/useCoordinatorTeachers";
import { formatFullNameWithMiddleInitial, getStoredUserProfile } from "@/lib/utils/user-profile";

type StudentMeta = {
  subject: MaterialSubject;
  gradeLevel: string | null;
  students: CoordinatorStudent[];
};

type AssignmentGroup = {
  teacher: CoordinatorTeacher;
  students: CoordinatorStudent[];
};

type AssignmentTeacherType = "master_coordinator" | "master_remedial" | "regular_teacher";

const normalizeGradeKey = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\d+/);
  if (match) return match[0];
  return trimmed.toLowerCase();
};

const shuffleStudents = (list: CoordinatorStudent[]): CoordinatorStudent[] => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export default function MasterTeacherStudents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [subject, setSubject] = useState<MaterialSubject>("English");
  const headerTitle = useMemo(() => `${subject} Students Information List`, [subject]);
  const [studentMeta, setStudentMeta] = useState<StudentMeta>({
    subject: "English",
    gradeLevel: null,
    students: [],
  });
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showAssignConfirm, setShowAssignConfirm] = useState(false);
  const [assignmentPreview, setAssignmentPreview] = useState<AssignmentGroup[]>([]);
  const [remedialTeachers, setRemedialTeachers] = useState<CoordinatorTeacher[]>([]);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);

  const { teachers, loading: teachersLoading } = useCoordinatorTeachers();
  const coordinatorProfile = useMemo(() => getStoredUserProfile(), []);
  const coordinatorTeacher = useMemo<CoordinatorTeacher | null>(() => {
    if (!coordinatorProfile?.userId) {
      return null;
    }
    const userId = typeof coordinatorProfile.userId === "number"
      ? coordinatorProfile.userId
      : Number(coordinatorProfile.userId);
    if (!Number.isFinite(userId)) {
      return null;
    }
    const name = formatFullNameWithMiddleInitial(coordinatorProfile) || "Master Teacher";
    return {
      id: userId,
      userId,
      teacherId: String(userId),
      name,
      email: coordinatorProfile.email ?? "",
      contactNumber: "",
      grade: studentMeta.gradeLevel ?? null,
      sections: null,
      subjects: String(studentMeta.subject ?? ""),
    } satisfies CoordinatorTeacher;
  }, [coordinatorProfile, studentMeta.gradeLevel, studentMeta.subject]);

  useEffect(() => {
    const gradeKey = normalizeGradeKey(studentMeta.gradeLevel);
    if (!gradeKey) {
      setRemedialTeachers([]);
      return;
    }

    let cancelled = false;
    const loadRemedialTeachers = async () => {
      try {
        const response = await fetch("/api/it_admin/accounts/masterteacher", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(payload?.records)) {
          setRemedialTeachers([]);
          return;
        }

        const filtered = payload.records.filter((record: any) => {
          const recordGradeKey = normalizeGradeKey(record?.grade ?? null);
          const handledGrades: string[] = Array.isArray(record?.remedialHandledGrades) ? record.remedialHandledGrades : [];
          const handledKeys = handledGrades
            .map((grade) => normalizeGradeKey(grade))
            .filter((key): key is string => Boolean(key));

          return recordGradeKey === gradeKey || handledKeys.includes(gradeKey);
        }).slice(0, 3);

        const mapped: CoordinatorTeacher[] = filtered.map((record: any, index: number) => {
          const userId = typeof record?.userId === "number" ? record.userId : Number(record?.userId ?? NaN);
          const masterTeacherId = record?.masterTeacherId ?? record?.master_teacher_id ?? null;
          const teacherId = record?.teacherId ?? masterTeacherId ?? record?.userId ?? `MT-${index + 1}`;
          return {
            id: Number.isFinite(userId) ? userId : index + 1,
            userId: Number.isFinite(userId) ? userId : null,
            teacherId: String(teacherId),
            masterTeacherId: masterTeacherId ? String(masterTeacherId) : null,
            name: record?.name ?? "Master Teacher",
            email: record?.email ?? "",
            contactNumber: record?.contactNumber ?? "",
            grade: record?.grade ?? studentMeta.gradeLevel ?? null,
            sections: record?.section ?? null,
            subjects: Array.isArray(record?.remedialHandledSubjects)
              ? record.remedialHandledSubjects.join(", ")
              : record?.remedialHandledSubjects ?? "Remedial",
          };
        });

        if (!cancelled) {
          setRemedialTeachers(mapped);
        }
      } catch {
        if (!cancelled) {
          setRemedialTeachers([]);
        }
      }
    };

    void loadRemedialTeachers();
    return () => {
      cancelled = true;
    };
  }, [studentMeta.gradeLevel]);

  const assignmentTeachers = useMemo(() => {
    const map = new Map<string, CoordinatorTeacher>();
    const addTeacher = (teacher: CoordinatorTeacher) => {
      const key = teacher.userId ? `u:${teacher.userId}` : `t:${teacher.teacherId}`;
      if (!map.has(key)) {
        map.set(key, teacher);
      }
    };
    teachers.forEach(addTeacher);
    remedialTeachers.forEach(addTeacher);
    if (coordinatorTeacher) {
      addTeacher(coordinatorTeacher);
    }
    return Array.from(map.values());
  }, [teachers, remedialTeachers, coordinatorTeacher]);

  const remedialTeacherKeys = useMemo(() => {
    const keys = new Set<string>();
    remedialTeachers.forEach((teacher) => {
      const key = teacher.userId ? `u:${teacher.userId}` : `t:${teacher.teacherId}`;
      keys.add(key);
    });
    return keys;
  }, [remedialTeachers]);

  const totalTeachers = assignmentTeachers.length;
  const totalStudents = studentMeta.students.length;

  const buildAssignmentPreview = useCallback((): AssignmentGroup[] => {
    if (!assignmentTeachers.length || !studentMeta.students.length) {
      return [];
    }
    const shuffled = shuffleStudents(studentMeta.students);
    const groups = assignmentTeachers.map((teacher) => ({ teacher, students: [] as CoordinatorStudent[] }));
        masterTeacherId: null,
    shuffled.forEach((student, index) => {
      groups[index % groups.length].students.push(student);
    });
    return groups;
  }, [studentMeta.students, assignmentTeachers]);

  const handleMetaChange = useCallback((meta: StudentMeta) => {
    setSubject(meta.subject);
    setStudentMeta(meta);
  }, []);

  const handleOpenAssignmentModal = () => {
    setAssignmentPreview(buildAssignmentPreview());
    setAssignmentError(null);
    setAssignmentSuccess(null);
    setShowAssignmentModal(true);
  };

  const handleCloseAssignmentModal = () => {
    setShowAssignmentModal(false);
  };

  const handleConfirmAssign = async () => {
    if (!studentMeta.gradeLevel) {
      setAssignmentError("Grade assignment is required before saving assignments.");
      setShowAssignConfirm(false);
      return;
    }

    if (!assignmentPreview.length) {
      setAssignmentError("No assignments were generated.");
      setShowAssignConfirm(false);
      return;
    }

    setAssignmentSaving(true);
    setAssignmentError(null);
    setAssignmentSuccess(null);

    try {
      const gradeMatch = studentMeta.gradeLevel.match(/\d+/);
      const gradeId = gradeMatch ? Number(gradeMatch[0]) : Number(studentMeta.gradeLevel);
      if (!Number.isFinite(gradeId)) {
        throw new Error("Invalid grade level.");
      }

      const payload = {
        gradeId,
        subject: studentMeta.subject,
        assignments: assignmentPreview.map((group) => {
          const teacherKey = group.teacher.userId
            ? `u:${group.teacher.userId}`
            : `t:${group.teacher.teacherId}`;
          const isRemedial = remedialTeacherKeys.has(teacherKey);
          const isCoordinator = coordinatorTeacher?.userId
            ? coordinatorTeacher.userId === group.teacher.userId
            : coordinatorTeacher?.teacherId === group.teacher.teacherId;
          const teacherType: AssignmentTeacherType = isCoordinator
            ? "master_coordinator"
            : isRemedial
            ? "master_remedial"
            : "regular_teacher";

          return {
            teacherType,
            teacherId: teacherType === "regular_teacher" ? group.teacher.teacherId : null,
            masterTeacherId:
              teacherType === "regular_teacher"
                ? null
                : group.teacher.masterTeacherId ?? group.teacher.teacherId,
            teacherUserId: group.teacher.userId ?? null,
            students: group.students.map((student) => student.id ?? student.studentId),
          };
        }),
      };

      const response = await fetch("/api/master_teacher/coordinator/student-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error ?? "Unable to save student assignments.");
      }

      setAssignmentSuccess("Assignments saved successfully.");
      setShowAssignConfirm(false);
      setShowAssignmentModal(false);
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : "Unable to save student assignments.");
      setShowAssignConfirm(false);
    } finally {
      setAssignmentSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/*---------------------------------Sidebar---------------------------------*/}
      <Sidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div
        className="
        /* Mobile */
        flex-1 pt-16 flex flex-col overflow-hidden      
      "
      >
        <Header title={`Student List`} />
        <main className="flex-1">
          <div
            className="
            /* Mobile */
            p-4 h-full
            
            /* Tablet */
            sm:p-5
            
            /* Desktop */
            md:p-6
          "
          >
            {/*---------------------------------Main Container---------------------------------*/}
            <div
              className="
              /* Mobile */
              bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] 
              overflow-y-auto p-4
              
              /* Tablet */
              sm:p-5
              
              /* Desktop */
              md:p-6
            "
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <SecondaryHeader title={headerTitle} />
                <div className="flex flex-col gap-3 w-full sm:w-auto mt-4 sm:mt-0 sm:flex-row sm:items-center">
                  <PrimaryButton
                    type="button"
                    small
                    onClick={handleOpenAssignmentModal}
                    disabled={teachersLoading || totalTeachers === 0 || totalStudents === 0}
                  >
                    Auto-Assign Students
                  </PrimaryButton>
                  <div className="relative flex-1 sm:flex-initial">
                    <input
                      type="text"
                      placeholder="Search students..."
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 text-black"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setSearchTerm("")}
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/*---------------------------------Tab Content---------------------------------*/}
              <div className="mt-4 sm:mt-6">
                <StudentTab
                  searchTerm={searchTerm}
                  onMetaChange={handleMetaChange}
                />
              </div>
            </div>
          </div>
        </main>
      </div>

      <BaseModal
        show={showAssignmentModal}
        onClose={handleCloseAssignmentModal}
        title="Auto-Assign Students"
        maxWidth="3xl"
        footer={(
          <>
            <SecondaryButton type="button" onClick={handleCloseAssignmentModal}>
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="button"
              onClick={() => setShowAssignConfirm(true)}
              disabled={totalTeachers === 0 || totalStudents === 0 || assignmentSaving}
            >
              {assignmentSaving ? "Assigning..." : "Assign"}
            </PrimaryButton>
          </>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total Teachers</p>
            <p className="text-2xl font-semibold text-gray-900">{totalTeachers}</p>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total Students</p>
            <p className="text-2xl font-semibold text-gray-900">{totalStudents}</p>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Assignment Scope</p>
            <p className="text-sm font-semibold text-gray-900">
              Grade {studentMeta.gradeLevel ?? "-"} · {studentMeta.subject}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Students are shuffled and divided as evenly as possible.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">Division of Students</p>
          {assignmentError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {assignmentError}
            </div>
          )}
          {assignmentSuccess && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {assignmentSuccess}
            </div>
          )}
          {totalTeachers === 0 || totalStudents === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Add teachers and students before running the assignment.
            </div>
          ) : (
            <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-2">
              {assignmentPreview.map((group) => (
                <div key={group.teacher.id} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">{group.teacher.name}</p>
                      {remedialTeacherKeys.has(group.teacher.userId ? `u:${group.teacher.userId}` : `t:${group.teacher.teacherId}`) && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-800">
                          Remedial MT
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-500">
                      {group.students.length} student{group.students.length <= 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    {group.students.length
                      ? group.students.map((student) => student.name).join(", ")
                      : "No students assigned."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </BaseModal>

      <ConfirmationModal
        isOpen={showAssignConfirm}
        onClose={() => setShowAssignConfirm(false)}
        onConfirm={handleConfirmAssign}
        title="Confirm Assignment"
        message={`Assign ${totalStudents} students to ${totalTeachers} teachers for Grade ${studentMeta.gradeLevel ?? "-"} (${studentMeta.subject})?`}
      />
    </div>
  );
}

