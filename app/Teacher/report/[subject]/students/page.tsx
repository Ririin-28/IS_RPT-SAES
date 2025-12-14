import StudentCardsGrid from "@/modules/Teacher/report/StudentCardsGrid";
import { normalizeSubject } from "@/app/api/auth/teacher/report/subject-config";

export default async function TeacherStudentCardsPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  const normalizedSubject = normalizeSubject(subject);
  return <StudentCardsGrid subject={normalizedSubject} />;
}
