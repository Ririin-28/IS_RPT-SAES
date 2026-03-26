import dynamic from "next/dynamic";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";

const MasterTeacherStudents = dynamic(() => import("@/modules/MasterTeacher/Coordinator/students/students"), {
  loading: () => <MasterTeacherPageSkeleton title="Student List" variant="coordinator" />,
});

export default function StudentsPage() {
  return <MasterTeacherStudents />;
}
