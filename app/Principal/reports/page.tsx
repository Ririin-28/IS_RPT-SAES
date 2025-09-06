"use client";
import { useState } from "react";
import PrincipalHeader from "@/components/Principal/Header";
import PrincipalSidebar from "@/components/Principal/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import { FaFileWord } from "react-icons/fa";

type ReportFile = {
  id: number;
  name: string;
  uploadedAt: string;
  teacher: string;
  section: string;
  grade: string;
  url: string;
};

const initialFiles: ReportFile[] = [
  {
    id: 1,
    name: "Math Progress Report Q1",
    uploadedAt: "2024-01-15",
    teacher: "Ms. Johnson",
    section: "A",
    grade: "Grade 1",
    url: "#"
  },
  {
    id: 2,
    name: "Reading Assessment Report",
    uploadedAt: "2024-01-20",
    teacher: "Mr. Smith",
    section: "B",
    grade: "Grade 2",
    url: "#"
  }
];

const teachers = ["All", "Ms. Johnson", "Mr. Smith", "Mrs. Davis"];
const sections = ["All", "A", "B", "C"];
const grades = ["All", "Grade 1", "Grade 2", "Grade 3"];

export default function PrincipalReports() {
  const [files] = useState(initialFiles);
  const [filter, setFilter] = useState({
    date: "",
    teacher: "All",
    section: "All",
    grade: "All",
  });
  const [pendingFilter, setPendingFilter] = useState({
    date: "",
    teacher: "All",
    section: "All",
    grade: "All",
  });

  const filteredFiles = files.filter((file) => {
    const matchDate = filter.date ? file.uploadedAt === filter.date : true;
    const matchTeacher = filter.teacher === "All" || file.teacher === filter.teacher;
    const matchSection = filter.section === "All" || file.section === filter.section;
    const matchGrade = filter.grade === "All" || file.grade === filter.grade;
    return matchDate && matchTeacher && matchSection && matchGrade;
  });

  // Helper to format date with time
  function formatDateTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <PrincipalSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <PrincipalHeader title="Reports" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <SecondaryHeader title="Word Document Reports" />
              
              {/* Filter Bar */}
              <div className="flex flex-wrap gap-6 mb-8 items-end bg-green-50 rounded-lg p-4 shadow-sm border border-green-200">
                <div className="flex flex-col flex-1 min-w-[140px]">
                  <label className="block text-sm font-semibold mb-1 text-black">Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded px-2 py-1 text-black bg-white focus:ring-2 focus:ring-green-200 min-w-[140px] max-w-[180px]"
                    value={filter.date}
                    onChange={(e) => setFilter({ ...filter, date: e.target.value })}
                  />
                </div>
                <div className="flex flex-col flex-1 min-w-[140px]">
                  <label className="block text-sm font-semibold mb-1 text-black">Teacher</label>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-1 text-black bg-white focus:ring-2 focus:ring-green-200 min-w-[140px] max-w-[180px]"
                    value={filter.teacher}
                    onChange={(e) => setFilter({ ...filter, teacher: e.target.value })}
                  >
                    {teachers.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col flex-1 min-w-[140px]">
                  <label className="block text-sm font-semibold mb-1 text-black">Section</label>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-1 text-black bg-white focus:ring-2 focus:ring-green-200 min-w-[140px] max-w-[180px]"
                    value={filter.section}
                    onChange={(e) => setFilter({ ...filter, section: e.target.value })}
                  >
                    {sections.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col flex-1 min-w-[140px]">
                  <label className="block text-sm font-semibold mb-1 text-black">Grade</label>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-1 text-black bg-white focus:ring-2 focus:ring-green-200 min-w-[140px] max-w-[180px]"
                    value={filter.grade}
                    onChange={(e) => setFilter({ ...filter, grade: e.target.value })}
                  >
                    {grades.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>
                {/* Apply Button */}
                <div className="flex flex-col flex-1 min-w-[140px] justify-end">
                  <button
                    className="mt-5 w-full px-2 py-2 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-full shadow transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 min-w-[140px] max-w-[180px]"
                    style={{ minHeight: 38 }}
                    onClick={() => setFilter(pendingFilter)}
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Card grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-gray-50 rounded-2xl shadow hover:shadow-lg transition p-4 flex flex-col items-center border border-gray-200 cursor-pointer min-h-[240px] relative"
                  >
                    <div className="w-full h-24 bg-white rounded-lg flex items-center justify-center mb-3 overflow-hidden border border-gray-100">
                      <FaFileWord className="text-blue-600 text-4xl" />
                    </div>
                    <div className="font-semibold text-center text-black text-base truncate w-full mb-2" title={file.name}>
                      {file.name}
                    </div>
                    <div className="text-xs text-gray-600 space-y-1 w-full">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Teacher:</span> {file.teacher}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Section:</span> {file.section}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Grade:</span> {file.grade}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Date:</span> {formatDateTime(file.uploadedAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}