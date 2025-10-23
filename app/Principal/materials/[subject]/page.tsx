import PrincipalMaterials from "@/modules/Principal/materials/materials";

interface SubjectPageProps {
  params: {
    subject: string;
  };
}

export default function PrincipalMaterialsSubjectPage({ params }: SubjectPageProps) {
  return <PrincipalMaterials subjectSlug={params.subject} />;
}
