"use client";

import TeacherHeader from "@/components/Teacher/Header";
import TeacherSidebar from "@/components/Teacher/Sidebar";

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const SkeletonBlock = ({ className = "" }: { className?: string }) => (
  <div className={cx("skeleton-shimmer rounded-lg bg-slate-200", className)} />
);

export function TeacherMainContainerSkeletonContent({ className = "" }: { className?: string }) {
  return (
    <div className={cx("flex h-full min-h-0 flex-col gap-4", className)}>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <SkeletonBlock className="h-8 w-48 max-w-full" />
            <SkeletonBlock className="h-4 w-32" />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-10 w-24" />
            <SkeletonBlock className="h-10 w-24" />
            <SkeletonBlock className="h-10 w-10" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div className="flex flex-wrap gap-2">
            <SkeletonBlock className="h-10 w-full sm:w-52" />
            <SkeletonBlock className="h-10 w-36" />
            <SkeletonBlock className="h-10 w-28" />
            <SkeletonBlock className="h-10 w-24" />
            <SkeletonBlock className="h-10 w-10" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-3 w-28" />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-9 w-20" />
            <SkeletonBlock className="h-9 w-20" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <SkeletonBlock className="h-8 w-24" />
          <SkeletonBlock className="h-8 w-28" />
          <SkeletonBlock className="h-8 w-20" />
          <SkeletonBlock className="h-8 w-24" />
        </div>

        <div className="mt-4 flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="space-y-2">
            <SkeletonBlock className="h-5 w-52" />
            <SkeletonBlock className="h-4 w-36" />
          </div>

          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-[96%]" />
              <SkeletonBlock className="h-4 w-[92%]" />
              <SkeletonBlock className="h-4 w-[88%]" />
              <SkeletonBlock className="h-4 w-[64%]" />
            </div>

            <div className="space-y-3">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-[94%]" />
              <SkeletonBlock className="h-4 w-[89%]" />
              <SkeletonBlock className="h-4 w-[83%]" />
              <SkeletonBlock className="h-4 w-[58%]" />
            </div>

            <div className="space-y-3">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-[95%]" />
              <SkeletonBlock className="h-4 w-[91%]" />
              <SkeletonBlock className="h-4 w-[86%]" />
              <SkeletonBlock className="h-4 w-[61%]" />
            </div>

            <div className="space-y-3">
              <SkeletonBlock className="h-4 w-[98%]" />
              <SkeletonBlock className="h-4 w-[84%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type TeacherPageSkeletonProps = {
  title: string;
};

export default function TeacherPageSkeleton({ title }: TeacherPageSkeletonProps) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      <TeacherSidebar />

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden pt-16">
        <TeacherHeader title={title} />

        <main className="flex-1 overflow-y-auto">
          <div className="h-full p-4 sm:p-5 md:p-6">
            <div className="relative z-10 h-full min-h-100 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
              <TeacherMainContainerSkeletonContent />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
