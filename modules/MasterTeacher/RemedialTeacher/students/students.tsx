"use client";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";
import { useCallback, useEffect, useMemo, useState, type ComponentType, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import EnglishStudentTab from "./EnglishTabs/StudentTab";
import EnglishAttendanceTab from "./EnglishTabs/AttendanceTab";
import FilipinoStudentTab from "./FilipinoTabs/StudentTab";
import FilipinoAttendanceTab from "./FilipinoTabs/AttendanceTab";
import MathStudentTab from "./MathTabs/StudentTab";
import MathAttendanceTab from "./MathTabs/AttendanceTab";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

type SubjectKey = "english" | "filipino" | "math";

type StudentTabProps = {
  students: any[];
  setStudents: Dispatch<SetStateAction<any[]>>;
  searchTerm: string;
};

type AttendanceTabProps = {
  students: any[];
  searchTerm: string;
};

type SubjectConfig = {
  label: string;
  headerTitle: string;
  StudentTab: ComponentType<StudentTabProps>;
  AttendanceTab: ComponentType<AttendanceTabProps>;
};

const SUBJECT_CONFIG: Record<SubjectKey, SubjectConfig> = {
  english: {
    label: "English",
    headerTitle: "English Students",
    StudentTab: EnglishStudentTab,
    AttendanceTab: EnglishAttendanceTab,
  },
  filipino: {
    label: "Filipino",
    headerTitle: "Filipino Students",
    StudentTab: FilipinoStudentTab,
    AttendanceTab: FilipinoAttendanceTab,
  },
  math: {
    label: "Math",
    headerTitle: "Math Students",
    StudentTab: MathStudentTab,
    AttendanceTab: MathAttendanceTab,
  },
};

const SUBJECT_OPTIONS = [
  { label: "English", value: "english" as const },
  { label: "Filipino", value: "filipino" as const },
  { label: "Math", value: "math" as const },
];

const TAB_OPTIONS = ["Information List", "Attendance List"] as const;

const normalizeSubject = (slug?: string): SubjectKey => {
  const value = (slug ?? "english").toLowerCase();
  if (value === "filipino") return "filipino";
  if (value === "math" || value === "mathematics") return "math";
  return "english";
};

type MasterTeacherStudentsProps = {
  subjectSlug?: string;
};

type RemedialStudent = {
  studentId: number | null;
  userId: number | null;
  remedialId: number | null;
  studentIdentifier: string | null;
  grade: string | null;
  section: string | null;
  english: string | null;
  filipino: string | null;
  math: string | null;
  guardian: string | null;
  guardianContact: string | null;
  address: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  fullName: string | null;
};

const createEmptySubjectStudents = (): Record<SubjectKey, any[]> => ({
  english: [],
  filipino: [],
  math: [],
});

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const composeDisplayName = (student: RemedialStudent): string => {
  const explicitFullName = student.fullName?.trim();
  if (explicitFullName) {
    return explicitFullName;
  }

  const parts = [student.firstName, student.middleName, student.lastName]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0);

  if (parts.length) {
    return parts.join(" ");
  }

  return "Unnamed Student";
};

const toDisplayStudent = (student: RemedialStudent, index: number) => {
  const numericStudentId = coerceNumber(student.studentId);
  const numericUserId = coerceNumber(student.userId);
  const numericRemedialId = coerceNumber(student.remedialId);

  const resolvedNumericId = numericStudentId ?? numericUserId ?? numericRemedialId ?? index + 1;

  const trimmedIdentifier = student.studentIdentifier?.trim();
  const identifier = trimmedIdentifier?.length
    ? trimmedIdentifier
    : numericStudentId !== null
    ? `ST-${String(numericStudentId).padStart(4, "0")}`
    : String(resolvedNumericId);

  return {
    id: resolvedNumericId,
    studentId: identifier,
    name: composeDisplayName(student),
    grade: student.grade ?? "",
    section: student.section ?? "",
    guardian: student.guardian ?? "",
    guardianContact: student.guardianContact ?? "",
    address: student.address ?? "",
    age: "",
    englishPhonemic: student.english ?? "",
    filipinoPhonemic: student.filipino ?? "",
    mathProficiency: student.math ?? "",
  };
};

