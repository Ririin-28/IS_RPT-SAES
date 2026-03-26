import dynamic from "next/dynamic";
import TeacherPageSkeleton from "@/components/Teacher/TeacherPageSkeleton";

const TeacherReport = dynamic(() => import("@/modules/Teacher/report/report"), {
  loading: () => <TeacherPageSkeleton title="Report" />,
});

export default async function SubjectReportPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;
  return <TeacherReport subjectSlug={subject} />;
}
