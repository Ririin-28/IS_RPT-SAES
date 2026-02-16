import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";

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

export async function PUT(request: NextRequest) {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:profile.manage" });
  if (!auth.ok) {
    return auth.response;
  }

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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  try {
    const userColumns = await getTableColumns("users");
    const updates: string[] = [];
    const params: any[] = [];

    const firstNameCol = pickColumn(userColumns, FIRST_NAME_COLUMNS);
    if (body.firstName !== undefined && firstNameCol) {
      updates.push(`${firstNameCol} = ?`);
      params.push(body.firstName?.trim() || null);
    }

    const middleNameCol = pickColumn(userColumns, MIDDLE_NAME_COLUMNS);
    if (body.middleName !== undefined && middleNameCol) {
      updates.push(`${middleNameCol} = ?`);
      params.push(body.middleName?.trim() || null);
    }

    const lastNameCol = pickColumn(userColumns, LAST_NAME_COLUMNS);
    if (body.lastName !== undefined && lastNameCol) {
      updates.push(`${lastNameCol} = ?`);
      params.push(body.lastName?.trim() || null);
    }

    const emailCol = pickColumn(userColumns, EMAIL_COLUMNS);
    if (body.email !== undefined && emailCol) {
      updates.push(`${emailCol} = ?`);
      params.push(body.email?.trim() || null);
    }

    const contactCol = pickColumn(userColumns, CONTACT_COLUMNS);
    if (body.contactNumber !== undefined && contactCol) {
      updates.push(`${contactCol} = ?`);
      params.push(body.contactNumber?.trim() || null);
    }

    if (updates.length > 0) {
      params.push(userId);
      await query(`UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`, params);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update IT admin profile", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:profile.manage" });
  if (!auth.ok) {
    return auth.response;
  }

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

    const itAdminColumns = await getTableColumns("it_admin");

    const selectParts: string[] = [
      "u.user_id AS user_id",
      userColumns.has("role") ? "u.role AS user_role" : "NULL AS user_role",
      userColumns.has("role_id") ? "u.role_id AS user_role_id" : "NULL AS user_role_id",
      itAdminColumns.has("role") ? "ia.role AS admin_role" : "NULL AS admin_role",
      itAdminColumns.has("role_id") ? "ia.role_id AS admin_role_id" : "NULL AS admin_role_id",
    ];

    const addUserColumn = (column: string | null, alias: string) => {
      if (column) {
        selectParts.push(`u.${column} AS ${alias}`);
      } else {
        selectParts.push(`NULL AS ${alias}`);
      }
    };

    const addItAdminColumn = (column: string | null, alias: string) => {
      if (column) {
        selectParts.push(`ia.${column} AS ${alias}`);
      } else {
        selectParts.push(`NULL AS ${alias}`);
      }
    };

    addUserColumn(pickColumn(userColumns, FIRST_NAME_COLUMNS), "user_first_name");
    addUserColumn(pickColumn(userColumns, MIDDLE_NAME_COLUMNS), "user_middle_name");
    addUserColumn(pickColumn(userColumns, LAST_NAME_COLUMNS), "user_last_name");
    addUserColumn(pickColumn(userColumns, SUFFIX_COLUMNS), "user_suffix");
    addUserColumn(pickColumn(userColumns, EMAIL_COLUMNS), "user_email");
    addUserColumn(pickColumn(userColumns, CONTACT_COLUMNS), "user_contact_number");

    addItAdminColumn(pickColumn(itAdminColumns, FIRST_NAME_COLUMNS), "admin_first_name");
    addItAdminColumn(pickColumn(itAdminColumns, MIDDLE_NAME_COLUMNS), "admin_middle_name");
    addItAdminColumn(pickColumn(itAdminColumns, LAST_NAME_COLUMNS), "admin_last_name");
    addItAdminColumn(pickColumn(itAdminColumns, SUFFIX_COLUMNS), "admin_suffix");
    addItAdminColumn(pickColumn(itAdminColumns, EMAIL_COLUMNS), "admin_email");
    addItAdminColumn(pickColumn(itAdminColumns, CONTACT_COLUMNS), "admin_contact_number");

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM users AS u
      LEFT JOIN it_admin AS ia ON ia.user_id = u.user_id
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

    const firstName = toNullableString(row.admin_first_name) ?? toNullableString(row.user_first_name);
    const middleName = toNullableString(row.admin_middle_name) ?? toNullableString(row.user_middle_name);
    const lastName = toNullableString(row.admin_last_name) ?? toNullableString(row.user_last_name);
    const suffix = toNullableString(row.admin_suffix) ?? toNullableString(row.user_suffix);
    const email = toNullableString(row.admin_email) ?? toNullableString(row.user_email);
    const contactNumber = toNullableString(row.admin_contact_number) ?? toNullableString(row.user_contact_number);

    const role =
      toNullableString(row.admin_role) ??
      toNullableString(row.user_role) ??
      null;

    const roleId = row.admin_role_id ?? row.user_role_id ?? null;

    return NextResponse.json({
      success: true,
      profile: {
        userId: row.user_id,
        role,
        roleId,
        firstName,
        middleName,
        lastName,
        suffix,
        email,
        contactNumber,
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
