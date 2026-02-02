import { getStudentDetails, getStudentPerformance } from "@/lib/performance";
import PerformancePage from "@/modules/Teacher/students/PerformancePage";

export default async function Page({ params }: { params: { studentId: string } }) {
  const student = await getStudentDetails(params.studentId);
  const performance = await getStudentPerformance(params.studentId);
  
  return <PerformancePage student={student} performance={performance} />;
}
