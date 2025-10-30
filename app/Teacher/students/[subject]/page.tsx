import TeacherStudents from "@/modules/Teacher/students/students";

type TeacherStudentsSubjectPageProps = {
  params: {
    subject: string;
  };
};

export default function TeacherStudentsSubjectPage({ params }: TeacherStudentsSubjectPageProps) {
  return <TeacherStudents subjectSlug={params.subject} />;
}
