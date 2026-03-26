import dynamic from "next/dynamic";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";

const MasterTeacherDashboard = dynamic(() => import("@/modules/MasterTeacher/Coordinator/dashboard/dashboard"), {
  loading: () => <MasterTeacherPageSkeleton title="Dashboard" variant="coordinator" />,
});

export default function Dashboard() {
  return <MasterTeacherDashboard />;
}
