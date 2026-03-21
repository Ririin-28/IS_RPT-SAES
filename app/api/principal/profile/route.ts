import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import {
  ensureUserProfileImageColumn,
  uploadProfileImage,
  cleanupProfileImage,
  ProfileImageValidationError,
} from "@/lib/server/profile-image";
import { parseProfileMutationRequest, resolveAuthorizedProfileUserId } from "@/lib/server/profile-request";
import { getPrincipalSessionFromCookies } from "@/lib/server/principal-session";
import { getTableColumns, query, runWithConnection } from "@/lib/db";

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
  const candidates = await Promise.all(
    PRINCIPAL_TABLE_CANDIDATES.map(async (candidate) => ({
      name: candidate,
      columns: await getTableColumns(candidate),
    })),
  );

  for (const candidate of candidates) {
    if (candidate.columns.size) {
      return candidate;
    }
  }
  return null;
};

export async function PUT(request: NextRequest) {
  const session = await getPrincipalSessionFromCookies().catch(() => null);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Principal session not found." },
      { status: 401 },
    );
  }

  const targetUser = resolveAuthorizedProfileUserId(
    request.nextUrl.searchParams.get("userId"),
    session.userId,
  );
  if (!targetUser.ok) {
    return targetUser.response;
  }

  let payload: Awaited<ReturnType<typeof parseProfileMutationRequest>>;
  try {
    payload = await parseProfileMutationRequest(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Invalid request body." },
      { status: 400 },
    );
  }

  let uploadedImageStoragePath: string | null = null;

  try {
    const [userColumns, principalTable] = await Promise.all([
      ensureUserProfileImageColumn(),
      resolvePrincipalTable(),
    ]);
    const body = payload.body;
    const uploadedImage = payload.profileImage ? await uploadProfileImage(payload.profileImage) : null;
    uploadedImageStoragePath = uploadedImage?.storagePath ?? null;

    const result = await runWithConnection(async (connection) => {
      await connection.beginTransaction();

      try {
        const [userRows] = await connection.execute<RowDataPacket[]>(
          "SELECT user_id, principal_id, user_code, profile_image_url FROM users WHERE user_id = ? LIMIT 1",
          [targetUser.userId],
        );
        if (!userRows.length) {
          await connection.rollback();
          return {
            notFound: true as const,
            previousProfileImageUrl: null,
            profileImageUrl: null,
          };
        }

        const existingPrincipalId =
          toNullableString(userRows[0]?.principal_id) ?? toNullableString(userRows[0]?.user_code);
        const previousProfileImageUrl = toNullableString(userRows[0]?.profile_image_url);
        const updates: string[] = [];
        const params: Array<string | number | null> = [];

        const firstNameCol = pickColumn(userColumns, FIRST_NAME_COLUMNS);
        if (body.firstName !== undefined && firstNameCol) {
          updates.push(`${firstNameCol} = ?`);
          params.push(typeof body.firstName === "string" ? body.firstName.trim() || null : null);
        }
        const middleNameCol = pickColumn(userColumns, MIDDLE_NAME_COLUMNS);
        if (body.middleName !== undefined && middleNameCol) {
          updates.push(`${middleNameCol} = ?`);
          params.push(typeof body.middleName === "string" ? body.middleName.trim() || null : null);
        }

        const lastNameCol = pickColumn(userColumns, LAST_NAME_COLUMNS);
        if (body.lastName !== undefined && lastNameCol) {
          updates.push(`${lastNameCol} = ?`);
          params.push(typeof body.lastName === "string" ? body.lastName.trim() || null : null);
        }

        const emailCol = pickColumn(userColumns, EMAIL_COLUMNS);
        if (body.email !== undefined && emailCol) {
          updates.push(`${emailCol} = ?`);
          params.push(typeof body.email === "string" ? body.email.trim() || null : null);
        }

        const contactCol = pickColumn(userColumns, CONTACT_COLUMNS);
        if (body.contactNumber !== undefined && contactCol) {
          updates.push(`${contactCol} = ?`);
          params.push(typeof body.contactNumber === "string" ? body.contactNumber.trim() || null : null);
        }

        if (uploadedImage) {
          updates.push("profile_image_url = ?");
          params.push(uploadedImage.publicUrl);
        }

        if (updates.length > 0) {
          params.push(targetUser.userId);
          await connection.execute(`UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`, params);
        }

        if (principalTable) {
          const { name, columns } = principalTable;
          const principalUpdates: string[] = [];
          const principalParams: Array<string | number | null> = [];

          const pushUpdate = (candidate: readonly string[], value: unknown) => {
            const column = pickColumn(columns, candidate);
            if (column !== null && value !== undefined) {
              principalUpdates.push(`p.${column} = ?`);
              principalParams.push(typeof value === "string" ? value.trim() || null : (value as any));
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
            const whereParams: Array<string | number> = [];

            if (columns.has("user_id")) {
              whereParts.push("p.user_id = ?");
              whereParams.push(targetUser.userId);
            }
            if (columns.has("principal_id") && existingPrincipalId) {
              whereParts.push("p.principal_id = ?");
              whereParams.push(existingPrincipalId);
            }
            if (!whereParts.length && columns.has("principal_id")) {
              whereParts.push("p.principal_id = ?");
              whereParams.push(String(targetUser.userId));
            }

            if (whereParts.length) {
              await connection.execute(
                `UPDATE \`${name}\` AS p SET ${principalUpdates.join(", ")} WHERE ${whereParts.join(" OR ")} LIMIT 1`,
                [...principalParams, ...whereParams],
              );
            }
          }
        }

        await connection.commit();
        return {
          notFound: false as const,
          previousProfileImageUrl,
          profileImageUrl: uploadedImage?.publicUrl ?? previousProfileImageUrl,
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });

    if (result.notFound) {
      if (uploadedImage) {
        await cleanupProfileImage(uploadedImage.storagePath);
      }
      return NextResponse.json({ success: false, error: "Principal profile not found." }, { status: 404 });
    }

    if (
      uploadedImage &&
      result.previousProfileImageUrl &&
      result.previousProfileImageUrl !== uploadedImage.publicUrl
    ) {
      await cleanupProfileImage(result.previousProfileImageUrl);
    }

    return NextResponse.json({
      success: true,
      profile: {
        profileImageUrl: result.profileImageUrl,
      },
    });
  } catch (error) {
    if (uploadedImageStoragePath) {
      await cleanupProfileImage(uploadedImageStoragePath);
    }
    console.error("Failed to update principal profile", error);
    if (error instanceof ProfileImageValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update profile." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await getPrincipalSessionFromCookies().catch(() => null);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Principal session not found." },
      { status: 401 },
    );
  }

  const targetUser = resolveAuthorizedProfileUserId(
    request.nextUrl.searchParams.get("userId"),
    session.userId,
  );
  if (!targetUser.ok) {
    return targetUser.response;
  }

  try {
    const [userColumns, principalTable] = await Promise.all([
      ensureUserProfileImageColumn(),
      resolvePrincipalTable(),
    ]);
    if (!userColumns.size) {
      return NextResponse.json(
        { success: false, error: "Users table is unavailable." },
        { status: 500 },
      );
    }

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
    addUserColumn(userColumns.has("profile_image_url") ? "profile_image_url" : null, "user_profile_image_url");
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

    const [rows] = await query<RowDataPacket[]>(sql, [targetUser.userId]);
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
        profileImageUrl: toNullableString(row.user_profile_image_url),
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
