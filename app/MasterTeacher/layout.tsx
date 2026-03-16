import type { ReactNode } from "react";
import HydrationBoundary from "@/components/Common/HydrationBoundary";

export default function MasterTeacherLayout({ children }: { children: ReactNode }) {
  return <HydrationBoundary>{children}</HydrationBoundary>;
}
