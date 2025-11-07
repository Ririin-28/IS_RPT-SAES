import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const FIRST_NAME_COLUMNS = ["first_name", "fname", "given_name"] as const;
const MIDDLE_NAME_COLUMNS = ["middle_name", "mname", "middlename"] as const;
const LAST_NAME_COLUMNS = ["last_name", "lname", "surname", "family_name"] as const;
const SUFFIX_COLUMNS = ["suffix", "name_suffix"] as const;
const EMAIL_COLUMNS = ["email", "user_email", "email_address"] as const;
const CONTACT_COLUMNS = [
  "contact_number",
  "contact_no",
  "phone",
  "phone_number",
  "mobile",
  "mobile_number",
] as const;

const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
};

const pickColumn = (columns: Set<string>, candidates: readonly string[]): string | null => {
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }

  const lowerLookup = new Map<string, string>();
  for (const column of columns) {
    lowerLookup.set(column.toLowerCase(), column);
  }

  for (const candidate of candidates) {
    const resolved = lowerLookup.get(candidate.toLowerCase());
    if (resolved) {
      return resolved;
    }
  }

  for (const candidate of candidates) {
    const needle = candidate.toLowerCase();
    for (const column of columns) {
      if (column.toLowerCase().includes(needle)) {
        return column;
      }
    }
  }

  return null;
};

export async function GET(request: NextRequest) {
  const userIdParam = request.nextUrl.searchParams.get("userId");
  if (!userIdParam) {
    return NextResponse.json(
      { success: false, error: "Missing userId query parameter." },
      { status: 400 },
    );
  }

  const userId = Number(userIdParam);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json(
      { success: false, error: "Invalid userId value." },
      { status: 400 },
    );
  }

  try {
    const userColumns = await getTableColumns("users");
    if (!userColumns.size) {
      return NextResponse.json(
        { success: false, error: "Users table is unavailable." },
        { status: 500 },
      );
    }

    const selectParts: string[] = ["u.user_id AS user_id", "u.role AS user_role"];

    const addColumn = (column: string | null, alias: string) => {
      if (column) {
        selectParts.push(`u.${column} AS ${alias}`);
      } else {
        selectParts.push(`NULL AS ${alias}`);
      }
    };

    addColumn(pickColumn(userColumns, FIRST_NAME_COLUMNS), "user_first_name");
    addColumn(pickColumn(userColumns, MIDDLE_NAME_COLUMNS), "user_middle_name");
    addColumn(pickColumn(userColumns, LAST_NAME_COLUMNS), "user_last_name");
    addColumn(pickColumn(userColumns, SUFFIX_COLUMNS), "user_suffix");
    addColumn(pickColumn(userColumns, EMAIL_COLUMNS), "user_email");
    addColumn(pickColumn(userColumns, CONTACT_COLUMNS), "user_contact_number");

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM users AS u
      WHERE u.user_id = ?
      LIMIT 1
    `;

    const [rows] = await query<RowDataPacket[]>(sql, [userId]);
    if (!rows.length) {
      return NextResponse.json(
        { success: false, error: "IT admin profile not found." },
        { status: 404 },
      );
    }

    const row = rows[0];

    return NextResponse.json({
      success: true,
      profile: {
        userId: row.user_id,
        role: toNullableString(row.user_role),
        firstName: toNullableString(row.user_first_name),
        middleName: toNullableString(row.user_middle_name),
        lastName: toNullableString(row.user_last_name),
        suffix: toNullableString(row.user_suffix),
        email: toNullableString(row.user_email),
        contactNumber: toNullableString(row.user_contact_number),
      },
    });
  } catch (error) {
    console.error("Failed to load IT admin profile", error);
    return NextResponse.json(
      { success: false, error: "Failed to load IT admin profile." },
      { status: 500 },
    );
  }
}
