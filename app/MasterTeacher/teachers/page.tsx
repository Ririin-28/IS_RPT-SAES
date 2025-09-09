"use client";
import Sidebar from "@/components/MasterTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useState } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
// Tabs
import TeacherTab from "./Tabs/TeacherTab";
import AttendanceTab from "./Tabs/AttendanceTab";

export default function Teachers() {
  const [activeTab, setActiveTab] = useState("Information List");
  // Lifted teachers state so both tabs share the same data
  const [teachers, setTeachers] = useState<any[]>([]);

  return (
    <div
      className="
      /* Mobile */
      flex h-screen bg-white overflow-hidden
    "
    >
      {/*---------------------------------Sidebar---------------------------------*/}
      <Sidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div
        className="
        /* Mobile */
        flex-1 pt-16 flex flex-col overflow-hidden
      "
      >
        <Header title="Teacher List" />
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
                  <SecondaryHeader title="Teachers" />
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
                {activeTab === "Information List" && <TeacherTab teachers={teachers} setTeachers={setTeachers} />}
                {activeTab === "Attendance List" && <AttendanceTab teachers={teachers} />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


