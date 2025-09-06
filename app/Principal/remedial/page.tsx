"use client";
import PrincipalHeader from "@/components/Principal/Header";
import PrincipalSidebar from "@/components/Principal/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import TableList from "@/components/Common/Tables/TableList";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";

const students = [
  { name: "Juan Dela Cruz", id: "S001", grade: "3", subject: "Math", teacher: "Mr. Santos", preTest: 60, postTest: 85, attendance: "95%" },
  { name: "Maria Santos", id: "S002", grade: "3", subject: "English", teacher: "Ms. Reyes", preTest: 55, postTest: 80, attendance: "90%" },
];

const teachers = [
  { name: "Mr. Santos", group: "Grade 3 Math" },
  { name: "Ms. Reyes", group: "Grade 3 English" },
];

export default function PrincipalRemedial() {
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <PrincipalSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <PrincipalHeader title="Remedial Tracking" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <SecondaryHeader title="Remedial Class Tracking" />
              <div className="mt-6">
                <TertiaryHeader title="Student List" />
                {/* TODO: Add filter/search UI */}
                <TableList
                  columns={[
                    { key: "name", title: "Name" },
                    { key: "id", title: "Student ID" },
                    { key: "grade", title: "Grade" },
                    { key: "subject", title: "Subject" },
                    { key: "teacher", title: "Teacher" },
                    { key: "preTest", title: "Pre-test Score" },
                    { key: "postTest", title: "Post-test Score" },
                    { key: "attendance", title: "Attendance" },
                  ]}
                  data={students}
                  actions={(row: any) => (
                    <UtilityButton small>View</UtilityButton>
                  )}
                  pageSize={10}
                />
              </div>
              <div className="mt-8">
                <TertiaryHeader title="Teacher Assignments" />
                <TableList
                  columns={[
                    { key: "name", title: "Teacher" },
                    { key: "group", title: "Remedial Group" },
                  ]}
                  data={teachers}
                  pageSize={5}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
