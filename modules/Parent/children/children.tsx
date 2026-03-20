"use client";
import ParentHeader from "@/components/Parent/Header";
import ParentSidebar from "@/components/Parent/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TableList from "@/components/Common/Tables/TableList";

const children = [
  { name: "Juan Dela Cruz", id: "S001", grade: "3", status: "Improving", report: "Math: 85, English: 80" },
  { name: "Maria Santos", id: "S002", grade: "3", status: "Consistent", report: "Math: 90, English: 88" },
];

export default function ParentChildren() {
  return (
    <div className="relative flex h-screen overflow-hidden bg-[#F4FBF4]">
      <ParentSidebar />
      <div className="relative z-10 flex-1 pt-24 flex flex-col overflow-hidden">
        <ParentHeader title="Children Profile & Report" offsetForSidebar />
        <main className="flex-1 overflow-y-auto pb-28 lg:pb-0">
          <div className="mx-auto h-full w-full max-w-7xl p-3 sm:p-5 md:p-6">
            <div className="relative h-full min-h-[400px] rounded-[24px] border border-[#DCE6DD] bg-white p-5 shadow-sm sm:p-6 md:p-8">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6A816F]">Directory</p>
                  <SecondaryHeader title="Children Profile" />
                </div>
                <p className="max-w-xl text-sm leading-6 text-[#5A6E5E]">
                  View linked children and their summary progress records in a cleaner parent-friendly table.
                </p>
              </div>
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
