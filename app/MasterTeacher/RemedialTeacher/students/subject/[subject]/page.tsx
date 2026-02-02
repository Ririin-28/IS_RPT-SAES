import MasterTeacherStudents from "@/modules/MasterTeacher/RemedialTeacher/students/students";

export default async function SubjectStudentsPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  return <MasterTeacherStudents subjectSlug={subject} />;
}
