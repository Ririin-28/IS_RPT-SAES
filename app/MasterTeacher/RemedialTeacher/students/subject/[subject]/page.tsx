import dynamic from "next/dynamic";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";

const MasterTeacherStudents = dynamic(() => import("@/modules/MasterTeacher/RemedialTeacher/students/students"), {
  loading: () => <MasterTeacherPageSkeleton title="Student List" variant="remedial" />,
});

export default async function SubjectStudentsPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  return <MasterTeacherStudents subjectSlug={subject} />;
}
