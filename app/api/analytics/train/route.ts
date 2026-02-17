
import { NextResponse } from "next/server";
import { createAndTrainModel } from "@/lib/ml/model";
// import { auth } from "@/auth"; // If auth is used

export async function GET() {
  try {
    // 1. Verify Admin Permissions (Placeholder)
    // const session = await auth();
    // if (session?.user?.role !== "admin") return new NextResponse("Unauthorized", { status: 401 });

    // 2. Train Model
    const result = await createAndTrainModel();

    return NextResponse.json({
      success: true,
      data: result,
      message: "Model training completed successfully based on historical data."
    });
  } catch (error) {
    console.error("Training Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to train model." },
      { status: 500 }
    );
  }
}
