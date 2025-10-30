import StudentCardsGrid from "@/modules/Teacher/report/StudentCardsGrid";
import { normalizeSubject } from "@/app/api/auth/teacher/report/subject-config";

export default function TeacherStudentCardsPage({ params }: { params: { subject: string } }) {
  const subject = normalizeSubject(params.subject);
  return <StudentCardsGrid subject={subject} />;
}
