import dynamic from "next/dynamic";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";

const MasterTeacherRemedial = dynamic(() => import("@/modules/MasterTeacher/Coordinator/remedial/remedial"), {
  loading: () => <MasterTeacherPageSkeleton title="Remedial" variant="coordinator" />,
});

export default function Remedial() {
  return <MasterTeacherRemedial />;
}
