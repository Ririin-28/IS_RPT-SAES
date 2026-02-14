import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const TRUSTED_DEVICE_TIMESTAMP_CANDIDATES = [
  "created_at",
  "registered_at",
  "added_at",
  "first_used",
  "last_used",
  "updated_at",
] as const;

const ACTIVE_WINDOW_MS = 10 * 60 * 1000;

type CountRow = RowDataPacket & { count: number };
type RecentLoginRow = RowDataPacket & {
  log_id: number;
  user_id: number | null;
  role: string | null;
  created_at: Date | null;
  last_login: Date | null;
  logged_out_at: Date | null;
  username?: string | null;
  email?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
};

interface TrustedDeviceTimestampResolution {
  column: string | null;
  missingCandidates: string[];
}

function resolveTrustedDeviceTimestampColumn(
  columns: Set<string>,
): TrustedDeviceTimestampResolution {
  const missing: string[] = [];

  for (const candidate of TRUSTED_DEVICE_TIMESTAMP_CANDIDATES) {
    if (columns.has(candidate)) {
      return { column: candidate, missingCandidates: missing };
    }
    missing.push(candidate);
  }

  return { column: null, missingCandidates: missing };
}

async function countRows(sql: string, params: Array<string | number | null> = []) {
  try {
    const [rows] = await query<CountRow[]>(sql, params);
    return rows[0]?.count ?? 0;
  } catch (error) {
    console.error(`Count query failed: ${sql}`, error);
    return 0;
  }
}

function normalizeName(row: RecentLoginRow): string | null {
  const nameLike = row.name ?? null;
  if (nameLike && String(nameLike).trim().length > 0) {
    return String(nameLike).trim();
  }

  const firstName = row.first_name ?? "";
  const middleName = row.middle_name ?? "";
  const lastName = row.last_name ?? "";
  const combined = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, " ").trim();
  if (combined.length > 0) {
    return combined;
  }

  const username = row.username ?? null;
  return username && String(username).trim().length > 0 ? String(username).trim() : null;
}

