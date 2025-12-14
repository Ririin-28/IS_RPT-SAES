import TeacherStudents from "@/modules/Teacher/students/students";

export default async function SubjectStudentsPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  return <TeacherStudents subjectSlug={subject} />;
}
