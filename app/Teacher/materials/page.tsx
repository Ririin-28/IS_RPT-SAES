import dynamic from "next/dynamic";
import TeacherPageSkeleton from "@/components/Teacher/TeacherPageSkeleton";

const TeacherMaterials = dynamic(() => import("@/modules/Teacher/materials/materials"), {
  loading: () => <TeacherPageSkeleton title="Materials" />,
});

export default function Materials() {
  return <TeacherMaterials />;
}
