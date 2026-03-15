import { NextResponse, type NextRequest } from "next/server";

export type ParsedProfileMutationRequest = {
  body: Record<string, unknown>;
  profileImage: File | null;
  isMultipart: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function parseProfileMutationRequest(
  request: NextRequest,
): Promise<ParsedProfileMutationRequest> {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const body: Record<string, unknown> = {};

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        body[key] = value;
      }
    }

    const rawProfileImage = formData.get("profileImage");
    const profileImage =
      rawProfileImage instanceof File && rawProfileImage.size > 0 ? rawProfileImage : null;

    return { body, profileImage, isMultipart: true };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Error("Invalid request body.");
  }

  if (!isRecord(body)) {
    throw new Error("Invalid request body.");
  }

  return {
    body,
    profileImage: null,
    isMultipart: false,
  };
}

export function resolveAuthorizedProfileUserId(
  userIdParam: string | null,
  authenticatedUserId: number,
): { ok: true; userId: number } | { ok: false; response: NextResponse } {
  if (!userIdParam) {
    return { ok: true, userId: authenticatedUserId };
  }

  const requestedUserId = Number(userIdParam);
  if (!Number.isFinite(requestedUserId) || requestedUserId <= 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Invalid userId value." },
        { status: 400 },
      ),
    };
  }

  if (requestedUserId !== authenticatedUserId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "You are not authorized to access another user's profile." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, userId: authenticatedUserId };
}
