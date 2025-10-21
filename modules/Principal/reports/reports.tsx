"use client";
import Sidebar from "@/components/Principal/Sidebar";
import PrincipalHeader from "@/components/Principal/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { useState } from "react";
import { FaTimes } from "react-icons/fa";
// Tabs
import GradeOneTab from "./Tabs/GradeOneTab";
import GradeTwoTab from "./Tabs/GradeTwoTab";
import GradeThreeTab from "./Tabs/GradeThreeTab";
import GradeFourTab from "./Tabs/GradeFourTab";
import GradeFiveTab from "./Tabs/GradeFiveTab";
import GradeSixTab from "./Tabs/GradeSixTab";

const GRADE_OPTIONS = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
];

const MONTH_OPTIONS = [
  "Monthly",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function PrincipalReports() {
  const [activeTab, setActiveTab] = useState("Grade 1");
  const [reports, setReports] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("Monthly");
  const [searchTerm, setSearchTerm] = useState("");

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
        <PrincipalHeader title="Progress Reports" />
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                {/* Title and dropdowns aligned to the left */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-0 w-full sm:w-auto">
                  <HeaderDropdown
                    options={MONTH_OPTIONS}
                    value={selectedMonth}
                    onChange={(value) => setSelectedMonth(value)}
                    openOnHover
                  />
                  <SecondaryHeader title="Reports for" />
                  <HeaderDropdown
                    options={GRADE_OPTIONS}
                    value={activeTab}
                    onChange={(value) => setActiveTab(value)}
                    openOnHover
                    className="min-w-[100px]"
                  />
                </div>

                {/* Search bar aligned to the right */}
                <div className="flex gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                  <div className="relative w-full sm:w-72">
                    <input
                      type="text"
                      placeholder="Search teachers..."
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 text-black"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setSearchTerm("")}
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/*---------------------------------Tab Content---------------------------------*/}
              <div>
                {activeTab === "Grade 1" && (
                  <GradeOneTab
                    reports={reports}
                    setReports={setReports}
                    selectedMonth={selectedMonth}
                    searchTerm={searchTerm}
                    onSearchTermChange={(value) => setSearchTerm(value)}
                  />
                )}
                {activeTab === "Grade 2" && (
                  <GradeTwoTab
                    reports={reports}
                    setReports={setReports}
                    selectedMonth={selectedMonth}
                    searchTerm={searchTerm}
                    onSearchTermChange={(value) => setSearchTerm(value)}
                  />
                )}
                {activeTab === "Grade 3" && (
                  <GradeThreeTab
                    reports={reports}
                    setReports={setReports}
                    selectedMonth={selectedMonth}
                    searchTerm={searchTerm}
                    onSearchTermChange={(value) => setSearchTerm(value)}
                  />
                )}
                {activeTab === "Grade 4" && (
                  <GradeFourTab
                    reports={reports}
                    setReports={setReports}
                    selectedMonth={selectedMonth}
                    searchTerm={searchTerm}
                    onSearchTermChange={(value) => setSearchTerm(value)}
                  />
                )}
                {activeTab === "Grade 5" && (
                  <GradeFiveTab
                    reports={reports}
                    setReports={setReports}
                    selectedMonth={selectedMonth}
                    searchTerm={searchTerm}
                    onSearchTermChange={(value) => setSearchTerm(value)}
                  />
                )}
                {activeTab === "Grade 6" && (
                  <GradeSixTab
                    reports={reports}
                    setReports={setReports}
                    selectedMonth={selectedMonth}
                    searchTerm={searchTerm}
                    onSearchTermChange={(value) => setSearchTerm(value)}
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