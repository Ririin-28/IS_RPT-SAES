import { NextRequest, NextResponse } from "next/server";

const ROLE_TO_SEGMENT: Record<string, string> = {
  admin: "it_admin",
  principal: "principal",
  master_teacher: "masterteacher",
  masterteacher: "masterteacher",
  teacher: "teachers",
  teachers: "teachers",
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const roleRaw = searchParams.get("role");

  if (!roleRaw) {
    return NextResponse.json({ error: "Missing required role query parameter." }, { status: 400 });
  }

  const roleKey = roleRaw.trim().toLowerCase();
  const segment = ROLE_TO_SEGMENT[roleKey];

  if (!segment) {
    return NextResponse.json({ error: `Unsupported role '${roleRaw}'.` }, { status: 400 });
  }

  const forwardedParams = new URLSearchParams(searchParams);
  forwardedParams.delete("role");

  const targetUrl = new URL(`/api/it_admin/accounts/${segment}`, request.nextUrl.origin);
  if (forwardedParams.size > 0) {
    targetUrl.search = forwardedParams.toString();
  }

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const body = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorPayload = typeof body === "object" && body !== null ? body : { error: String(body) };
      return NextResponse.json(errorPayload, { status: response.status });
    }

    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    console.error("Failed to proxy account request", error);
    return NextResponse.json({ error: "Failed to fetch accounts." }, { status: 500 });
  }
}
