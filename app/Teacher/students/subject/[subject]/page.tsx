import dynamic from "next/dynamic";
import TeacherPageSkeleton from "@/components/Teacher/TeacherPageSkeleton";

const TeacherStudents = dynamic(() => import("@/modules/Teacher/students/students"), {
  loading: () => <TeacherPageSkeleton title="Student List" />,
});

export default async function SubjectStudentsPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  return <TeacherStudents subjectSlug={subject} />;
}