async function safeTableExists(tableName: string): Promise<boolean> {
  try {
    return await tableExists(tableName);
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

async function safeGetTableColumns(tableName: string): Promise<Set<string>> {
  try {
    return await getTableColumns(tableName);
  } catch (error) {
    console.error(`Error getting columns for table ${tableName}:`, error);
    return new Set();
  }
}

export async function GET() {
  try {
    console.log("Starting dashboard data fetch...");

    // Check for required tables
    const usersTableExists = await safeTableExists("users");
    if (!usersTableExists) {
      console.error("Users table does not exist");
      return NextResponse.json(
        { 
          error: "Required table 'users' not found",
          overview: {
            totalUsers: 0,
            newUsersThisWeek: 0,
            pendingOnboarding: 0,
            archivedAccounts: 0,
          },
          recentLogins: [],
          metadata: {
            missingTables: ["users"]
          }
        },
        { status: 500 }
      );
    }

    const trustedDevicesAvailable = await safeTableExists("trusted_devices");
    const accountLogsAvailable = await safeTableExists("account_logs");
    const archivedUsersAvailable = await safeTableExists("archived_users");
    const legacyArchiveUsersAvailable = await safeTableExists("archive_users");

    console.log("Table status:", {
      users: usersTableExists,
      trusted_devices: trustedDevicesAvailable,
      account_logs: accountLogsAvailable,
      archived_users: archivedUsersAvailable,
      archive_users: legacyArchiveUsersAvailable
    });

    let totalUsers = 0;
    let pendingOnboarding = 0;
    let newUsersThisWeek: number = 0;
    let newUsersSourceColumn: string | null = null;
    let missingTrustedDeviceColumns: string[] | undefined;
    let missingUserColumns: string[] | undefined;

    // Get user columns safely
    const userColumns = await safeGetTableColumns("users");
    console.log("User columns:", Array.from(userColumns));

    // Count total users
    try {
      totalUsers = await countRows("SELECT COUNT(*) AS count FROM users WHERE user_id IS NOT NULL");
      console.log("Total users:", totalUsers);
    } catch (error) {
      console.error("Failed to count total users:", error);
      totalUsers = 0;
    }

    // Calculate new users this week
    if (userColumns.has("created_at")) {
      try {
        newUsersThisWeek = await countRows(
          `SELECT COUNT(*) AS count
           FROM users
           WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
           AND user_id IS NOT NULL`
        );
        newUsersSourceColumn = "users.created_at";
        console.log("New users this week (from users.created_at):", newUsersThisWeek);
      } catch (error) {
        console.error("Failed to count new users from created_at:", error);
        newUsersThisWeek = 0;
      }
    } else {
      missingUserColumns = ["created_at"];
      console.warn("users.created_at column not found");
    }

    // Handle trusted devices and onboarding
    if (trustedDevicesAvailable) {
      try {
        // Count users without trusted devices
        pendingOnboarding = await countRows(
          `SELECT COUNT(*) AS count
           FROM users u
           LEFT JOIN trusted_devices td ON td.user_id = u.user_id
           WHERE td.user_id IS NULL 
           AND u.user_id IS NOT NULL`
        );

        console.log("Pending onboarding (no trusted devices):", pendingOnboarding);

        // If we couldn't get new users from users table, try trusted_devices
        const trustedDeviceColumns = await safeGetTableColumns("trusted_devices");
        console.log("Trusted device columns:", Array.from(trustedDeviceColumns));

        if (newUsersThisWeek === 0 && trustedDeviceColumns.size > 0) {
          const { column: timestampColumn, missingCandidates } = resolveTrustedDeviceTimestampColumn(trustedDeviceColumns);

          if (timestampColumn) {
            newUsersSourceColumn = `trusted_devices.${timestampColumn}`;
            
            try {
              // Count distinct users with trusted devices created in the last week
              const [recentRows] = await query<CountRow[]>(
                `SELECT COUNT(DISTINCT td.user_id) AS count
                 FROM trusted_devices td
                 WHERE td.user_id IS NOT NULL
                 AND td.${timestampColumn} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
              );

              newUsersThisWeek = recentRows[0]?.count ?? 0;
              console.log("New users this week (from trusted_devices):", newUsersThisWeek);
            } catch (error) {
              console.error("Failed to count new users from trusted_devices:", error);
            }
          } else if (missingCandidates.length > 0) {
            missingTrustedDeviceColumns = missingCandidates;
          }
        }
      } catch (error) {
        console.error("Error processing trusted devices:", error);
        pendingOnboarding = totalUsers; // Fallback: all users need onboarding
      }
    } else {
      pendingOnboarding = totalUsers;
      console.log("Trusted devices table not available, all users need onboarding");
    }

    // Count archived accounts
    let archivedAccounts = 0;
    const archiveTableName = archivedUsersAvailable
      ? "archived_users"
      : legacyArchiveUsersAvailable
        ? "archive_users"
        : null;

    if (archiveTableName) {
      try {
        archivedAccounts = await countRows(`SELECT COUNT(*) AS count FROM ${archiveTableName}`);
        console.log("Archived accounts:", archivedAccounts);
      } catch (error) {
        console.error("Failed to count archived accounts:", error);
        archivedAccounts = 0;
      }
    }

    // Get recent logins
    let recentLogins: any[] = [];
    if (accountLogsAvailable) {
      try {
        const userSelectFragments: string[] = [];
        const includeUserColumn = (column: string, alias?: string) => {
          if (userColumns.has(column)) {
            userSelectFragments.push(`u.${column}${alias ? ` AS ${alias}` : ""}`);
            return true;
          }
          return false;
        };

        includeUserColumn("username", "username");
        includeUserColumn("email", "email");
        includeUserColumn("name", "name");
        includeUserColumn("first_name", "first_name");
        includeUserColumn("middle_name", "middle_name");
        includeUserColumn("last_name", "last_name");

        const userSelectSql = userSelectFragments.length > 0
          ? `,
            ${userSelectFragments.join(",\n            ")}`
          : "";

        const [recentRows] = await query<RecentLoginRow[]>(
          `SELECT
            al.log_id,
            al.user_id,
            al.role,
            al.created_at,
            al.last_login,
            al.logged_out_at${userSelectSql}
          FROM account_logs al
          LEFT JOIN users u ON u.user_id = al.user_id
          WHERE al.user_id IS NOT NULL
          ORDER BY COALESCE(al.last_login, al.created_at) DESC
          LIMIT 5`
        );

        recentLogins = recentRows.map((row) => {
          const loginDate = (row.last_login ?? row.created_at) ?? null;
          const loggedOutIso = toIsoString(row.logged_out_at);
          const loginTime = toIsoString(loginDate);
          const status = loggedOutIso ? "Offline" : determineStatus(loginDate);

          return {
            id: row.log_id,
            userId: row.user_id,
            role: row.role ?? undefined,
            loginTime,
            status,
            name: normalizeName(row),
            email: row.email ?? undefined,
            loggedOutAt: loggedOutIso ?? undefined,
          };
        });

        console.log("Recent logins found:", recentLogins.length);
      } catch (error) {
        console.error("Failed to fetch recent logins:", error);
        recentLogins = [];
      }
    } else {
      console.log("Account logs table not available");
    }

    const response = {
      overview: {
        totalUsers,
        newUsersThisWeek,
        pendingOnboarding,
        archivedAccounts,
      },
      metadata: {
        newUsersSourceColumn,
        missingTrustedDeviceColumns,
        missingUserColumns,
        trustedDevicesAvailable,
        accountLogsAvailable,
        archiveUsersAvailable: archivedUsersAvailable || legacyArchiveUsersAvailable,
        archivedUsersAvailable,
        legacyArchiveUsersAvailable,
        usersTableExists,
      },
      recentLogins,
    };

    console.log("Dashboard response prepared:", response);
    return NextResponse.json(response);

  } catch (error) {
    console.error("Failed to load IT Admin dashboard data", error);
    return NextResponse.json(
      { 
        error: "Failed to load IT Admin dashboard data.",
        details: error instanceof Error ? error.message : 'Unknown error',
        overview: {
          totalUsers: 0,
          newUsersThisWeek: 0,
          pendingOnboarding: 0,
          archivedAccounts: 0,
        },
        recentLogins: [],
      },
      { status: 500 }
    );
  }
}

function determineStatus(loginDate: Date | string | null | undefined): "Online" | "Offline" {
  if (!loginDate) {
    return "Offline";
  }

  const timestamp = loginDate instanceof Date ? loginDate.getTime() : new Date(loginDate).getTime();
  if (Number.isNaN(timestamp)) {
    return "Offline";
  }

  return Date.now() - timestamp <= ACTIVE_WINDOW_MS ? "Online" : "Offline";
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}