import StudentTab from "@/modules/MasterTeacher/RemedialTeacher/report/StudentTab";
import { normalizeSubject } from "@/app/api/auth/master_teacher/report/subject-config";

export default async function StudentCardsPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  const normalizedSubject = normalizeSubject(subject);
  return <StudentTab subject={normalizedSubject} />;
}
