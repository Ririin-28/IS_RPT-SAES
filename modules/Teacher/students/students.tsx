"use client";
import TeacherSidebar from "@/components/Teacher/Sidebar";
import TeacherHeader from "@/components/Teacher/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";
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
        router.push(`/Teacher/students/${nextSubject}`);
      }
    },
    [router, subject]
  );

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <TeacherSidebar />

      <div
        className="
        /* Mobile */
        flex-1 pt-16 flex flex-col overflow-hidden      
      "
      >
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
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

