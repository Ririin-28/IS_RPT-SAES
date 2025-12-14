import PrincipalMaterials from "@/modules/Principal/materials/materials";

interface SubjectPageProps {
  params: Promise<{
    subject: string;
  }>;
}

export default async function PrincipalMaterialsSubjectPage({ params }: SubjectPageProps) {
  const { subject } = await params;
  return <PrincipalMaterials subjectSlug={subject} />;
}
