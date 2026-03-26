import dynamic from "next/dynamic";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";

const MasterTeacherRemedial = dynamic(() => import("@/modules/MasterTeacher/RemedialTeacher/remedial/remedial"), {
  loading: () => <MasterTeacherPageSkeleton title="Remedial" variant="remedial" />,
});

export default function FilipinoRemedialPage() {
  return <MasterTeacherRemedial />;
}
