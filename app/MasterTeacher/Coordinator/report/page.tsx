import dynamic from "next/dynamic";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";

const MasterTeacherReport = dynamic(() => import("@/modules/MasterTeacher/RemedialTeacher/report/report"), {
  loading: () => <MasterTeacherPageSkeleton title="Report" variant="remedial" />,
});

export default function Report() {
  return <MasterTeacherReport />;
}
