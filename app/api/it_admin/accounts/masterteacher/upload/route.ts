import { NextRequest, NextResponse } from "next/server";
import {
  HttpError,
  createMasterTeacher,
  sanitizeEmail,
  sanitizeNamePart,
  sanitizeOptionalNamePart,
  sanitizePhoneNumber,
  sanitizeGrade,
  sanitizeOptionalString,
  sanitizeCoordinatorSubject,
} from "../validation/validation";

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
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const teachers: unknown = payload?.teachers ?? payload?.records ?? payload?.items;
  if (!Array.isArray(teachers) || teachers.length === 0) {
    return NextResponse.json({ error: "Payload must include a non-empty 'teachers' array." }, { status: 400 });
  }

  const inserted: UploadResultItem[] = [];
  const failures: UploadFailureItem[] = [];

  for (let index = 0; index < teachers.length; index += 1) {
    const item = teachers[index];
    try {
      const firstName = sanitizeNamePart(item?.firstName, "First name");
      const middleName = sanitizeOptionalNamePart(item?.middleName);
      const lastName = sanitizeNamePart(item?.lastName, "Last name");
      const email = sanitizeEmail(item?.email);
      const phoneNumber = sanitizePhoneNumber(item?.phoneNumber ?? "");
      const grade = sanitizeGrade(item?.grade);
      const coordinatorSubject = sanitizeCoordinatorSubject(item?.coordinatorSubject);
      
      const suffix = sanitizeOptionalNamePart(item?.suffix);
      const section = sanitizeOptionalString(item?.section);
      const subjects = sanitizeOptionalString(item?.subjects);
      const teacherId = sanitizeOptionalString(item?.teacherId);

      const result = await createMasterTeacher({
        firstName,
        middleName,
        lastName,
        suffix,
        email,
        phoneNumber,
        grade,
        section,
        subjects,
        coordinatorSubject,
        teacherId,
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
      console.error("Failed to import Master Teacher", error);
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