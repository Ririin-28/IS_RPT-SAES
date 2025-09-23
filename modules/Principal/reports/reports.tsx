"use client";
import Sidebar from "@/components/Principal/Sidebar";
import PrincipalHeader from "@/components/Principal/Header";
import { useState } from "react";
// Tabs
import GradeOneTab from "./Tabs/GradeOneTab";
import GradeTwoTab from "./Tabs/GradeTwoTab";
import GradeThreeTab from "./Tabs/GradeThreeTab";
import GradeFourTab from "./Tabs/GradeFourTab";
import GradeFiveTab from "./Tabs/GradeFiveTab";
import GradeSixTab from "./Tabs/GradeSixTab";

export default function PrincipalReports() {
  const [activeTab, setActiveTab] = useState("Grade 1");
  const [reports, setReports] = useState<any[]>([]);

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

              {/*---------------------------------Tab Content---------------------------------*/}
              <div>
                {activeTab === "Grade 1" && <GradeOneTab reports={reports} setReports={setReports} activeTab={activeTab} setActiveTab={setActiveTab} />}
                {activeTab === "Grade 2" && <GradeTwoTab reports={reports} setReports={setReports} activeTab={activeTab} setActiveTab={setActiveTab} />}
                {activeTab === "Grade 3" && <GradeThreeTab reports={reports} setReports={setReports} activeTab={activeTab} setActiveTab={setActiveTab} />}
                {activeTab === "Grade 4" && <GradeFourTab reports={reports} setReports={setReports} activeTab={activeTab} setActiveTab={setActiveTab} />}
                {activeTab === "Grade 5" && <GradeFiveTab reports={reports} setReports={setReports} activeTab={activeTab} setActiveTab={setActiveTab} />}
                {activeTab === "Grade 6" && <GradeSixTab reports={reports} setReports={setReports} activeTab={activeTab} setActiveTab={setActiveTab} />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}