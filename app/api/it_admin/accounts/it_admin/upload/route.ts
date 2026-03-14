import { NextRequest, NextResponse } from "next/server";
import {
  type AccountCredentialEmailDelivery,
  deliverAccountCredentialEmail,
} from "@/lib/server/account-credential-email";
import {
  HttpError,
  createItAdmin,
  sanitizeEmail,
  sanitizeNamePart,
  sanitizeOptionalNamePart,
  sanitizePhoneNumber,
} from "../validation/validation";
import { requireItAdmin } from "@/lib/server/it-admin-auth";

export const dynamic = "force-dynamic";

interface UploadResultItem {
  index: number;
  userId: number;
  record: any;
  credentialEmail: AccountCredentialEmailDelivery;
}

interface UploadFailureItem {
  index: number;
  email: string | null;
  error: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:accounts.manage" });
  if (!auth.ok) {
    return auth.response;
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const admins: unknown = payload?.admins ?? payload?.records ?? payload?.items;
  if (!Array.isArray(admins) || admins.length === 0) {
    return NextResponse.json({ error: "Payload must include a non-empty 'admins' array." }, { status: 400 });
  }

  const inserted: UploadResultItem[] = [];
  const failures: UploadFailureItem[] = [];
  const createdAccounts: Array<{
    index: number;
    userId: number;
    record: any;
    temporaryPassword: string;
  }> = [];

  for (let index = 0; index < admins.length; index += 1) {
    const item = admins[index];
    try {
      const firstName = sanitizeNamePart(item?.firstName, "First name");
      const middleName = sanitizeOptionalNamePart(item?.middleName);
      const lastName = sanitizeNamePart(item?.lastName, "Last name");
      const email = sanitizeEmail(item?.email);
      const phoneNumber = sanitizePhoneNumber(item?.phoneNumber ?? "");

      const suffix = sanitizeOptionalNamePart(item?.suffix);

      const result = await createItAdmin({
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
        credentialEmail: { sent: true, error: null },
      });
      createdAccounts.push({
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
      console.error("Failed to import IT Admin", error);
      failures.push({ index, email: normalizedEmail, error: "Unexpected error while importing." });
    }
  }

  if (createdAccounts.length > 0) {
    const emailResults = await Promise.all(
      createdAccounts.map((entry) =>
        deliverAccountCredentialEmail({
          email: entry.record.email,
          recipientName: entry.record.name,
          roleLabel: "IT Admin",
          temporaryPassword: entry.temporaryPassword,
          secondaryCredentialLabel: "IT Admin ID",
          secondaryCredentialValue: entry.record.adminId,
        }),
      ),
    );

    inserted.forEach((entry, index) => {
      entry.credentialEmail = emailResults[index] ?? { sent: false, error: "Unable to send credential email." };
    });
  }

  const hasInserted = inserted.length > 0;
  const hasFailures = failures.length > 0;

  let statusCode = 200;
  if (!hasInserted && !hasFailures) {
    statusCode = 400;
  }

  const errorMessage = !hasInserted && hasFailures ? "All rows failed validation." : undefined;

  return NextResponse.json(
    {
      success: hasInserted && !hasFailures,
      inserted,
      failures,
      error: errorMessage,
    },
    { status: statusCode },
  );
}
