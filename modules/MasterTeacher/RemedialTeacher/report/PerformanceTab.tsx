"use client";

import IndividualProgressView, { type IndividualProgressViewProps } from "@/components/Common/Report/IndividualProgressView";
import Header from "@/components/MasterTeacher/Header";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";

type PerformanceTabProps = Omit<IndividualProgressViewProps, "SidebarComponent" | "HeaderComponent">;

export default function PerformanceTab(props: PerformanceTabProps) {
  return <IndividualProgressView {...props} SidebarComponent={Sidebar} HeaderComponent={Header} />;
}
