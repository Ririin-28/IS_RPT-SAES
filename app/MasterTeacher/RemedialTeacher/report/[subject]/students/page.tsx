import StudentCardsGrid from "@/modules/MasterTeacher/RemedialTeacher/report/StudentCardsGrid";
import { normalizeSubject } from "@/app/api/auth/master_teacher/report/subject-config";

export default async function StudentCardsPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  const normalizedSubject = normalizeSubject(subject);
  return <StudentCardsGrid subject={normalizedSubject} />;
}
