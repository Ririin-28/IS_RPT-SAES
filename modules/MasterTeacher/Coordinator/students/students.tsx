"use client";
import Sidebar from "@/components/MasterTeacher/Coordinator/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import { FaTimes } from "react-icons/fa";
import { useMemo, useState } from "react";
import StudentTab from "./StudentsTab";
import { useCoordinatorStudents } from "./useCoordinatorStudents";

export default function MasterTeacherStudents() {
  const [searchTerm, setSearchTerm] = useState("");
  const { subject, gradeLevel, students, loading, saving, error, refresh, addStudent, updateStudent, importStudents, deleteStudents } = useCoordinatorStudents();
  const headerTitle = useMemo(() => `${subject} Students Information List`, [subject]);

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
        <Header title={`Student List`} />
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
                <SecondaryHeader title={headerTitle} />
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
              
              {/*---------------------------------Tab Content---------------------------------*/}
              <div className="mt-4 sm:mt-6">
                <StudentTab
                  students={students}
                  searchTerm={searchTerm}
                  subjectLabel={subject}
                  gradeLabel={gradeLevel}
                  loading={loading}
                  saving={saving}
                  error={error}
                  onAddStudent={addStudent}
                  onUpdateStudent={updateStudent}
                  onImportStudents={importStudents}
                  onDeleteStudents={deleteStudents}
                  onRefresh={refresh}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

