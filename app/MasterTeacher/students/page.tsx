"use client";
import Sidebar from "@/components/MasterTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useState } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
// Tabs
import StudentTab from "./Tabs/StudentTab";
import AttendanceTab from "./Tabs/AttendanceTab";

export default function Students() {
  const [activeTab, setActiveTab] = useState("Information List");
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<any[]>([]);

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
        <Header title="Student List" />
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
                <div className="flex items-center gap-0">
                  <SecondaryHeader title="Students" />
                  <HeaderDropdown
                    options={["Information List", "Attendance List"]}
                    value={activeTab}
                    onChange={setActiveTab}
                  />
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
                {activeTab === "Information List" && <StudentTab students={students} setStudents={setStudents} />}
                {activeTab === "Attendance List" && <AttendanceTab students={students} setStudents={setStudents} />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

