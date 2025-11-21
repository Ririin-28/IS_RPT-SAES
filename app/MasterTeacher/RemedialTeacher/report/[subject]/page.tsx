import MasterTeacherReport from "@/modules/MasterTeacher/RemedialTeacher/report/report";

export default async function SubjectReportPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  return <MasterTeacherReport subjectSlug={subject} />;
}
