import type { RowDataPacket } from "mysql2/promise";
import ParentWelcome from "@/modules/Parent/welcome/welcome";
import { query } from "@/lib/db";
import { getParentSessionFromCookies } from "@/lib/server/parent-session";
import { formatFullNameWithMiddleInitial } from "@/lib/utils/user-profile";

type ParentNameRow = RowDataPacket & {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
};

export default async function Welcome() {
  let initialDisplayName = "Parent";
  const session = await getParentSessionFromCookies();

  if (session) {
    try {
      const [rows] = await query<ParentNameRow[]>(
        "SELECT first_name, middle_name, last_name FROM users WHERE user_id = ? LIMIT 1",
        [session.userId],
      );
      const user = rows[0];
      const formattedName = formatFullNameWithMiddleInitial({
        firstName: user?.first_name ?? null,
        middleName: user?.middle_name ?? null,
        lastName: user?.last_name ?? null,
      });
      if (formattedName) {
        initialDisplayName = formattedName;
      }
    } catch {
      // Keep the generic fallback when the name lookup fails.
    }
  }

  return <ParentWelcome initialDisplayName={initialDisplayName} />;
}
