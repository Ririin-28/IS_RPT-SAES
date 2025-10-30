import MasterTeacherStudents from "@/modules/MasterTeacher/RemedialTeacher/students/students";

type MasterTeacherStudentsSubjectPageProps = {
  params: {
    subject: string;
  };
};

export default function MasterTeacherStudentsSubjectPage({ params }: MasterTeacherStudentsSubjectPageProps) {
  return <MasterTeacherStudents subjectSlug={params.subject} />;
}
