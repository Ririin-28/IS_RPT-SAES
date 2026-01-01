import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

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
const SCHOOL_COLUMNS = [
  "school",
  "school_name",
  "assigned_school",
  "campus",
] as const;

const PRINCIPAL_TABLE_CANDIDATES = [
  "principal",
  "principals",
  "principal_info",
  "principal_profile",
  "principal_profiles",
] as const;

type ColumnSet = Set<string>;

type PrincipalTable = {
  name: string;
  columns: ColumnSet;
};

const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
};

const buildColumnLookup = (columns: ColumnSet): Map<string, string> => {
  const lookup = new Map<string, string>();
  for (const column of columns) {
    lookup.set(column.toLowerCase(), column);
  }
  return lookup;
};

const pickColumn = (columns: ColumnSet, candidates: readonly string[]): string | null => {
  if (!columns.size) {
    return null;
  }

  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }

  const lookup = buildColumnLookup(columns);
  for (const candidate of candidates) {
    const resolved = lookup.get(candidate.toLowerCase());
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

const resolvePrincipalTable = async (): Promise<PrincipalTable | null> => {
  for (const candidate of PRINCIPAL_TABLE_CANDIDATES) {
    if (!(await tableExists(candidate))) {
      continue;
    }
    const columns = await getTableColumns(candidate);
    if (!columns.size) {
      continue;
    }
    return { name: candidate, columns };
  }
  return null;
};

export async function PUT(request: NextRequest) {
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
    const principalTable = await resolvePrincipalTable();
    const updates: string[] = [];
    const params: any[] = [];

    const [userRows] = await query<RowDataPacket[]>(
      "SELECT user_id, principal_id, user_code FROM users WHERE user_id = ? LIMIT 1",
      [userId],
    );
    if (!userRows.length) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }

    const existingPrincipalId = toNullableString(userRows[0]?.principal_id) ?? toNullableString(userRows[0]?.user_code);

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

    if (principalTable) {
      const { name, columns } = principalTable;
      const principalUpdates: string[] = [];
      const principalParams: any[] = [];

      const pushUpdate = (candidate: readonly string[], value: any) => {
        const column = pickColumn(columns, candidate);
        if (column !== null && value !== undefined) {
          principalUpdates.push(`p.${column} = ?`);
          principalParams.push(value?.trim ? value.trim() : value);
        }
      };

      pushUpdate(FIRST_NAME_COLUMNS, body.firstName);
      pushUpdate(MIDDLE_NAME_COLUMNS, body.middleName);
      pushUpdate(LAST_NAME_COLUMNS, body.lastName);
      pushUpdate(SUFFIX_COLUMNS, body.suffix);
      pushUpdate(EMAIL_COLUMNS, body.email);
      pushUpdate(CONTACT_COLUMNS, body.contactNumber);
      pushUpdate(SCHOOL_COLUMNS, body.school);

      if (principalUpdates.length > 0) {
        const whereParts: string[] = [];
        const whereParams: any[] = [];

        if (columns.has("user_id")) {
          whereParts.push("p.user_id = ?");
          whereParams.push(userId);
        }
        if (columns.has("principal_id") && existingPrincipalId) {
          whereParts.push("p.principal_id = ?");
          whereParams.push(existingPrincipalId);
        }
        if (!whereParts.length && columns.has("principal_id")) {
          whereParts.push("p.principal_id = ?");
          whereParams.push(String(userId));
        }

        if (whereParts.length) {
          await query(
            `UPDATE \`${name}\` AS p SET ${principalUpdates.join(", ")} WHERE ${whereParts.join(" OR ")} LIMIT 1`,
            [...principalParams, ...whereParams],
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update principal profile", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile." },
      { status: 500 },
    );
  }
}

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

    const principalTable = await resolvePrincipalTable();

    const selectParts: string[] = [
      "u.user_id AS user_id",
    ];

    const addUserColumn = (column: string | null, alias: string) => {
      if (column) {
        selectParts.push(`u.${column} AS ${alias}`);
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
    addUserColumn(userColumns.has("role") ? "role" : null, "user_role");
    addUserColumn(userColumns.has("principal_id") ? "principal_id" : null, "user_principal_id");
    addUserColumn(userColumns.has("user_code") ? "user_code" : null, "user_code");

    let joinClause = "";

    if (principalTable) {
      const { name, columns } = principalTable;
      const addPrincipalColumn = (column: string | null, alias: string) => {
        if (column) {
          selectParts.push(`p.${column} AS ${alias}`);
        } else {
          selectParts.push(`NULL AS ${alias}`);
        }
      };

      addPrincipalColumn(pickColumn(columns, FIRST_NAME_COLUMNS), "principal_first_name");
      addPrincipalColumn(pickColumn(columns, MIDDLE_NAME_COLUMNS), "principal_middle_name");
      addPrincipalColumn(pickColumn(columns, LAST_NAME_COLUMNS), "principal_last_name");
      addPrincipalColumn(pickColumn(columns, SUFFIX_COLUMNS), "principal_suffix");
      addPrincipalColumn(pickColumn(columns, EMAIL_COLUMNS), "principal_email");
      addPrincipalColumn(pickColumn(columns, CONTACT_COLUMNS), "principal_contact_number");
      addPrincipalColumn(pickColumn(columns, SCHOOL_COLUMNS), "principal_school");
      addPrincipalColumn(columns.has("principal_id") ? "principal_id" : null, "principal_principal_id");

      const joinConditions: string[] = [];
      if (columns.has("user_id") && userColumns.has("user_id")) {
        joinConditions.push("p.user_id = u.user_id");
      }
      if (columns.has("principal_id") && userColumns.has("principal_id")) {
        joinConditions.push("p.principal_id = u.principal_id");
      }
      if (columns.has("principal_id") && userColumns.has("user_code")) {
        joinConditions.push("p.principal_id = u.user_code");
      }

      if (joinConditions.length) {
        joinClause = `LEFT JOIN \`${name}\` AS p ON ${joinConditions.join(" OR ")}`;
      }
    } else {
      selectParts.push("NULL AS principal_first_name");
      selectParts.push("NULL AS principal_middle_name");
      selectParts.push("NULL AS principal_last_name");
      selectParts.push("NULL AS principal_suffix");
      selectParts.push("NULL AS principal_email");
      selectParts.push("NULL AS principal_contact_number");
      selectParts.push("NULL AS principal_school");
      selectParts.push("NULL AS principal_principal_id");
    }

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM users AS u
      ${joinClause}
      WHERE u.user_id = ?
      LIMIT 1
    `;

    const [rows] = await query<RowDataPacket[]>(sql, [userId]);
    if (!rows.length) {
      return NextResponse.json(
        { success: false, error: "Principal profile not found." },
        { status: 404 },
      );
    }

    const row = rows[0];

    return NextResponse.json({
      success: true,
      profile: {
        userId: row.user_id,
        role: toNullableString(row.user_role),
        firstName:
          toNullableString(row.principal_first_name) ?? toNullableString(row.user_first_name),
        middleName:
          toNullableString(row.principal_middle_name) ?? toNullableString(row.user_middle_name),
        lastName:
          toNullableString(row.principal_last_name) ?? toNullableString(row.user_last_name),
        suffix: toNullableString(row.principal_suffix) ?? toNullableString(row.user_suffix),
        email:
          toNullableString(row.principal_email) ?? toNullableString(row.user_email),
        contactNumber:
          toNullableString(row.principal_contact_number) ??
          toNullableString(row.user_contact_number),
        school: toNullableString(row.principal_school),
        principalId:
          toNullableString(row.principal_principal_id) ??
          toNullableString(row.user_principal_id) ??
          toNullableString(row.user_code) ??
          String(row.user_id),
      },
    });
  } catch (error) {
    console.error("Failed to load principal profile", error);
    return NextResponse.json(
      { success: false, error: "Failed to load principal profile." },
      { status: 500 },
    );
  }
}
