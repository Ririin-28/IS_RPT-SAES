"use client";
import Sidebar from "@/components/Principal/Sidebar";
import PrincipalHeader from "@/components/Principal/Header";
import { useState } from "react";
// Button Components
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
// Tabs
import GradeOneTab from "./Tabs/GradeOneTab";
import GradeTwoTab from "./Tabs/GradeTwoTab";
import GradeThreeTab from "./Tabs/GradeThreeTab";
import GradeFourTab from "./Tabs/GradeFourTab";
import GradeFiveTab from "./Tabs/GradeFiveTab";
import GradeSixTab from "./Tabs/GradeSixTab";

export default function Teachers() {
  const [activeTab, setActiveTab] = useState("Grade 1");
  const [teachers, setTeachers] = useState<any[]>([]);

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
        <PrincipalHeader title="Teachers" />
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
              {/*---------------------------------Header Section---------------------------------*/}
              <div
                className="
                /* Mobile */
                flex flex-col gap-4 mb-6
                
                /* Tablet */
                sm:flex-row sm:justify-between sm:items-center sm:gap-3 sm:mb-8
                
                /* Desktop */
                md:mb-10 md:mt-2
              "
              >
                {/* Tabs Navigation */}
                <div
                  className="
                  /* Mobile */
                  flex flex-wrap gap-2
                  
                  /* Tablet */
                  sm:flex-wrap sm:gap-3
                "
                >
                  {["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`
                        /* Mobile */
                        px-3 py-1.5 text-sm rounded-lg font-semibold focus:outline-none 
                        transition-all duration-150 shadow-sm border border-transparent
                        flex-grow text-center
                        
                        /* Tablet */
                        sm:px-4 sm:py-2 sm:text-base sm:flex-grow-0
                        
                        /* Desktop */
                        md:px-5
                        ${
                          activeTab === tab
                            ? "bg-[#013300] text-white shadow-md"
                            : "bg-gray-100 text-[#013300] hover:ring-2 hover:ring-[#013300] hover:scale-[1.03] hover:shadow-md"
                        }
                      `}
                    >
                      {tab}
                    </button>
                  ))}
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
                {activeTab === "Grade 1" && <GradeOneTab teachers={teachers} setTeachers={setTeachers} />}
                {activeTab === "Grade 2" && <GradeTwoTab teachers={teachers} setTeachers={setTeachers} />}
                {activeTab === "Grade 3" && <GradeThreeTab teachers={teachers} setTeachers={setTeachers} />}
                {activeTab === "Grade 4" && <GradeFourTab teachers={teachers} setTeachers={setTeachers} />}
                {activeTab === "Grade 5" && <GradeFiveTab teachers={teachers} setTeachers={setTeachers} />}
                {activeTab === "Grade 6" && <GradeSixTab teachers={teachers} setTeachers={setTeachers} />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

