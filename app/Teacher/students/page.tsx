"use client";
import TeacherSidebar from "@/components/Teacher/Sidebar";
import TeacherHeader from "@/components/Teacher/Header";
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
import StudentTab from "./Tabs/StudentTab";
import AttendanceTab from "./Tabs/AttendanceTab";

export default function Students() {
  const [activeTab, setActiveTab] = useState("Student");
  const [students, setStudents] = useState<any[]>([]);
  return (
    <div
      className="
      /* Mobile */
      flex h-screen bg-white overflow-hidden
    "
    >
      {/*---------------------------------Sidebar---------------------------------*/}
      <TeacherSidebar />
      {/*---------------------------------Main Content---------------------------------*/}
      <div
        className="
        /* Mobile */
        flex-1 pt-16 flex flex-col overflow-hidden
      "
      >
        <TeacherHeader title="Student List" />
        <main className="flex-1 overflow-y-auto">
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
                  {["Student", "Attendance"].map((tab) => (
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
                {activeTab === "Student" && <StudentTab students={students} setStudents={setStudents} />}
                {activeTab === "Attendance" && <AttendanceTab students={students} setStudents={setStudents} />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


