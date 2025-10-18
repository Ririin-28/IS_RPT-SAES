"use client";
import { useState } from "react";
import ITAdminSidebar from "@/components/IT_Admin/Sidebar";
import ITAdminHeader from "@/components/IT_Admin/Header";
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
// Principal Tab
import PrincipalTab from "./PrincipalTab/PrincipalTab";

export default function ITAdminArchive() {
  const [activeTab, setActiveTab] = useState("All Grades");
  const [accountType, setAccountType] = useState("Master Teachers");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  return (
	<div className="flex h-screen bg-white overflow-hidden">
	  {/*---------------------------------Sidebar---------------------------------*/}
	  <ITAdminSidebar />

	  {/*---------------------------------Main Content---------------------------------*/}
	  <div className="flex-1 pt-16 flex flex-col overflow-hidden">
		<ITAdminHeader title="Archive" />
		<main className="flex-1">
		  <div className="p-4 h-full sm:p-5 md:p-6">
			{/*---------------------------------Main Container---------------------------------*/}
			<div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex items-center gap-0">
                  <HeaderDropdown
                    options={["Principal", "Master Teachers", "Teachers"]}
                    value={accountType}
                    onChange={setAccountType}
                  />
                  {accountType === "Principal" ? (
                    <SecondaryHeader title="Accounts" />
                  ) : (
                    <>
                      <SecondaryHeader title="in" />
                      <HeaderDropdown
                        options={["All Grades", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"]}
                        value={activeTab}
                        onChange={setActiveTab}
                      />
                    </>
                  )}
                </div>
                <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="relative flex-1 sm:flex-initial">
                    <input
                      type="text"
                      placeholder={`Search ${accountType.toLowerCase()}...`}
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
                {accountType === "Principal" && (
                  <PrincipalTab principals={accounts} setPrincipals={setAccounts} searchTerm={searchTerm} />
                )}

                {accountType === "Master Teachers" && (
                  <>
                    {activeTab === "All Grades" && <MasterTeacherAllGradesTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
                    {activeTab === "Grade 1" && <MasterTeacherGradeOneTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
                    {activeTab === "Grade 2" && <MasterTeacherGradeTwoTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
                    {activeTab === "Grade 3" && <MasterTeacherGradeThreeTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
                    {activeTab === "Grade 4" && <MasterTeacherGradeFourTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
                    {activeTab === "Grade 5" && <MasterTeacherGradeFiveTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
                    {activeTab === "Grade 6" && <MasterTeacherGradeSixTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
                  </>
                )}
                
                {accountType === "Teachers" && (
                  <>
                    {activeTab === "All Grades" && <TeacherAllGradesTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
                    {activeTab === "Grade 1" && <TeacherGradeOneTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
                    {activeTab === "Grade 2" && <TeacherGradeTwoTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
                    {activeTab === "Grade 3" && <TeacherGradeThreeTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
                    {activeTab === "Grade 4" && <TeacherGradeFourTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
                    {activeTab === "Grade 5" && <TeacherGradeFiveTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
                    {activeTab === "Grade 6" && <TeacherGradeSixTab teachers={accounts} setTeachers={setAccounts} searchTerm={searchTerm} />}
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
