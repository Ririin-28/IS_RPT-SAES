import { NextResponse } from "next/server";
import {
  getStudentPromotionReadiness,
  type PromotionReadiness,
  type SubjectName,
} from "@/lib/students/promote-phonemic";

const SUBJECTS: SubjectName[] = ["English", "Filipino", "Math"];
const SUBJECT_MAP: Record<string, SubjectName> = {
  english: "English",
  filipino: "Filipino",
  math: "Math",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId") ?? searchParams.get("student_id");
    const subjectInput = searchParams.get("subject");
    const currentLevels: Record<SubjectName, string | null> = {
      English: searchParams.get("englishLevel"),
      Filipino: searchParams.get("filipinoLevel"),
      Math: searchParams.get("mathLevel"),
    };

    if (!studentId) {
      return NextResponse.json({ success: false, error: "Student ID is required." }, { status: 400 });
    }

    if (subjectInput) {
      const subject = SUBJECT_MAP[String(subjectInput).trim().toLowerCase()];
      if (!subject) {
        return NextResponse.json({ success: false, error: "Unsupported subject." }, { status: 400 });
      }

      const recommendation = await getStudentPromotionReadiness(String(studentId), subject, {
        currentLevelName: currentLevels[subject],
      });
      return NextResponse.json({ success: true, recommendation });
    }

    const entries = await Promise.all(
      SUBJECTS.map(async (subject) => {
        const recommendation = await getStudentPromotionReadiness(String(studentId), subject, {
          currentLevelName: currentLevels[subject],
        });
        return [subject, recommendation] as const;
      }),
    );

    const recommendations = Object.fromEntries(entries) as Record<SubjectName, PromotionReadiness>;
    return NextResponse.json({ success: true, recommendations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to evaluate promotion readiness.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}