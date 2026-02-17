
import { NextResponse } from "next/server";
import { getStudentFeatures } from "@/lib/ml/dataset";

export async function GET(
  request: Request,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId } = await params; // Next 15+ needs await
    const features = await getStudentFeatures(studentId);

    if (!features) {
       return NextResponse.json({ success: false, error: "Insufficient data for prediction" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      features // [remedialCount, phonemicLevel, avgScore]
    });
  } catch (error) {
    console.error("Feature Fetch Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch student features." },
      { status: 500 }
    );
  }
}
