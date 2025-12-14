import PrincipalReports from "@/modules/Principal/reports/reports";

interface ReportsPageProps {
  params: Promise<{
    subject?: string;
  }>;
}

export default async function ReportsBySubject({ params }: ReportsPageProps) {
  const resolved = await params;
  return <PrincipalReports subjectSlug={resolved.subject} />;
}
