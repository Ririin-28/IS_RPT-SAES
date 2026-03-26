import dynamic from "next/dynamic";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";

const MasterTeacherMaterials = dynamic(() => import("@/modules/MasterTeacher/Coordinator/materials/materials"), {
  loading: () => <MasterTeacherPageSkeleton title="Materials" variant="coordinator" />,
});

export default function Materials() {
  return <MasterTeacherMaterials />;
}
