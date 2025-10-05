"use client";
import ParentHeader from "@/components/Parent/Header";
import ParentSidebar from "@/components/Parent/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import TableList from "@/components/Common/Tables/TableList";

const children = [
  { name: "Juan Dela Cruz", id: "S001", grade: "3", status: "Improving", report: "Math: 85, English: 80" },
  { name: "Maria Santos", id: "S002", grade: "3", status: "Consistent", report: "Math: 90, English: 88" },
];

export default function ParentChildren() {
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <ParentSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <ParentHeader title="Children Profile & Report" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <SecondaryHeader title="Children Profile" />
              <TableList
                columns={[
                  { key: "name", title: "Name" },
                  { key: "id", title: "Student ID" },
                  { key: "grade", title: "Grade" },
                  { key: "status", title: "Progress Status" },
                  { key: "report", title: "Performance Report" },
                ]}
                data={children}
                pageSize={10}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
