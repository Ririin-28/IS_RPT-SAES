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
      "u.role AS user_role",
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

      const joinConditions: string[] = [];
      const joinPairs: Array<[string, string]> = [
        ["user_id", "user_id"],
        ["principal_id", "user_id"],
        ["employee_id", "user_id"],
        ["id", "user_id"],
        [pickColumn(columns, EMAIL_COLUMNS) ?? "", pickColumn(userColumns, EMAIL_COLUMNS) ?? ""],
      ];

      for (const [pColumn, uColumn] of joinPairs) {
        if (!pColumn || !uColumn) {
          continue;
        }
        if (columns.has(pColumn) && userColumns.has(uColumn)) {
          joinConditions.push(`p.${pColumn} = u.${uColumn}`);
        }
      }

      if (!joinConditions.length && columns.has("user_id")) {
        joinConditions.push("p.user_id = u.user_id");
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
