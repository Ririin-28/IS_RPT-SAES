"use client";
import Sidebar from "@/components/Principal/Sidebar";
import PrincipalHeader from "@/components/Principal/Header";
import { useEffect, useState } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { useMemo } from "react";
import { FaTimes } from "react-icons/fa";
// Tabs
import AllGradesTab from "./Tabs/AllGradesTab";

const GRADE_OPTIONS = ["All Grades", "1", "2", "3", "4", "5", "6"] as const;

const normalizeGradeTab = (value: string): string => {
  if (value === "All Grades") return "All Grades";
  return GRADE_OPTIONS.includes(value as typeof GRADE_OPTIONS[number]) ? value : "All Grades";
};

export default function PrincipalStudents() {
  const [activeTab, setActiveTab] = useState<string>("All Grades");
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStudents() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/principal/students", { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to load students (status ${response.status})`);
        }

        const data = await response.json();
        if (controller.signal.aborted) {
          return;
        }

        setStudents(Array.isArray(data?.students) ? data.students : []);
        setError(null);
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError" || controller.signal.aborted) {
          return;
        }
        console.error("Failed to load principal students", err);
        setError("Unable to load students. Please try again later.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadStudents();

    return () => {
      controller.abort();
    };
  }, []);

  const gradeOptions = useMemo(() => [...GRADE_OPTIONS], []);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <PrincipalHeader title="Students" />
        <main className="flex-1">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="flex items-center gap-0">
                  <SecondaryHeader title="Students in" />
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
              
              {error && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              {!error && isLoading && (
                <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  Loading students…
                </div>
              )}

              <div className="mt-4 sm:mt-6">
                <AllGradesTab
                  students={students}
                  setStudents={setStudents}
                  searchTerm={searchTerm}
                  gradeFilter={activeTab}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}