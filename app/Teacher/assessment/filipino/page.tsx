import dynamic from "next/dynamic";
import TeacherPageSkeleton from "@/components/Teacher/TeacherPageSkeleton";

const TeacherAssessment = dynamic(() => import("@/modules/Teacher/assessment/assessment"), {
  loading: () => <TeacherPageSkeleton title="Assessment" />,
});

export default function FilipinoAssessmentPage() {
	return <TeacherAssessment language="filipino" />;
}
