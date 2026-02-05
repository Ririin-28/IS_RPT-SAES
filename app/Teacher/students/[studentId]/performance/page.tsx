import { getStudentDetails, getStudentPerformance } from "@/lib/performance";
import PerformancePage from "@/modules/Teacher/students/PerformancePage";

export default async function Page({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const student = await getStudentDetails(studentId);
  const performance = await getStudentPerformance(studentId);
  
  return <PerformancePage student={student} performance={performance} />;
}
