import MasterTeacherReport from "@/modules/MasterTeacher/RemedialTeacher/report/report";

interface ReportPageProps {
  params: {
    subject?: string;
  };
}

export default function MasterTeacherReportBySubject({ params }: ReportPageProps) {
  return <MasterTeacherReport subjectSlug={params.subject} />;
}
