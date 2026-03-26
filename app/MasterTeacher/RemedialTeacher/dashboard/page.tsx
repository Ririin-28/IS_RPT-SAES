import dynamic from "next/dynamic";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";

const MasterTeacherDashboard = dynamic(() => import("@/modules/MasterTeacher/RemedialTeacher/dashboard/dashboard"), {
  loading: () => <MasterTeacherPageSkeleton title="Dashboard" variant="remedial" />,
});

export default function Dashboard() {
  return <MasterTeacherDashboard />;
}
