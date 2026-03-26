import dynamic from "next/dynamic";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";

const MasterTeacherMaterials = dynamic(() => import("@/modules/MasterTeacher/RemedialTeacher/materials/materials"), {
  loading: () => <MasterTeacherPageSkeleton title="Materials" variant="remedial" />,
});

export default function FilipinoMaterialsPage() {
  return <MasterTeacherMaterials />;
}
