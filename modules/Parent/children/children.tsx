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
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      <ParentSidebar />
      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <ParentHeader title="Children Profile & Report" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="relative h-full min-h-[400px] overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">
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
