import PrincipalReports from "@/modules/Principal/reports/reports";

interface ReportsPageProps {
  params: {
    subject?: string;
  };
}

export default function ReportsBySubject({ params }: ReportsPageProps) {
  return <PrincipalReports subjectSlug={params.subject} />;
}
