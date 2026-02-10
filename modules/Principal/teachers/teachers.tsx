"use client";
import Sidebar from "@/components/Principal/Sidebar";
import PrincipalHeader from "@/components/Principal/Header";
import { useEffect, useState } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { useMemo } from "react";
import { FaTimes } from "react-icons/fa";
// Teacher Tabs
import TeacherAllGradesTab from "./TeacherTab/AllGradesTab";
// Master Teacher Tabs
import MasterTeacherAllGradesTab from "./MasterTeacherTab/AllGradesTab";


const GRADE_OPTIONS = ["All Grades", "1", "2", "3", "4", "5", "6"] as const;

const normalizeGradeTab = (value: string): string => {
  if (value === "All Grades") return "All Grades";
  return GRADE_OPTIONS.includes(value as typeof GRADE_OPTIONS[number]) ? value : "All Grades";
};

export default function PrincipalTeachers() {
  const [activeTab, setActiveTab] = useState<string>("All Grades");
  const [teacherType, setTeacherType] = useState("Master Teachers");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [masterTeachers, setMasterTeachers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTeachers() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/principal/teachers", { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to load teachers (status ${response.status})`);
        }

        const data = await response.json();
        if (controller.signal.aborted) {
          return;
        }

        setTeachers(Array.isArray(data?.teachers) ? data.teachers : []);
        setMasterTeachers(Array.isArray(data?.masterTeachers) ? data.masterTeachers : []);
        setError(null);
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError" || controller.signal.aborted) {
          return;
        }
        console.error("Failed to load principal teachers", err);
        setError("Unable to load teachers. Please try again later.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadTeachers();

    return () => {
      controller.abort();
    };
  }, []);

  const gradeOptions = useMemo(() => [...GRADE_OPTIONS], []);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <PrincipalHeader title="Teachers" />
        <main className="flex-1">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="flex items-center gap-0">
                  <HeaderDropdown
                    options={[("Master Teachers"), ("Teachers")]}
                    value={teacherType}
                    onChange={setTeacherType}
                  />
                  <SecondaryHeader title="in" />
                  {activeTab !== "All Grades" && (
                    <div className="ml-2">
                      <SecondaryHeader title="Grade" />
                    </div>
                  )}
                  <HeaderDropdown
                    options={gradeOptions as string[]}
                    value={activeTab}
                    onChange={(value) => setActiveTab(normalizeGradeTab(value))}
                    className="pl-2"
                  />
                </div>
                <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="relative flex-1 sm:flex-initial">
                    <input
                      type="text"
                      placeholder="Search teachers..."
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
              
              {error && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              {!error && isLoading && (
                <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  Loading teachers…
                </div>
              )}

              {/*---------------------------------Tab Content---------------------------------*/}
              <div className="mt-4 sm:mt-6">
                {teacherType === "Master Teachers" && (
                  <MasterTeacherAllGradesTab
                    teachers={masterTeachers}
                    setTeachers={setMasterTeachers}
                    searchTerm={searchTerm}
                    gradeFilter={activeTab}
                  />
                )}
                {teacherType === "Teachers" && (
                  <TeacherAllGradesTab
                    teachers={teachers}
                    setTeachers={setTeachers}
                    searchTerm={searchTerm}
                    gradeFilter={activeTab}
                  />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}