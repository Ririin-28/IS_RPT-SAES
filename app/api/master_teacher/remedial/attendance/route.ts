import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const targetUrl = new URL(
    `/api/master_teacher/remedialteacher/attendance${url.search}`,
    url.origin
  );

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: request.headers,
      cache: "no-store",
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Fetch attendance error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch attendance records." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const url = new URL(request.url);
  const targetUrl = new URL(
    `/api/master_teacher/remedialteacher/attendance`,
    url.origin
  );

  try {
    const body = await request.json();
    const cookie = request.headers.get("cookie");
    const forwardedHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (cookie) {
      forwardedHeaders.cookie = cookie;
    }
    const response = await fetch(targetUrl, {
      method: "PUT",
      headers: forwardedHeaders,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Save attendance error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save attendance." },
      { status: 500 }
    );
  }
}
