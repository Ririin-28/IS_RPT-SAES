"use client";
import TeacherSidebar from "@/components/Teacher/Sidebar";
import TeacherHeader from "@/components/Teacher/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import EnglishStudentTab from "./EnglishTabs/StudentTab";
import EnglishAttendanceTab from "./EnglishTabs/AttendanceTab";
import FilipinoStudentTab from "./FilipinoTabs/StudentTab";
import FilipinoAttendanceTab from "./FilipinoTabs/AttendanceTab";
import MathStudentTab from "./MathTabs/StudentTab";
import MathAttendanceTab from "./MathTabs/AttendanceTab";

type SubjectKey = "english" | "filipino" | "math";

type StudentTabProps = {
  students: any[];
  setStudents: Dispatch<SetStateAction<any[]>>;
  searchTerm: string;
};

type SubjectConfig = {
  label: string;
  headerTitle: string;
  StudentTab: ComponentType<StudentTabProps>;
  AttendanceTab: ComponentType<StudentTabProps>;
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

type TeacherStudentsProps = {
  subjectSlug?: string;
};

export default function TeacherStudents({ subjectSlug }: TeacherStudentsProps = {}) {
  const router = useRouter();
  const subject = useMemo(() => normalizeSubject(subjectSlug), [subjectSlug]);
  const { label: subjectLabel, headerTitle, StudentTab, AttendanceTab } = SUBJECT_CONFIG[subject];

  const [subjectStudents, setSubjectStudents] = useState<Record<SubjectKey, any[]>>({
    english: [],
    filipino: [],
    math: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>(TAB_OPTIONS[0]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setActiveTab(TAB_OPTIONS[0]);
    setSearchTerm("");
  }, [subject]);

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
        router.push(`/Teacher/students/subject/${nextSubject}`);
      }
    },
    [router, subject]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadStudents() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const profile = getStoredUserProfile();
        const userId = profile?.userId;

        if (!userId) {
          throw new Error("Missing user information. Please log in again.");
        }

        const response = await fetch(
          `/api/teacher/students?userId=${encodeURIComponent(String(userId))}&subject=${subject}`,
          { cache: "no-store" },
        );

        const payload: { success?: boolean; students?: any[]; error?: string } | null = await response
          .json()
          .catch(() => null);

        if (cancelled) return;

        if (!response.ok || !payload?.success || !Array.isArray(payload.students)) {
          const message = payload?.error ?? "Unable to load students.";
          throw new Error(message);
        }

        setSubjectStudents((prev) => ({
          ...prev,
          [subject]: payload.students ?? [],
        }));
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load students.";
        setLoadError(message);
        setSubjectStudents((prev) => ({ ...prev, [subject]: [] }));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadStudents();

    return () => {
      cancelled = true;
    };
  }, [subject]);

  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      <TeacherSidebar />

      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <TeacherHeader title={`Student List`} />
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
            <div className="relative z-10 h-full min-h-100 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-5 md:p-6">
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
                      onChange={(event) => setSearchTerm(event.target.value)}
                    />
                    {searchTerm && (
                      <button
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setSearchTerm("")}
                        type="button"
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {isLoading && (
                <div className="mt-3 text-sm text-gray-600">Loading students…</div>
              )}
              {loadError && (
                <div className="mt-3 text-sm text-red-600">{loadError}</div>
              )}

              <div
                className="
                /* Mobile */
                mt-4
                
                /* Tablet */
                sm:mt-6
              "
              >
                {activeTab === "Information List" && (
                  <StudentTab students={students} setStudents={setStudents} searchTerm={searchTerm} />
                )}
                {activeTab === "Attendance List" && (
                  <AttendanceTab students={students} setStudents={setStudents} searchTerm={searchTerm} />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

