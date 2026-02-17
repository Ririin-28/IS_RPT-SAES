
import { predictStudentScore } from "@/lib/ml/server-inference";
import { getStudentFeatures } from "@/lib/ml/dataset";

export type SessionMetrics = {
  pronunciationAvg?: number;
  accuracyAvg: number;
  fluencyScore?: number;
  readingSpeedAvg?: number;
  responseTimeAvg?: number;
  overallAverage: number;
  phonemicLevel?: string;
};

export async function generateAiInsight(
  studentId: string, 
  metrics: SessionMetrics,
  studentName?: string,
  subject: "English" | "Filipino" | "Math" = "English"
): Promise<string> {
  const name = studentName?.split(" ")[0] || "The student";
  
  // 1. Get Predictive Context
  const features = await getStudentFeatures(studentId);
  let predictedScore: number | null = null;
  let riskLevel = "Unknown";
  let remedialCount = 0;
  let trend = "stable";

  if (features) {
    remedialCount = features[0];
    // Simple trend heuristic: higher avg than last session?
    // We don't have trend explicitly in features yet, but we can infer from 'avgScore' vs current session.
    const avgHistorical = features[2];
    if (metrics.overallAverage > avgHistorical + 5) trend = "improving";
    else if (metrics.overallAverage < avgHistorical - 5) trend = "declining";
    
    // Server-side Prediction
    const result = await predictStudentScore(features);
    if (result !== null) {
      predictedScore = result;
      riskLevel = result < 75 ? "High" : "Low";
    }
  }

  // 2. Identify Strengths & Weaknesses (Rule-Based + Hybrid)
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (subject === "Math") {
    // Math Specific Analysis
    if (metrics.accuracyAvg >= 85) strengths.push("problem solving accuracy");
    else if (metrics.accuracyAvg < 75) weaknesses.push("calculation accuracy");

    if ((metrics.responseTimeAvg ?? 10) <= 5) strengths.push("speed and efficiency");
    else if ((metrics.responseTimeAvg ?? 0) > 10) weaknesses.push("processing speed");

  } else {
    // English/Filipino (Reading) Analysis
    if ((metrics.pronunciationAvg ?? 0) >= 85) strengths.push("clear pronunciation");
    else if ((metrics.pronunciationAvg ?? 0) < 75) weaknesses.push("pronunciation accuracy");
    
    if (metrics.accuracyAvg >= 85) strengths.push("word recognition");
    else if (metrics.accuracyAvg < 75) weaknesses.push("decoding complex words");

    if ((metrics.readingSpeedAvg ?? 0) >= 100) strengths.push("reading fluency");
    else if ((metrics.readingSpeedAvg ?? 0) < 60) weaknesses.push("reading pace");
  }

  // Trend Analysis
  if (trend === "improving") strengths.push("consistent progress");
  if (trend === "declining") weaknesses.push("recent performance regression");

  // 3. Construct Narrative
  // Intro based on Risk
  let intro = "";
  if (riskLevel === "High") {
    intro = `${name} is currently at risk of falling behind in the upcoming assessment.`;
  } else if (riskLevel === "Low") {
    intro = `${name} is on track to meet proficiency standards.`;
  } else {
    intro = `${name} has completed the session.`;
  }

  // Body: Strengths/Weaknesses
  let body = "";
  if (strengths.length > 0 && weaknesses.length > 0) {
    body = `While ${name} demonstrates strength in ${strengths[0]}, they struggle with ${weaknesses[0]}.`;
  } else if (strengths.length > 0) {
    body = `${name} shows excellent ${strengths.join(" and ")}.`;
  } else if (weaknesses.length > 0) {
    body = `${name} needs significant improvement in ${weaknesses.join(" and ")}.`;
  } else {
    body = "Performance is balanced, with no major outliers.";
  }

  // Recommendation
  let recommendation = "";
  if (subject === "Math") {
    if (weaknesses.includes("processing speed")) {
      recommendation = "We recommend daily timed drills to improve calculation speed.";
    } else if (weaknesses.includes("calculation accuracy")) {
      recommendation = "Review fundamental concepts and practice untimed problems to build accuracy.";
    } else if (riskLevel === "High") {
      recommendation = "Intensive remedial sessions focusing on core headers are advised.";
    } else {
      recommendation = "Continue with the current practice set to maintain proficiency.";
    }
  } else {
    // Reading Recommendations
    if (weaknesses.includes("reading pace")) {
      recommendation = "We recommend timed reading drills to build automaticity.";
    } else if (weaknesses.includes("pronunciation accuracy")) {
      recommendation = "Focus on phonemic segmentation exercises.";
    } else if (riskLevel === "High") {
      recommendation = "Additional remedial sessions are strongly advised to bridge learning gaps.";
    } else {
      recommendation = "Maintain the current practice schedule to reinforce these gains.";
    }
  }
  
  // Improvement Note
  if (trend === "improving") {
    recommendation += " The recent upward trend is encouraging.";
  }

  return `${intro} ${body} ${recommendation}`;
}
