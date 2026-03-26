"use client";

import MasterTeacherHeader from "@/components/MasterTeacher/Header";
import CoordinatorSidebar from "@/components/MasterTeacher/Coordinator/Sidebar";
import RemedialTeacherSidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import { TeacherMainContainerSkeletonContent } from "@/components/Teacher/TeacherPageSkeleton";

type MasterTeacherPageSkeletonProps = {
  title: string;
  variant: "coordinator" | "remedial";
};

export function MasterTeacherMainContainerSkeletonContent({ className = "" }: { className?: string }) {
  return <TeacherMainContainerSkeletonContent className={className} />;
}

export default function MasterTeacherPageSkeleton({ title, variant }: MasterTeacherPageSkeletonProps) {
  const Sidebar = variant === "coordinator" ? CoordinatorSidebar : RemedialTeacherSidebar;

  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      <Sidebar />

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden pt-16">
        <MasterTeacherHeader title={title} />

        <main className="flex-1 overflow-y-auto">
          <div className="h-full p-4 sm:p-5 md:p-6">
            <div className="relative z-10 h-full min-h-100 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
              <MasterTeacherMainContainerSkeletonContent />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
