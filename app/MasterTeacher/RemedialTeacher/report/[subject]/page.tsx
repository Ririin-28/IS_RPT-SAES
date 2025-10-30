import MasterTeacherReport from "@/modules/MasterTeacher/RemedialTeacher/report/report";

export default function SubjectReportPage({ params }: { params: { subject: string } }) {
  return <MasterTeacherReport subjectSlug={params.subject} />;
}
