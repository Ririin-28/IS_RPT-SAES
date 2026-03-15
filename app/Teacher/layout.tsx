import type { ReactNode } from "react";
import HydrationBoundary from "@/components/Common/HydrationBoundary";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return <HydrationBoundary>{children}</HydrationBoundary>;
}
