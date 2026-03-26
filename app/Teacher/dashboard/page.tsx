import dynamic from "next/dynamic";
import TeacherPageSkeleton from "@/components/Teacher/TeacherPageSkeleton";

const TeacherDashboard = dynamic(() => import("@/modules/Teacher/dashboard/dashboard"), {
  loading: () => <TeacherPageSkeleton title="Dashboard" />,
});

export default function Dashboard() {
  return <TeacherDashboard />;
}
