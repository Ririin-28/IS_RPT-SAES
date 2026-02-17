"use server";

import { generateAiInsight, SessionMetrics } from "@/lib/ml/insights";

export async function getAiInsightsAction(
  studentId: string,
  metrics: SessionMetrics,
  studentName: string,
  subject: string
) {
  try {
    const validSubject = ["English", "Filipino", "Math"].includes(subject) 
      ? (subject as "English" | "Filipino" | "Math") 
      : "English";
      
    const insight = await generateAiInsight(studentId, metrics, studentName, validSubject);
    return { success: true, insight };
  } catch (error) {
    console.error("Failed to generate AI insights:", error);
    return { success: false, error: "Failed to generate AI insights." };
  }
}
