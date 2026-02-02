import { getRemedialSessionTimeline, getStudentDetails } from "@/lib/performance";
import PerformanceTab from "@/modules/MasterTeacher/RemedialTeacher/report/PerformanceTab";
import { SUBJECT_CONFIG, normalizeSubject } from "@/app/api/auth/master_teacher/report/subject-config";

const toSubjectName = (subject: ReturnType<typeof normalizeSubject>) => {
  if (subject === "filipino") return "Filipino";
  if (subject === "math") return "Math";
  return "English";
};

export default async function MasterTeacherReportPerformancePage({
  params,
}: {
  params: Promise<{ subject: string; studentId: string }>;
}) {
  const { subject, studentId } = await params;
  const normalizedSubject = normalizeSubject(subject);
  const subjectLabel = SUBJECT_CONFIG[normalizedSubject].subjectLabel;

  const [student, sessions] = await Promise.all([
    getStudentDetails(studentId),
    getRemedialSessionTimeline(studentId, { subjectName: toSubjectName(normalizedSubject) }),
  ]);

  return (
    <PerformanceTab
      student={student}
      sessions={sessions}
      subjectLabel={subjectLabel}
      backHref={`/MasterTeacher/RemedialTeacher/report/${normalizedSubject}/students`}
    />
  );
}
