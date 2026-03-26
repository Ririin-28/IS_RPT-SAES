import dynamic from "next/dynamic";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";

const MasterTeacherTeachers = dynamic(() => import("@/modules/MasterTeacher/Coordinator/teachers/teachers"), {
  loading: () => <MasterTeacherPageSkeleton title="Teachers" variant="coordinator" />,
});

export default function Teachers() {
  return <MasterTeacherTeachers />;
}
