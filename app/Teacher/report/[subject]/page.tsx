import TeacherReport from "@/modules/Teacher/report/report";

interface ReportPageProps {
  params: {
    subject?: string;
  };
}

export default function TeacherReportBySubject({ params }: ReportPageProps) {
  return <TeacherReport subjectSlug={params.subject} />;
}
