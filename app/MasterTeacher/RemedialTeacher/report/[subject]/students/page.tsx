import StudentCardsGrid from "@/modules/MasterTeacher/RemedialTeacher/report/StudentCardsGrid";
import { normalizeSubject } from "@/app/api/auth/master_teacher/report/subject-config";

export default function StudentCardsPage({ params }: { params: { subject: string } }) {
  const subject = normalizeSubject(params.subject);
  return <StudentCardsGrid subject={subject} />;
}
