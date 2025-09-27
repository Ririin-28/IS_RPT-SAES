"use client";
import Sidebar from "@/components/Principal/Sidebar";
import PrincipalHeader from "@/components/Principal/Header";
import { useState } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";
// Teacher Tabs
import TeacherAllGradesTab from "./TeacherTab/AllGradesTab";
import TeacherGradeOneTab from "./TeacherTab/GradeOneTab";
import TeacherGradeTwoTab from "./TeacherTab/GradeTwoTab";
import TeacherGradeThreeTab from "./TeacherTab/GradeThreeTab";
import TeacherGradeFourTab from "./TeacherTab/GradeFourTab";
import TeacherGradeFiveTab from "./TeacherTab/GradeFiveTab";
import TeacherGradeSixTab from "./TeacherTab/GradeSixTab";
// Master Teacher Tabs
import MasterTeacherAllGradesTab from "./MasterTeacherTab/AllGradesTab";
import MasterTeacherGradeOneTab from "./MasterTeacherTab/GradeOneTab";
import MasterTeacherGradeTwoTab from "./MasterTeacherTab/GradeTwoTab";
import MasterTeacherGradeThreeTab from "./MasterTeacherTab/GradeThreeTab";
import MasterTeacherGradeFourTab from "./MasterTeacherTab/GradeFourTab";
import MasterTeacherGradeFiveTab from "./MasterTeacherTab/GradeFiveTab";
import MasterTeacherGradeSixTab from "./MasterTeacherTab/GradeSixTab";


export default function PrincipalTeachers() {
  const [activeTab, setActiveTab] = useState("All Grades");
  const [teacherType, setTeacherType] = useState("Master Teachers");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <PrincipalHeader title="Teachers" />
        <main className="flex-1">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex items-center gap-0">
                  <HeaderDropdown
                    options={["Master Teachers", "Teachers"]}
                    value={teacherType}
                    onChange={setTeacherType}
                  />
                  <SecondaryHeader title="in" />
                  <HeaderDropdown
                    options={["All Grades", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"]}
                    value={activeTab}
                    onChange={setActiveTab}
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
              
              {/*---------------------------------Tab Content---------------------------------*/}
              <div className="mt-4 sm:mt-6">
                {teacherType === "Master Teachers" && (
                  <>
                    {activeTab === "All Grades" && <MasterTeacherAllGradesTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
                    {activeTab === "Grade 1" && <MasterTeacherGradeOneTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
                    {activeTab === "Grade 2" && <MasterTeacherGradeTwoTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
                    {activeTab === "Grade 3" && <MasterTeacherGradeThreeTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
                    {activeTab === "Grade 4" && <MasterTeacherGradeFourTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
                    {activeTab === "Grade 5" && <MasterTeacherGradeFiveTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
                    {activeTab === "Grade 6" && <MasterTeacherGradeSixTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
                  </>
                )}
                {teacherType === "Teachers" && (
                  <>
                    {activeTab === "All Grades" && <TeacherAllGradesTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
                    {activeTab === "Grade 1" && <TeacherGradeOneTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
                    {activeTab === "Grade 2" && <TeacherGradeTwoTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
                    {activeTab === "Grade 3" && <TeacherGradeThreeTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
                    {activeTab === "Grade 4" && <TeacherGradeFourTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
                    {activeTab === "Grade 5" && <TeacherGradeFiveTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
                    {activeTab === "Grade 6" && <TeacherGradeSixTab teachers={teachers} setTeachers={setTeachers} searchTerm={searchTerm} />}
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