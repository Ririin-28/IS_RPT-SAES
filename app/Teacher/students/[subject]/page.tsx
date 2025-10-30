import TeacherStudents from "@/modules/Teacher/students/students";

export default function SubjectStudentsPage({ params }: { params: { subject: string } }) {
  return <TeacherStudents subjectSlug={params.subject} />;
}
