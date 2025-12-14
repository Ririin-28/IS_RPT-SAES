import TeacherReport from "@/modules/Teacher/report/report";

export default async function SubjectReportPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  return <TeacherReport subjectSlug={subject} />;
}
