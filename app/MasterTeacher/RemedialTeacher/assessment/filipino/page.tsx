import dynamic from "next/dynamic";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";

const MasterTeacherAssessment = dynamic(() => import("@/modules/MasterTeacher/RemedialTeacher/assessment/assessment"), {
  loading: () => <MasterTeacherPageSkeleton title="Assessment" variant="remedial" />,
});

export default function AssessmentPage() {
  return <MasterTeacherAssessment language="filipino" />;
}
