import MasterTeacherStudents from "@/modules/MasterTeacher/RemedialTeacher/students/students";

export default function SubjectStudentsPage({ params }: { params: { subject: string } }) {
  return <MasterTeacherStudents subjectSlug={params.subject} />;
}
