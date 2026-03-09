"use client";

import IndividualProgressView, { type IndividualProgressViewProps } from "@/components/Common/Report/IndividualProgressView";
import Header from "@/components/Teacher/Header";
import Sidebar from "@/components/Teacher/Sidebar";

type PerformanceTabProps = Omit<IndividualProgressViewProps, "SidebarComponent" | "HeaderComponent">;

export default function PerformanceTab(props: PerformanceTabProps) {
  return <IndividualProgressView {...props} SidebarComponent={Sidebar} HeaderComponent={Header} />;
}
