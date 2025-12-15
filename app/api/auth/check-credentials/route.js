import { runWithConnection } from "@/lib/db";

export async function POST(req) {
  try {
    return await runWithConnection(async (db) => {
      try {
        const { email, password, userId } = await req.json();

        const requiresUserId = (role) => {
          if (!role) return false;
          const normalized = String(role).toLowerCase().replace(/\s+/g, "_");
          return ["it_admin", "admin", "itadmin"].includes(normalized);
        };

        let normalizedUserId = null;
        if (userId !== undefined && userId !== null && userId !== "") {
          normalizedUserId = Number(userId);
          if (!Number.isFinite(normalizedUserId)) {
            return new Response(JSON.stringify({ match: false }), { status: 200 });
          }
        }

        let query = "SELECT * FROM users WHERE email = ?";
        const params = [email];
        if (normalizedUserId !== null) {
          query += " AND user_id = ?";
          params.push(normalizedUserId);
        }

        const [users] = await db.execute(query, params);
        const user = users[0];
        if (!user) {
          return new Response(JSON.stringify({ match: false }), { status: 200 });
        }

        if (requiresUserId(user.role) && normalizedUserId === null) {
          return new Response(
            JSON.stringify({ match: false, requireUserId: true, role: user.role }),
            { status: 200 },
          );
        }

        if (password !== user.password) {
          return new Response(JSON.stringify({ match: false }), { status: 200 });
        }

        return new Response(JSON.stringify({ match: true, role: user.role }), { status: 200 });
      } catch (err) {
        console.error("check-credentials handler error", err);
        return new Response(JSON.stringify({ match: false }), { status: 200 });
      }
    });
  } catch (err) {
    console.error("check-credentials connection error", err);
    return new Response(JSON.stringify({ match: false, error: "DB_CONNECTION_FAILED" }), { status: 500 });
  }
}
