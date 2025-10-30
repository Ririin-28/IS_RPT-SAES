import TeacherReport from "@/modules/Teacher/report/report";

export default function SubjectReportPage({ params }: { params: { subject: string } }) {
  return <TeacherReport subjectSlug={params.subject} />;
}
