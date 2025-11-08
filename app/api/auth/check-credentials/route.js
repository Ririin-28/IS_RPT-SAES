import mysql from "mysql2/promise";

export async function POST(req) {
  try {
    const { email, password, userId } = await req.json();
    const db = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "RIANA28@eg564",
      database: "rpt-saes_db",
    });

    const requiresUserId = (role) => {
      if (!role) return false;
      const normalized = String(role).toLowerCase().replace(/\s+/g, "_");
      return ["it_admin", "admin", "itadmin"].includes(normalized);
    };
    let normalizedUserId = null;
    if (userId !== undefined && userId !== null && userId !== "") {
      normalizedUserId = Number(userId);
      if (!Number.isFinite(normalizedUserId)) {
        await db.end();
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
    await db.end();
    if (!user) {
      return new Response(JSON.stringify({ match: false }), { status: 200 });
    }

    if (requiresUserId(user.role) && normalizedUserId === null) {
      return new Response(
        JSON.stringify({ match: false, requireUserId: true, role: user.role }),
        { status: 200 }
      );
    }

    if (password !== user.password) {
      return new Response(JSON.stringify({ match: false }), { status: 200 });
    }
    return new Response(JSON.stringify({ match: true, role: user.role }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ match: false }), { status: 200 });
  }
}
