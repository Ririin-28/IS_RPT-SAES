import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

type ColumnName = string;

type ResolvedParentTable = {
  name: string;
  columns: Set<ColumnName>;
};

const PARENT_TABLE_CANDIDATES = [
  "parent",
  "parents",
  "parent_profile",
  "parent_profiles",
] as const;

const CONTACT_COLUMNS = [
  "contact_number",
  "contact_no",
  "phone_number",
  "phone",
  "mobile",
  "mobile_number",
] as const;

const ADDRESS_COLUMNS = ["address", "home_address", "current_address"] as const;

const USER_ID_COLUMNS = ["user_id", "account_id", "id"] as const;

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

const resolveParentTable = async (): Promise<ResolvedParentTable | null> => {
  for (const candidate of PARENT_TABLE_CANDIDATES) {
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

type UserRow = RowDataPacket & {
  user_id: number;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
};

type ParentRow = RowDataPacket & {
  parent_id: string | null;
};

type ParentStudentRow = RowDataPacket & {
  address: string | null;
};

type DynamicParentRow = RowDataPacket & {
  address?: string | null;
  contact?: string | null;
  phone_number?: string | null;
  contact_number?: string | null;
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
    const [userRows] = await query<UserRow[]>(
      "SELECT user_id, first_name, middle_name, last_name, email, phone_number FROM users WHERE user_id = ? LIMIT 1",
      [userId],
    );

    const user = userRows[0];
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Parent account not found." },
        { status: 404 },
      );
    }

    let address: string | null = null;
    let contactNumber: string | null = user.phone_number?.trim() ? user.phone_number.trim() : null;

    let parentId: string | null = null;
    try {
      const [parentRows] = await query<ParentRow[]>(
        "SELECT parent_id FROM parent WHERE user_id = ? LIMIT 1",
        [userId],
      );
      parentId = parentRows[0]?.parent_id ?? null;
    } catch (error) {
      console.warn("Parent table lookup failed", error);
    }

    if (parentId) {
      try {
        const [parentStudentRows] = await query<ParentStudentRow[]>(
          "SELECT address FROM parent_student WHERE parent_id = ? AND address IS NOT NULL AND address <> '' ORDER BY parent_student_id DESC LIMIT 1",
          [parentId],
        );
        const studentRecord = parentStudentRows[0];
        if (studentRecord?.address) {
          const text = studentRecord.address.trim();
          address = text.length ? text : null;
        }
      } catch (error) {
        console.warn("Parent student lookup failed", error);
      }
    }

    if (!address || !contactNumber) {
      const parentTable = await resolveParentTable();

      if (parentTable) {
        const addressColumn = pickColumn(parentTable.columns, ADDRESS_COLUMNS);
        const contactColumn = pickColumn(parentTable.columns, CONTACT_COLUMNS);
        const userIdColumn = pickColumn(parentTable.columns, USER_ID_COLUMNS);

        if (userIdColumn) {
          const selectedColumns: string[] = [];
          if (addressColumn && !address) selectedColumns.push(addressColumn);
          if (contactColumn && !contactNumber) selectedColumns.push(contactColumn);

          if (selectedColumns.length > 0) {
            const [parentRows] = await query<DynamicParentRow[]>(
              `SELECT ${selectedColumns.map((c) => `\`${c}\``).join(", ")} FROM \`${parentTable.name}\` WHERE \`${userIdColumn}\` = ? LIMIT 1`,
              [userId],
            );

            const parent = parentRows[0];
            if (parent) {
              if (!address && addressColumn && typeof (parent as any)[addressColumn] === "string") {
                const text = String((parent as any)[addressColumn]).trim();
                address = text.length ? text : null;
              }
              if (!contactNumber && contactColumn && typeof (parent as any)[contactColumn] === "string") {
                const text = String((parent as any)[contactColumn]).trim();
                contactNumber = text.length ? text : null;
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      profile: {
        firstName: user.first_name,
        middleName: user.middle_name,
        lastName: user.last_name,
        email: user.email,
        address,
        contactNumber,
      },
    });
  } catch (error) {
    console.error("Failed to load parent profile", error);
    return NextResponse.json(
      { success: false, error: "Failed to load parent profile." },
      { status: 500 },
    );
  }
}

