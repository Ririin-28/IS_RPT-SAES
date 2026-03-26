import dynamic from "next/dynamic";
import TeacherPageSkeleton from "@/components/Teacher/TeacherPageSkeleton";

const TeacherReport = dynamic(() => import("@/modules/Teacher/report/report"), {
  loading: () => <TeacherPageSkeleton title="Report" />,
});

export default function Report() {
  return <TeacherReport />;
}
