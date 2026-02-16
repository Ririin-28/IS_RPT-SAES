import { NextRequest, NextResponse } from "next/server";
import {
  HttpError,
  createPrincipal,
  sanitizeEmail,
  sanitizeNamePart,
  sanitizeOptionalNamePart,
  sanitizePhoneNumber,
} from "../validation/validation";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";

export const dynamic = "force-dynamic";

interface UploadResultItem {
  index: number;
  userId: number;
  record: any;
  temporaryPassword: string;
}

interface UploadFailureItem {
  index: number;
  email: string | null;
  error: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:accounts.manage" });
  if (!auth.ok) {
    return auth.response;
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const principals: unknown = payload?.principals ?? payload?.records ?? payload?.items;
  if (!Array.isArray(principals) || principals.length === 0) {
    return NextResponse.json({ error: "Payload must include a non-empty 'principals' array." }, { status: 400 });
  }

  const inserted: UploadResultItem[] = [];
  const failures: UploadFailureItem[] = [];

  for (let index = 0; index < principals.length; index += 1) {
    const item = principals[index];
    try {
      const firstName = sanitizeNamePart(item?.firstName, "First name");
      const middleName = sanitizeOptionalNamePart(item?.middleName);
      const lastName = sanitizeNamePart(item?.lastName, "Last name");
      const email = sanitizeEmail(item?.email);
      const phoneNumber = sanitizePhoneNumber(item?.phoneNumber ?? "");

      const suffix = sanitizeOptionalNamePart(item?.suffix);

      const result = await createPrincipal({
        firstName,
        middleName,
        lastName,
        suffix,
        email,
        phoneNumber,
      });

      inserted.push({
        index,
        userId: result.userId,
        record: result.record,
        temporaryPassword: result.temporaryPassword,
      });
    } catch (error) {
      const normalizedEmail = typeof item?.email === "string" ? item.email : null;
      if (error instanceof HttpError) {
        failures.push({ index, email: normalizedEmail, error: error.message });
        continue;
      }
      console.error("Failed to import Principal", error);
      failures.push({ index, email: normalizedEmail, error: "Unexpected error while importing." });
    }
  }

  const statusCode = inserted.length > 0 ? 200 : 400;

  return NextResponse.json(
    {
      success: inserted.length > 0,
      inserted,
      failures,
    },
    { status: statusCode },
  );
}