const buildSubjectStudents = (students: RemedialStudent[]): Record<SubjectKey, any[]> => {
  const base = students.map(toDisplayStudent);
  return {
    english: base.map((student) => ({ ...student })),
    filipino: base.map((student) => ({ ...student })),
    math: base.map((student) => ({ ...student })),
  };
};

export default function MasterTeacherStudents({ subjectSlug }: MasterTeacherStudentsProps = {}) {
  const router = useRouter();
  const subject = useMemo(() => normalizeSubject(subjectSlug), [subjectSlug]);
  const { label: subjectLabel, headerTitle, StudentTab, AttendanceTab } = SUBJECT_CONFIG[subject];
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

  const [subjectStudents, setSubjectStudents] = useState<Record<SubjectKey, any[]>>(createEmptySubjectStudents);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>(TAB_OPTIONS[0]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setActiveTab(TAB_OPTIONS[0]);
    setSearchTerm("");
  }, [subject]);

  useEffect(() => {
    let isCancelled = false;

    if (userId === null) {
      setIsLoading(false);
      setLoadError("Unable to identify the current user. Please sign in again.");
      setSubjectStudents(createEmptySubjectStudents());
      return () => {
        isCancelled = true;
      };
    }

    const controller = new AbortController();

    const loadStudents = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const params = new URLSearchParams({ userId: String(userId), subject });
        const response = await fetch(`/api/master_teacher/remedialteacher/students?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as {
          success: boolean;
          students?: RemedialStudent[];
          error?: string;
        };

        if (!payload.success) {
          throw new Error(payload.error ?? "Failed to load students.");
        }

        const studentsData = Array.isArray(payload.students) ? payload.students : [];

        if (!isCancelled) {
          setSubjectStudents(buildSubjectStudents(studentsData));
          setIsLoading(false);
        }
      } catch (error) {
        if (isCancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        console.error("Failed to load remedial students", error);
        setSubjectStudents(createEmptySubjectStudents());
        setLoadError(error instanceof Error ? error.message : "Failed to load students.");
        setIsLoading(false);
      }
    };

    loadStudents();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [userId]);

  const students = subjectStudents[subject];

  const setStudents = useCallback(
    (value: SetStateAction<any[]>) => {
      setSubjectStudents((prev) => {
        const current = prev[subject];
        const next = typeof value === "function" ? value(current) : value;
        if (next === current) {
          return prev;
        }
        return {
          ...prev,
          [subject]: next,
        };
      });
    },
    [subject]
  );

  const handleSubjectChange = useCallback(
    (nextLabel: string) => {
      const nextSubject = SUBJECT_OPTIONS.find((option) => option.label === nextLabel)?.value ?? "english";
      if (nextSubject !== subject) {
        router.push(`/MasterTeacher/RemedialTeacher/students/${nextSubject}`);
      }
    },
    [router, subject]
  );

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
                <div className="flex flex-row items-center gap-2">
                  <SecondaryHeader title={headerTitle} />
                  <HeaderDropdown
                    options={[...TAB_OPTIONS]}
                    value={activeTab}
                    onChange={setActiveTab}
                    className="pl-0"
                  />
                </div>
                <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
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
              <div
                className="
                /* Mobile */
                mt-4
                
                /* Tablet */
                sm:mt-6
              "
              >
                {isLoading && (
                  <div className="py-12 text-center text-sm text-gray-500">Loading students...</div>
                )}
                {!isLoading && loadError && (
                  <div className="py-12 text-center text-sm text-red-600">{loadError}</div>
                )}
                {!isLoading && !loadError && (
                  <>
                    {activeTab === "Information List" && (
                      <StudentTab students={students} setStudents={setStudents} searchTerm={searchTerm} />
                    )}
                    {activeTab === "Attendance List" && (
                      <AttendanceTab students={students} searchTerm={searchTerm} />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

