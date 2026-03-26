import dynamic from "next/dynamic";
import TeacherPageSkeleton from "@/components/Teacher/TeacherPageSkeleton";

const TeacherRemedial = dynamic(() => import("@/modules/Teacher/remedial/remedial"), {
  loading: () => <TeacherPageSkeleton title="Remedial" />,
});

export default function Remedial() {
  return <TeacherRemedial />;
}
